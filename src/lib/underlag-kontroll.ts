import type { SupabaseClient } from '@supabase/supabase-js';
import { send } from '@vercel/queue';
import { callOpenAI, parseJSON } from '@/lib/inmail/openai-client';
import { byggMejlkontext } from '@/lib/mejlkontext';
import { arZip, kanLasasAvAi } from '@/lib/underlag/filtyp';
import { arVarAdress } from '@/lib/underlag/var-fil';
import { isSieFile } from '@/lib/sie/parse';
import { handleGeneralQuestion } from '@/lib/inmail/handlers/general-question';
import { smsKontextForMejl } from '@/lib/inkorg/kontext';
import { cleanBody } from '@/lib/inmail/clean-body';

/**
 * Underlagsflödet för mejl från kunder.
 *
 * 1. `arUnderlagsmejl` avgör om mejlet handlar om underlag — även utan bilaga:
 *    ett svar på vår fråga om ett kvitto är underlagsrelaterat. AI:n får hela
 *    mejlhistoriken och kundens filer som inte är klara, och pekar ut vilka av
 *    dem mejlet gäller. Ett svar handlar ofta om en fil som kom i en annan
 *    tråd veckor tidigare.
 * 2. `startaUnderlagsflode` skriver svaret till kunden som ett utkast i
 *    inkorgen. Skickar kunden bara underlag och frågar inget skrivs inget utkast.
 *
 * Underlaget läses inte här sedan 2026-11-07. Det läses, kontrolleras och
 * konteras i Flöde i personkortet (@/lib/kontering/omgang), och det som saknas
 * frågas efter i kl 18-mejlet (Skriv mail). Gäller kundens mejl filer vi redan
 * har sätts `bokforing_underlag.kund_svar_at`, så att Flöde visar att de ska
 * köras om med kundens svar.
 */

const MODELL = 'gpt-6.1-sol';
/** AI:ns svar när underlaget är komplett och kunden inte frågar något. Då skrivs inget utkast. */
const INGET_SVAR = 'INGET_SVAR';

interface Profil { id: string; full_name: string; email: string }

interface FilRad {
  id: string;
  file_name: string;
  mime_type: string | null;
  sender_email: string | null;
  gmail_message_id: string | null;
  created_at: string;
  verifikationer_inlagda_at: string | null;
  verifikationer_antal: number | null;
  verifikationer_fel: string | null;
  sortering: string | null;
  /** Sida i ett dokument som läses med huvudunderlaget (`@/lib/underlag/sidor`). */
  del_av: string | null;
  sidor_saknas: number[] | null;
  /** När Flöde senast läste filen. */
  flode_at: string | null;
}

const FIL_KOLUMNER = 'id, file_name, mime_type, sender_email, gmail_message_id, created_at, verifikationer_inlagda_at, verifikationer_antal, verifikationer_fel, sortering, del_av, sidor_saknas, flode_at';

/** Ett redan bokfört underlag (kassarapport, SIE) har allt — det finns inget att fråga om. */
const arBokford = (f: FilRad) => !!f.verifikationer_inlagda_at && !f.verifikationer_fel && (f.verifikationer_antal ?? 0) > 0;

/**
 * Kundens egna underlag: inte de vi skickat, och inte övriga filer som en
 * NE-bilaga eller ett avtal — dem finns det inget att kontrollera i. Med
 * medOvriga kommer de med ändå, för svaret som ska bekräfta att vi fått dem.
 */
async function kundensFiler(supabase: SupabaseClient, userId: string, { medOvriga = false } = {}): Promise<FilRad[]> {
  const { data, error } = await supabase.from('bokforing_underlag')
    .select(FIL_KOLUMNER).eq('user_id', userId).order('created_at');
  if (error) throw new Error(`Kunde inte läsa underlagen: ${error.message}`);
  return ((data ?? []) as FilRad[]).filter((f) => !arVarAdress(f.sender_email) && (medOvriga || f.sortering !== 'ovrigt'));
}

/**
 * Filer som inte är klara: inte lästa i Flöde än, eller där Flöde sa att
 * något saknas. Med det som saknas, så att sorteringen ser vad vi väntar på.
 */
async function oppna(supabase: SupabaseClient, userId: string, filer: FilRad[]): Promise<(FilRad & { saknas: string[] })[]> {
  const { data } = await supabase.from('transaktioner').select('underlag_id, tillrackligt')
    .eq('user_id', userId).eq('tillrackligt->>status', 'saknar').not('underlag_id', 'is', null).limit(2000);
  const saknas = new Map<string, string[]>();
  for (const t of data ?? []) {
    const vad = ((t.tillrackligt as { saknas?: { vad?: string }[] } | null)?.saknas ?? []).map((x) => String(x.vad ?? '')).filter(Boolean);
    saknas.set(t.underlag_id as string, [...(saknas.get(t.underlag_id as string) ?? []), ...vad]);
  }
  return filer.filter((f) => !arBokford(f)
    && kanLasasAvAi(f.file_name, f.mime_type) && !isSieFile(f.file_name)
    // Sidor som läses med en annan, och dokument som väntar på en sida, frågas om för sig
    && !f.del_av && !f.sidor_saknas?.length
    && (!f.flode_at || saknas.has(f.id)))
    .map((f) => ({ ...f, saknas: [...new Set(saknas.get(f.id) ?? [])] }));
}

/** Ämnet på mejlet varje fil kom med, så att AI:n ser vilket mejl som handlar om vilken fil. */
async function mejlamnen(supabase: SupabaseClient, filer: FilRad[]): Promise<Map<string, string>> {
  const ids = [...new Set(filer.map((f) => f.gmail_message_id).filter((x): x is string => !!x))];
  if (!ids.length) return new Map();
  const { data } = await supabase.from('mail_messages').select('gmail_message_id, subject').in('gmail_message_id', ids);
  return new Map((data ?? []).map((m) => [m.gmail_message_id as string, (m.subject as string) || '(inget ämne)']));
}

export interface Sortering {
  underlag: boolean;
  /** De redan inkomna filer mejlet gäller. Mejlets egna bilagor tas med ändå. */
  filer: string[];
}

/**
 * Handlar mejlet om underlag, och i så fall vilka filer? Bilagor räcker för
 * att det ska räknas som underlag, men AI:n får ändå peka ut äldre filer som
 * mejlet också handlar om.
 */
export async function arUnderlagsmejl(opts: {
  supabase: SupabaseClient;
  profil: Profil;
  amne: string;
  text: string;
  /** Mejlet som sorteras. Det står för sig och tas inte med i historiken. */
  messageId?: string;
  harBilagor: boolean;
}): Promise<Sortering> {
  try {
    const [filer, historik] = await Promise.all([
      kundensFiler(opts.supabase, opts.profil.id),
      byggMejlkontext(opts.supabase, { userId: opts.profil.id, emails: [opts.profil.email], utanMessageId: opts.messageId }),
    ]);
    const lista = (await oppna(opts.supabase, opts.profil.id, filer)).filter((f) => f.gmail_message_id !== opts.messageId);
    const amnen = await mejlamnen(opts.supabase, lista);
    const ref = new Map(lista.map((f, i) => [`F${i + 1}`, f.id]));

    const raw = await callOpenAI({
      model: MODELL,
      effort: 'low',
      anrop: { steg: 'underlag-sortering', userId: opts.profil.id },
      responseFormat: { type: 'json_object' },
      maxTokens: 4000,
      messages: [
        {
          role: 'system',
          content: `Du sorterar mejl till en bokföringsbyrå för enskilda firmor. Avgör om mejlet handlar om kundens UNDERLAG — kvitton, fakturor, kontoutdrag, kassarapporter och uppgifterna om dem — eller om det är något annat (en fråga om tjänsten, moms i allmänhet, priser, kontot, en hälsning).

Underlag är det också när det inte finns någon bilaga, till exempel:
- kunden svarar på en fråga vi ställt om ett kvitto eller en transaktion ("det var lunch med en kund", "momsen var 25 %", "datumet var 3 maj")
- kunden säger vilka rader på ett kontoutdrag som är privata
- kunden förklarar vad ett köp eller en insättning gällde
- kunden säger att underlaget kommer, eller att något underlag saknas

Handlar mejlet om underlag: peka ut vilka av kundens tidigare inskickade filer i listan det gäller. Ett svar handlar ofta om en fil som kom i ett annat mejl, så läs historiken. Kan du inte avgöra vilka filer det gäller, sätt "alla" till true. Handlar det bara om underlag som kommer senare, eller om bilagorna i just det här mejlet, är listan tom.

Svara med JSON: {"underlag": true eller false, "filer": ["F1", ...], "alla": true eller false, "varfor": "kort förklaring"}`,
        },
        {
          role: 'user',
          content: [
            lista.length
              ? `Kundens inskickade filer som inte är klara:\n${lista.map((f, i) => {
                const status = f.saknas.length ? `vi väntar på svar om: ${f.saknas.join(', ')}` : 'inte genomgången än';
                const mejl = f.gmail_message_id ? `kom med mejlet "${amnen.get(f.gmail_message_id) ?? '?'}"` : 'uppladdad';
                return `F${i + 1}: ${f.file_name} — ${String(f.created_at).slice(0, 10)}, ${mejl}, ${status}`;
              }).join('\n')}`
              : 'Kunden har inga inskickade filer som inte är klara.',
            historik || '',
            `MEJLET SOM SKA SORTERAS:\nÄmne: ${opts.amne || '(inget ämne)'}\n${opts.harBilagor ? '(har bilagor)\n' : ''}${opts.text.slice(0, 3000)}`,
          ].filter(Boolean).join('\n\n'),
        },
      ],
    });
    const svar = parseJSON<{ underlag?: boolean; filer?: string[]; alla?: boolean; varfor?: string }>(raw);
    const underlag = opts.harBilagor || svar.underlag === true;
    const valda = !underlag ? []
      : svar.alla ? lista.map((f) => f.id)
        : (svar.filer ?? []).map((r) => ref.get(r)).filter((x): x is string => !!x);
    console.log(`[underlag-kontroll] ${opts.profil.email}: ${underlag ? `underlag, ${valda.length} tidigare filer` : 'annat'} — ${svar.varfor ?? ''}`);
    return { underlag, filer: valda };
  } catch (err) {
    // Går sorteringen inte att göra tar det vanliga flödet mejlet, som förr —
    // utom när det har bilagor, de ska alltid kontrolleras
    console.error('[underlag-kontroll] sorteringen misslyckades:', err instanceof Error ? err.message : err);
    return { underlag: opts.harBilagor, filer: [] };
  }
}

/**
 * Ett underlagsmejl på väg genom flödet. Skickas mellan omgångarna, så allt
 * måste gå att göra JSON av.
 */
export interface UnderlagsJobb {
  profilId: string;
  avsandare: string;
  messageId: string;
  threadId: string;
  /**
   * Alla kundens nya mejl i tråden som flödet gäller, inte bara det senaste
   * (messageId). Skickar kunden fem mejl i rad i samma tråd ska filerna i
   * alla fem läsas ut.
   */
  meddelanden?: string[];
  amne: string;
  text: string;
  historik?: string;
  /** Tidigare inskickade filer som sorteringen sa att mejlet gäller. */
  filer?: string[];
  /**
   * 'manuell' när Erik bett om ett nytt utkast i inkorgen. Bara ett AI-utkast
   * får finnas per mejl, och det första finns redan.
   */
  kalla?: 'ai' | 'manuell';
  /** Utkastet som skrivs om. Kastas när det nya är skrivet, så att det gamla ligger kvar under tiden. */
  ersatterUtkast?: string;
}

/**
 * Lägger mejlet i kön (Vercel Queues), och /api/queues/underlagsflode skriver
 * svaret. Kön gör att mejlhanteringen inte väntar på AI:n.
 *
 * `bas` är adressen till appen själv. Den används bara när kön inte går att nå
 * (lokalt utan Vercel-inloggning), och då postas jobbet direkt till
 * /api/inmail/flode.
 */
export async function startaUnderlagsflode(bas: string, jobb: UnderlagsJobb): Promise<void> {
  try {
    await send<UnderlagsMeddelande>(UNDERLAGSFLODE_AMNE, { bas, jobb });
    return;
  } catch (err) {
    console.warn('[underlag-kontroll] kön gick inte att nå, postar jobbet direkt:', err instanceof Error ? err.message : err);
  }
  const res = await fetch(`${bas}/api/inmail/flode`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-inmail-secret': process.env.INMAIL_SECRET ?? '' },
    body: JSON.stringify(jobb),
  });
  if (!res.ok) throw new Error(`Underlagsflödet kunde inte startas: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

/** Ämnet i kön. Konsumenten är kopplad till det i vercel.json. */
export const UNDERLAGSFLODE_AMNE = 'underlagsflode';

/** Det som ligger i kön: jobbet, och appens adress om kön inte går att nå. */
export interface UnderlagsMeddelande { bas: string; jobb: UnderlagsJobb }

/** Mejlen flödet gäller: det senaste plus de andra nya i samma tråd. */
const mejlen = (jobb: UnderlagsJobb) => new Set([jobb.messageId, ...(jobb.meddelanden ?? [])]);

/**
 * Skriver svaret på ett underlagsmejl. Anropas av kön och /api/inmail/flode.
 * Jobb som låg i kön från före 2026-11-07 har kvar fälten steg och omgang;
 * de spelar ingen roll längre.
 */
export async function korUnderlagsomgang(supabase: SupabaseClient, _bas: string, jobb: UnderlagsJobb): Promise<void> {
  const { data: profil, error } = await supabase.from('profiles')
    .select('id, full_name, email').eq('id', jobb.profilId).maybeSingle<Profil>();
  if (error || !profil) {
    // Utan profil går det inte att skriva ett riktigt svar, men mejlet får
    // inte försvinna: ett utkast med felet hamnar i inkorgen och på översikten
    const fel = `Underlagsflödet hittade inte kundens profil (${error?.message ?? jobb.profilId}) — titta på underlaget i personkortet.`;
    console.error('[underlag-kontroll]', fel);
    await supabase.from('mejl_utkast').insert({
      till_email: jobb.avsandare.trim().toLowerCase(), amne: jobb.amne || null,
      text: 'Hej!\n\nTack för ditt mejl. Vi tittar på underlaget och återkommer.',
      gmail_thread_id: jobb.threadId, svar_pa_message_id: jobb.messageId, kalla: jobb.kalla ?? 'ai', fel,
    }).then(() => {}, () => {});
    return;
  }

  try {
    await svara(supabase, profil, jobb);
  } catch (err) {
    await reservutkast(supabase, profil, jobb, err);
  }
}

/** Mejlet sparas i mejlarkivet, där Flöde och nästa svar läser kundens mejl. */
async function sparaMejlet(supabase: SupabaseClient, jobb: UnderlagsJobb) {
  const email = jobb.avsandare.trim().toLowerCase();
  const raw = jobb.text.replace(/\r/g, '').slice(0, 50_000);
  await supabase.from('mail_messages').upsert({
    gmail_message_id: jobb.messageId, gmail_thread_id: jobb.threadId, direction: 'in',
    from_email: email, to_emails: [], customer_email: email, subject: jobb.amne || null,
    body: cleanBody(raw), body_raw: raw, attachment_names: [], sent_at: new Date().toISOString(),
  }, { onConflict: 'gmail_message_id', ignoreDuplicates: true });
}

async function svara(supabase: SupabaseClient, profil: Profil, opts: UnderlagsJobb) {
  const email = opts.avsandare.trim().toLowerCase();
  await sparaMejlet(supabase, opts);

  const filer = await kundensFiler(supabase, profil.id, { medOvriga: true });
  const egna = mejlen(opts);
  const valda = new Set(opts.filer ?? []);
  // Ett zip-arkiv är ingen fil för kunden — filerna i det står bland underlagen
  const nya = filer.filter((f) => egna.has(f.gmail_message_id ?? '') && !arZip(f.file_name, f.mime_type));
  const tidigare = filer.filter((f) => valda.has(f.id) && !egna.has(f.gmail_message_id ?? ''));

  // Kundens svar gäller filer vi redan har — de ska köras om i Flöde med svaret
  if (tidigare.length) {
    await supabase.from('bokforing_underlag').update({ kund_svar_at: new Date().toISOString() }).in('id', tidigare.map((f) => f.id));
  }

  // Bilagor som redan sorterats bort är inte borttappade — kunden ska inte bli ombedd att skicka dem igen
  const ovriga = nya.filter((f) => f.sortering === 'ovrigt').map((f) => f.file_name);
  const underlag = nya.filter((f) => f.sortering !== 'ovrigt').map((f) => f.file_name);
  const underlagKontext = [
    underlag.length
      ? `UNDERLAG: kunden skickar ${underlag.join(', ')}. Vi går igenom underlaget senare och mejlar separat om något saknas. Fråga INTE efter uppgifter om underlaget nu, och lova inget om när det är klart.`
      : '',
    tidigare.length
      ? `KUNDENS SVAR: mejlet gäller underlag kunden skickat tidigare (${tidigare.map((f) => f.file_name).join(', ')}). Det kunden skriver tas med när vi går igenom dem igen. Fråga inte efter mer nu.`
      : '',
    !underlag.length && !tidigare.length
      ? 'UNDERLAG: mejlet handlar om underlag, men har inga bilagor och gäller inga filer vi kunde peka ut. Svara på det kunden skriver, och be om underlaget om det behövs.'
      : '',
    ovriga.length
      ? `ÖVRIGA FILER: ${ovriga.join(', ')} är inga underlag för bokföringen (till exempel en NE-bilaga, ett avtal eller ett brev). De är sparade hos oss som övriga filer.`
      : '',
  ].filter(Boolean).join('\n\n');

  // Skickar kunden bara underlag, eller svarar på våra frågor, behövs inget
  // svar. Då skrivs inget utkast. När Erik själv bett om ett utkast skrivs det ändå.
  const inget = opts.kalla !== 'manuell'
    ? `\n\nINGET SVAR BEHÖVS om kunden bara skickar in underlag eller svarar på våra frågor: kunden behöver ingen bekräftelse. Svara då med exakt ${INGET_SVAR} och ingenting annat. Skriv ett vanligt svar bara om kunden i mejlet ställer en fråga eller ber om något som behöver ett svar, och svara då bara på det.`
    : '';

  const svar = await handleGeneralQuestion({
    supabase, profile: profil, subject: opts.amne, body: opts.text, messageId: opts.messageId,
    emailHistory: opts.historik, smsKontext: await smsKontextForMejl(supabase, email), underlagKontext: underlagKontext + inget,
    attachmentNames: nya.map((f) => f.file_name),
  });

  const text = svar.replyBody?.trim();
  if (!text) throw new Error('AI:n skrev inget svar');
  if (inget && text.includes(INGET_SVAR)) {
    console.log(`[underlag-kontroll] ${email}: ${nya.length} nya filer, ${tidigare.length} besvarade, inget att svara på — inget utkast`);
    return;
  }
  const { error } = await supabase.from('mejl_utkast').insert({
    till_email: email, amne: opts.amne || null, text,
    gmail_thread_id: opts.threadId, svar_pa_message_id: opts.messageId, kalla: opts.kalla ?? 'ai',
  });
  if (error && error.code !== '23505') throw new Error(error.message);
  await kastaErsatt(supabase, opts);
  console.log(`[underlag-kontroll] ${email}: ${nya.length} nya filer, ${tidigare.length} besvarade, utkast skrivet`);
}

/**
 * Kunden får inte bli utan svar för att flödet fallerade. Ett vanligt
 * svar skrivs i stället, och felet står vid utkastet så att det syns att
 * underlaget inte är kontrollerat.
 */
async function reservutkast(supabase: SupabaseClient, profil: Profil, opts: UnderlagsJobb, err: unknown) {
  const email = opts.avsandare.trim().toLowerCase();
  const message = err instanceof Error ? err.message : String(err);
  console.error('[underlag-kontroll] flödet misslyckades:', message);
  const fel = `Underlagsflödet misslyckades (${message}) — titta på underlaget i personkortet innan du skickar.`;
  const reserv = await handleGeneralQuestion({
    supabase, profile: profil, subject: opts.amne, body: opts.text, emailHistory: opts.historik, messageId: opts.messageId,
  }).catch(() => null);
  await supabase.from('mejl_utkast').insert({
    till_email: email, amne: opts.amne || null,
    text: reserv?.replyBody?.trim() || 'Hej!\n\nTack för ditt mejl. Vi tittar på underlaget och återkommer.',
    gmail_thread_id: opts.threadId, svar_pa_message_id: opts.messageId, kalla: opts.kalla ?? 'ai', fel,
  }).then(() => kastaErsatt(supabase, opts), () => {});
}

/** Det gamla utkastet när Erik bett om ett nytt, och bara om det fortfarande är ett utkast. */
async function kastaErsatt(supabase: SupabaseClient, opts: UnderlagsJobb) {
  if (!opts.ersatterUtkast) return;
  await supabase.from('mejl_utkast').update({ status: 'discarded', updated_at: new Date().toISOString() })
    .eq('id', opts.ersatterUtkast).eq('status', 'draft');
}
