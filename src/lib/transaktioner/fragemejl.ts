import type { SupabaseClient } from '@supabase/supabase-js';
import { handleGeneralQuestion } from '@/lib/inmail/handlers/general-question';
import { smsKontextForMejl } from '@/lib/inkorg/kontext';
import type { Tillrackligt } from './tillrackligt';

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
 */

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

/**
 * Skriver kundens frågemejl som ett utkast i inkorgen. Null när det inte
 * finns något att fråga om.
 */
export async function skrivFragemejl(supabase: SupabaseClient, userId: string, rader?: Rad[]): Promise<{ utkastId: string; antal: number } | null> {
  const fragor = rader ?? await fragorAttStalla(supabase, userId);
  if (!fragor.length) return null;

  const underlagIds = [...new Set(fragor.map((t) => t.underlag_id).filter(Boolean))] as string[];
  const [{ data: profil }, { data: underlag, error: uFel }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('id', userId).maybeSingle(),
    underlagIds.length
      ? supabase.from('bokforing_underlag').select('id, file_name, sender_email, gmail_message_id, created_at').in('id', underlagIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (uFel) throw new Error(uFel.message);
  if (!profil) throw new Error('Kunden finns inte');
  const filer = new Map((underlag ?? []).map((u) => [u.id, u]));

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
      return `    • ${t.datum ?? 'okänt datum'}, ${vem}, ${belopp}${t.riktning === 'in' ? ' in' : ''}: ${vad}`;
    }).join('\n')}`;
  });
  const underlagKontext = `TRANSAKTIONER SOM SAKNAR UPPGIFTER (${fragor.length} st):\n${block.join('\n\n')}\n\n`
    + 'Skriv ETT mejl till kunden och fråga efter just det som saknas ovan, för alla transaktionerna. Gå igenom dem en och en, '
    + 'med datum, motpart och belopp så att kunden ser vilken det gäller. Förklara kort och begripligt varför vi behöver det — '
    + 'utan facktermer där det går. Be kunden svara på mejlet. Fråga inte om något annat, och aldrig om sådant kunden redan svarat på i mejlhistoriken.';

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
  const gamla = [...new Set(fragor.map((t) => t.fraga_utkast_id).filter(Boolean))] as string[];
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

  const { error: tFel } = await supabase.from('transaktioner').update({ fraga_utkast_id: utkast.id }).in('id', fragor.map((t) => t.id));
  if (tFel) throw new Error(tFel.message);
  return { utkastId: utkast.id, antal: fragor.length };
}

/** Dygnets körning: ett frågemejl per kund som har något att fråga om. */
export async function skrivAllaFragemejl(supabase: SupabaseClient): Promise<{ kunder: number; transaktioner: number; fel: string[] }> {
  const alla = await fragorAttStalla(supabase);
  const perKund = new Map<string, Rad[]>();
  for (const t of alla) perKund.set(t.user_id, [...(perKund.get(t.user_id) ?? []), t]);

  const res = { kunder: 0, transaktioner: 0, fel: [] as string[] };
  for (const [userId, rader] of perKund) {
    try {
      const r = await skrivFragemejl(supabase, userId, rader);
      if (r) { res.kunder++; res.transaktioner += r.antal; }
    } catch (e) {
      res.fel.push(`${userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return res;
}
