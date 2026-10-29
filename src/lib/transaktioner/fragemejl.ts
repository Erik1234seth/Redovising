import type { SupabaseClient } from '@supabase/supabase-js';
import { handleGeneralQuestion } from '@/lib/inmail/handlers/general-question';
import { smsKontextForMejl } from '@/lib/inkorg/kontext';
import type { Tillrackligt } from './tillrackligt';
import { hamtaInstruktioner, kontextFor, reglerText } from './instruktioner';
import { svenskDag } from '@/lib/dagskassa';

/**
 * Steget "Skriv mail" i flödesschemat: frågemejlet till kunden om det som
 * saknas efter "Tillräckligt?".
 *
 * Frågorna samlas per kund, och kunden får ett mejl per dygn med alla
 * transaktioner vi har frågor om — inte ett mejl per underlag. Apps Script
 * (fragemejl.gs) kör `skrivAllaFragemejl` kl 18 varje dag; i flödesschemat
 * går det att skriva en kunds mejl direkt.
 *
 * Mejlet blir ett utkast i inkorgen — inget går ut förrän någon trycker
 * Skicka där. Samma AI som svarar på kundernas mejl skriver det, med hela
 * mejlhistoriken, så att den inte frågar om sådant kunden redan svarat på.
 *
 * Vilket mejl en transaktion frågats om i står i `fraga_utkast_id`. Den
 * frågas om igen bara om utkastet aldrig skickades: ett kvarliggande utkast
 * från igår slängs och dess frågor kommer med i dagens.
 *
 * Samma mejl ber om sidor som saknas i ett dokument som skannats sida för
 * sida (`bokforing_underlag.sidor_saknas`, se `@/lib/underlag/sidor`). Där
 * väntar vi ett dygn — sidan kommer ofta strax efter — så ett underlag som
 * kom in i dag frågas om först kl 18 i morgon.
 */

interface Sidfraga {
  id: string;
  user_id: string;
  file_name: string;
  created_at: string;
  definition: { dokumenttyp?: string; dokumentnummer?: string | null; motpart?: string | null; datum?: string | null; antalSidor?: number | null } | null;
  sidor_saknas: number[];
  sidor_fraga_utkast_id: string | null;
}

interface Rad {
  id: string;
  user_id: string;
  underlag_id: string | null;
  datum: string | null;
  beskrivning: string | null;
  motpart: string | null;
  belopp: number;
  valuta: string | null;
  riktning: string;
  tillrackligt: Tillrackligt | null;
  fraga_utkast_id: string | null;
}

const kr = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Utkast som inte gått iväg. Deras frågor är inte ställda. */
const EJ_SKICKAD = ['draft', 'discarded', 'failed'];

/** Transaktionerna vi har frågor om och inte frågat om än, för en kund eller alla. */
async function fragorAttStalla(supabase: SupabaseClient, userId?: string): Promise<Rad[]> {
  let q = supabase.from('transaktioner')
    .select('id, user_id, underlag_id, datum, beskrivning, motpart, belopp, valuta, riktning, tillrackligt, fraga_utkast_id')
    .eq('tillrackligt->>status', 'saknar').is('dublett_av', null).not('user_id', 'is', null)
    .order('datum', { ascending: true }).limit(1000);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rader = ((data ?? []) as Rad[]).filter((t) => t.tillrackligt?.saknas?.length);
  if (!rader.length) return [];

  const ids = rader.map((t) => t.id);
  const utkastIds = [...new Set(rader.map((t) => t.fraga_utkast_id).filter(Boolean))] as string[];
  const [{ data: verif, error: vFel }, { data: utkast, error: uFel }] = await Promise.all([
    supabase.from('verifikationer').select('transaktion_id').in('transaktion_id', ids),
    utkastIds.length ? supabase.from('mejl_utkast').select('id, status').in('id', utkastIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (vFel ?? uFel) throw new Error((vFel ?? uFel)!.message);
  // Bokförd för hand ändå: då finns inget att fråga om
  const bokforda = new Set((verif ?? []).map((v) => v.transaktion_id));
  const stalld = new Set((utkast ?? []).filter((u) => !EJ_SKICKAD.includes(u.status)).map((u) => u.id));
  rader = rader.filter((t) => !bokforda.has(t.id) && !(t.fraga_utkast_id && stalld.has(t.fraga_utkast_id)));
  return rader;
}

/** Dokument där sidor saknas, inkomna före i dag och inte frågade om än. */
async function sidorAttFraga(supabase: SupabaseClient, userId?: string): Promise<Sidfraga[]> {
  let q = supabase.from('bokforing_underlag')
    .select('id, user_id, file_name, created_at, definition, sidor_saknas, sidor_fraga_utkast_id')
    .not('sidor_saknas', 'is', null).is('del_av', null).not('user_id', 'is', null).limit(500);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const idag = svenskDag(new Date());
  let rader = ((data ?? []) as Sidfraga[]).filter((u) => u.sidor_saknas?.length && svenskDag(new Date(u.created_at)) < idag);

  const utkastIds = [...new Set(rader.map((u) => u.sidor_fraga_utkast_id).filter(Boolean))] as string[];
  if (utkastIds.length) {
    const { data: utkast, error: uFel } = await supabase.from('mejl_utkast').select('id, status').in('id', utkastIds);
    if (uFel) throw new Error(uFel.message);
    const stalld = new Set((utkast ?? []).filter((u) => !EJ_SKICKAD.includes(u.status)).map((u) => u.id));
    rader = rader.filter((u) => !(u.sidor_fraga_utkast_id && stalld.has(u.sidor_fraga_utkast_id)));
  }
  return rader;
}

/**
 * Skriver kundens frågemejl som ett utkast i inkorgen. Null när det inte
 * finns något att fråga om.
 */
export async function skrivFragemejl(
  supabase: SupabaseClient,
  userId: string,
  rader?: Rad[],
  sidfragor?: Sidfraga[],
): Promise<{ utkastId: string; antal: number } | null> {
  const fragor = rader ?? await fragorAttStalla(supabase, userId);
  const sidor = sidfragor ?? await sidorAttFraga(supabase, userId);
  if (!fragor.length && !sidor.length) return null;

  const underlagIds = [...new Set([...fragor.map((t) => t.underlag_id), ...sidor.map((u) => u.id)].filter(Boolean))] as string[];
  const [{ data: profil }, { data: underlag, error: uFel }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('id', userId).maybeSingle(),
    underlagIds.length
      ? supabase.from('bokforing_underlag').select('id, file_name, sender_email, gmail_message_id, created_at').in('id', underlagIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (uFel) throw new Error(uFel.message);
  if (!profil) throw new Error('Kunden finns inte');
  const filer = new Map((underlag ?? []).map((u) => [u.id, u]));
  const instruktioner = await hamtaInstruktioner(supabase, { userId, underlagIds });

  // Kom allt i samma mejl blir det ett svar i den tråden, annars ett nytt mejl
  const mejlIds = [...new Set((underlag ?? []).map((u) => u.gmail_message_id))];
  const ettMejl = fragor.every((t) => t.underlag_id) && mejlIds.length === 1 ? mejlIds[0] : null;
  const { data: mejl } = ettMejl
    ? await supabase.from('mail_messages').select('gmail_message_id, gmail_thread_id, subject, body').eq('gmail_message_id', ettMejl).maybeSingle()
    : { data: null };
  // Till adressen kunden senast skickade underlag från, annars kontots
  const senaste = [...(underlag ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .find((u) => u.sender_email?.trim());
  const till = (senaste?.sender_email?.trim() || profil.email?.trim() || '').toLowerCase();
  if (!till) throw new Error('Kunden har ingen mejladress');
  const amne = mejl ? (mejl.subject?.trim() || '') : 'Några uppgifter saknas för bokföringen';

  // Grupperat per underlag, så att kunden ser vilket kvitto eller utdrag det gäller
  const perFil = new Map<string, Rad[]>();
  for (const t of fragor) perFil.set(t.underlag_id ?? '', [...(perFil.get(t.underlag_id ?? '') ?? []), t]);
  const block = [...perFil].map(([id, rader]) => {
    const f = filer.get(id);
    const rubrik = f ? `${f.file_name} (inskickat ${String(f.created_at).slice(0, 10)})` : 'Utan fil (bankkopplingen eller kassasystemet)';
    return `${rubrik}:\n${rader.map((t) => {
      const vem = [t.motpart, t.beskrivning].filter(Boolean).join(', ') || 'okänd transaktion';
      const belopp = `${kr.format(Number(t.belopp))} ${t.valuta && t.valuta !== 'SEK' ? t.valuta : 'kr'}`;
      const vad = t.tillrackligt!.saknas.map((s) => `${s.vad} (${s.varfor})`).join('; ');
      const kontext = kontextFor(instruktioner, t);
      return `    • ${t.datum ?? 'okänt datum'}, ${vem}, ${belopp}${t.riktning === 'in' ? ' in' : ''}: ${vad}${kontext ? `\n      ${kontext.replace(/\n/g, '\n      ')}` : ''}`;
    }).join('\n')}`;
  });
  const sidblock = sidor.map((u) => {
    const d = u.definition;
    const vad = [d?.dokumenttyp || 'Underlag', d?.dokumentnummer ? `nr ${d.dokumentnummer}` : '', d?.motpart ? `från ${d.motpart}` : '', d?.datum ? `daterat ${d.datum}` : '']
      .filter(Boolean).join(' ');
    return `    • ${vad} (${u.file_name}, inskickat ${String(u.created_at).slice(0, 10)}): vi har inte fått sida ${u.sidor_saknas.join(', ')} av ${d?.antalSidor ?? '?'}`;
  });
  const underlagKontext = (fragor.length ? `TRANSAKTIONER SOM SAKNAR UPPGIFTER (${fragor.length} st):\n${block.join('\n\n')}\n\n` : '')
    + (sidor.length ? `UNDERLAG DÄR SIDOR SAKNAS (${sidor.length} st) — be kunden skicka de saknade sidorna, gärna som foto:\n${sidblock.join('\n')}\n\n` : '')
    + 'Skriv ETT mejl till kunden och fråga efter just det som saknas ovan, för alla transaktionerna och underlagen. Gå igenom dem en och en, '
    + 'med datum, motpart och belopp så att kunden ser vilken det gäller. '
    + 'Är det samma fråga för flera transaktioner — till exempel om bilen i verksamheten är firmans eller privat — ställer du den en gång, '
    + 'med transaktionerna den gäller uppräknade kort under, i stället för att upprepa frågan för varje. Förklara kort och begripligt varför vi behöver det — '
    + 'utan facktermer där det går. Be kunden svara på mejlet. Fråga inte om något annat, och aldrig om sådant kunden redan svarat på i mejlhistoriken. '
    + 'Står det BYRÅNS KONTEXT eller BYRÅNS REGLER följer du dem — fråga inte om sådant de redan besvarar.'
    + (reglerText(instruktioner, userId) ? `\n\n${reglerText(instruktioner, userId)}` : '');

  const svar = await handleGeneralQuestion({
    supabase, profile: profil, subject: amne,
    body: mejl?.body ?? '(Kunden har inte skrivit något nytt. Vi skriver till kunden om underlag som saknar uppgifter.)',
    messageId: mejl?.gmail_message_id ?? undefined,
    smsKontext: await smsKontextForMejl(supabase, till),
    underlagKontext,
  });
  const text = svar.replyBody?.trim();
  if (!text) throw new Error('AI:n skrev inget');

  // Gamla utkast som aldrig skickades ersätts av det här
  const gamla = [...new Set([...fragor.map((t) => t.fraga_utkast_id), ...sidor.map((u) => u.sidor_fraga_utkast_id)].filter(Boolean))] as string[];
  if (gamla.length) {
    await supabase.from('mejl_utkast').update({ status: 'discarded', updated_at: new Date().toISOString() })
      .in('id', gamla).eq('status', 'draft');
  }
  // 'manuell': ett AI-utkast som svar på mejlet finns ofta redan, och det får bara finnas ett sådant
  const { data: utkast, error } = await supabase.from('mejl_utkast').insert({
    till_email: till, amne: amne || null, text,
    gmail_thread_id: mejl?.gmail_thread_id ?? null, svar_pa_message_id: mejl?.gmail_message_id ?? null, kalla: 'manuell',
  }).select('id').single();
  if (error) throw new Error(error.message);

  if (fragor.length) {
    const { error: tFel } = await supabase.from('transaktioner').update({ fraga_utkast_id: utkast.id }).in('id', fragor.map((t) => t.id));
    if (tFel) throw new Error(tFel.message);
  }
  if (sidor.length) {
    const { error: sFel } = await supabase.from('bokforing_underlag').update({ sidor_fraga_utkast_id: utkast.id }).in('id', sidor.map((u) => u.id));
    if (sFel) throw new Error(sFel.message);
  }
  return { utkastId: utkast.id, antal: fragor.length + sidor.length };
}

/** Dygnets körning: ett frågemejl per kund som har något att fråga om. */
export async function skrivAllaFragemejl(supabase: SupabaseClient): Promise<{ kunder: number; transaktioner: number; fel: string[] }> {
  const [alla, allaSidor] = await Promise.all([fragorAttStalla(supabase), sidorAttFraga(supabase)]);
  const perKund = new Map<string, { rader: Rad[]; sidor: Sidfraga[] }>();
  const kund = (id: string) => perKund.get(id) ?? perKund.set(id, { rader: [], sidor: [] }).get(id)!;
  for (const t of alla) kund(t.user_id).rader.push(t);
  for (const u of allaSidor) kund(u.user_id).sidor.push(u);

  const res = { kunder: 0, transaktioner: 0, fel: [] as string[] };
  for (const [userId, { rader, sidor }] of perKund) {
    try {
      const r = await skrivFragemejl(supabase, userId, rader, sidor);
      if (r) { res.kunder++; res.transaktioner += r.antal; }
    } catch (e) {
      res.fel.push(`${userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return res;
}
