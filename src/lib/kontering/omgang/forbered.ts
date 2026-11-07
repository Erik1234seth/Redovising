import type { SupabaseClient } from '@supabase/supabase-js';
import { KUND_KOLUMNER, byggKundkontext, type Kund } from '@/lib/ai-test/kundkontext';
import { iKo } from '@/lib/ai-anrop';
import { byggMejlkontext } from '@/lib/mejlkontext';
import { reglerAttValja } from '@/lib/transaktioner/kundregler';
import { hamtaInstruktioner, kontextFor, reglerFor, type Instruktion } from '@/lib/transaktioner/instruktioner';
import { tolkaBetalsatt, type Betalsatt } from '../betalsatt';
import { hamtaArslista, hamtaKundbild, verifikationsSammanfattning } from '../kundbild';
import { laddaK1Andringar } from '../k1-andringar';
import { instruktionensTokens, byggKropp, type Indatafil } from './anrop';
import { kontrolleraFil, uppskattadeTokens, type Forberedd, type Underlagsrad } from './filer';
import { laddaUpp } from './openai';

/**
 * Förbereder en omgång för en kund: kontrollerar filerna, bygger kunddelen,
 * delar upp underlagen i anrop och laddar upp filerna till OpenAI.
 *
 * Ett anrop får inte bli för stort. Över 272 000 tokens in tar OpenAI dubbelt
 * betalt, och svaret har ett tak på 128 000 tokens med tänkandet. Därför
 * delas underlagen i delar med högst MAX_FILER filer och en tokenbudget.
 * Underlagen tas i den ordning de kom in, så att sidor som kom i samma mejl
 * hamnar i samma del.
 */

/** Under OpenAIs gräns på 272 000, med marginal för att uppskattningen är grov. */
const TOKENTAK = 255_000;
const MAX_FILER = 30;
/** OpenAIs gräns är 50 MB filer per anrop. Bilder räknas inte in, men vi räknar allt för säkerhets skull. */
const MAX_BYTE_PER_ANROP = 45 * 1024 * 1024;
/** Så här många tokens får filerna minst, även när kunddelen är stor. */
const MIN_FILBUDGET = 40_000;
const SAMTIDIGA_UPPLADDNINGAR = 5;

export interface Filpost {
  fil: string;
  underlagId: string;
  namn: string;
  fileId: string | null;
}

export interface Anropsdel {
  filer: Filpost[];
  kropp: object;
  tokens: number;
}

/** Det som behövs när svaret kommer tillbaka. */
export interface Kontext {
  betalsatt: Betalsatt;
  regelIdn: string[];
  /** K-nummer i kundens lista → transaktionens id. */
  kNummer: Record<string, string>;
}

export interface Hoppad {
  underlagId: string;
  namn: string;
  orsak: string;
  /** Visas som varning. Tysta (mejl, zip, SIE) visas bara i listan. */
  varning: boolean;
}

export interface Forberedelse {
  delar: Anropsdel[];
  hoppade: Hoppad[];
  kontext: Kontext;
}

const UNDERLAG_KOLUMNER = 'id, file_name, file_path, mime_type, file_size, created_at, source, gmail_message_id';

const DAG = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' });

function kallaText(u: Underlagsrad): string {
  if (u.source === 'mejl') return 'via mejl';
  if (u.source === 'admin') return 'uppladdad av byrån';
  return u.source ? `via ${u.source}` : '';
}

/**
 * Kundbilden skrevs mot en äldre lista, så dess radnummer (K12, K40–K45)
 * pekar på fel rader här. De tas bort; texten runt dem står kvar.
 */
export function utanRadnummer(text: string): string {
  const nr = String.raw`K\d+(?:\s*[–-]\s*K?\d+)?`;
  return text
    .replace(new RegExp(String.raw`\s*\((?:\s*(?:se|t\.ex\.|jfr)?\s*${nr}\s*[,;]?\s*(?:och\s*)?)+\)`, 'gi'), '')
    .replace(new RegExp(String.raw`(?:\b(?:i|på|se|jfr|raderna|raden)\s+)?\b${nr}\b`, 'g'), '')
    .replace(/[ \t]+([,.;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}

/** Kunddelen av anropet: lika för alla delar i omgången. */
async function kunddel(
  supabase: SupabaseClient, userId: string, kund: Kund | null, betalsatt: Betalsatt,
  instruktioner: Instruktion[], utanUnderlag: Set<string>,
): Promise<{ text: string; regelIdn: string[]; kNummer: Record<string, string> }> {
  const regler = reglerFor(instruktioner, userId);
  const [kundbild, arslista, mejl, bokfort] = await Promise.all([
    hamtaKundbild(supabase, userId),
    hamtaArslista(supabase, userId, { medKonton: true, utanUnderlag }),
    byggMejlkontext(supabase, { userId, emails: [kund?.email] }),
    verifikationsSammanfattning(supabase, userId),
  ]);
  const kontext = kontextFor(instruktioner, { id: '', underlag_id: null, user_id: userId });
  const text = [
    `KUNDEN:\n${byggKundkontext(kund)}\nBetalar via: ${betalsatt === 'privatkonto' ? 'privatkonto' : 'företagskonto'}`,
    kundbild ? `KUNDBILDEN:\n${utanRadnummer(kundbild)}` :'KUNDBILDEN: inte sammanställd än — utgå från kundens transaktioner nedan.',
    kontext,
    `KUNDREGLER:\n${reglerAttValja(regler)}`,
    bokfort,
    mejl,
    `KUNDENS TRANSAKTIONER (${arslista.rader.length} st, äldst först):\n${arslista.text || '(inga)'}`,
  ].filter(Boolean).join('\n\n');
  const kNummer = Object.fromEntries([...arslista.nummer].map(([id, nr]) => [`K${nr}`, id]));
  return { text, regelIdn: regler.map((r) => r.id), kNummer };
}

/**
 * Byråns kontext som gäller ett underlag: skriven på underlaget, eller på en
 * transaktion som lästs ut ur det förut. Står på filens rubrikrad.
 */
function underlagetsKontext(instruktioner: Instruktion[], underlagId: string, gamlaTransaktioner: string[]): string {
  const rader = instruktioner.filter((i) => i.typ === 'kontext'
    && ((i.omfang === 'underlag' && i.underlag_id === underlagId) || (i.omfang === 'transaktion' && !!i.transaktion_id && gamlaTransaktioner.includes(i.transaktion_id))))
    .map((i) => `- ${i.text}`);
  return rader.length ? `BYRÅNS KONTEXT för filen (följ den):\n${rader.join('\n')}` : '';
}

export async function forberedOmgang(
  supabase: SupabaseClient,
  userId: string,
  underlagIds: string[],
): Promise<Forberedelse> {
  // Byråns ändringar i kontobeskrivningarna gäller från och med nu
  await laddaK1Andringar(supabase);
  const { data: profil, error: profilFel } = await supabase.from('profiles').select(KUND_KOLUMNER).eq('id', userId).maybeSingle();
  if (profilFel) throw new Error(`Kunde inte läsa kunden: ${profilFel.message}`);
  const kund = profil as unknown as Kund | null;
  const betalsatt = tolkaBetalsatt(kund?.har_foretagskonto ?? null);
  if (!betalsatt) throw new Error('Välj först om kunden betalar via företagskonto eller privatkonto (Kundkontext).');

  const { data: rader, error } = await supabase.from('bokforing_underlag').select(UNDERLAG_KOLUMNER)
    .eq('user_id', userId).in('id', underlagIds).order('created_at');
  if (error) throw new Error(`Kunde inte läsa underlagen: ${error.message}`);
  const underlag = (rader ?? []) as Underlagsrad[];
  if (!underlag.length) throw new Error('Inga underlag valda');

  // Transaktioner som lästs ut ur underlagen förut: deras kontext följer med filen
  const { data: gamla } = await supabase.from('transaktioner').select('id, underlag_id').in('underlag_id', underlag.map((u) => u.id));
  const gamlaPer = new Map<string, string[]>();
  for (const g of gamla ?? []) gamlaPer.set(g.underlag_id, [...(gamlaPer.get(g.underlag_id) ?? []), g.id]);

  const instruktioner = await hamtaInstruktioner(supabase, { userId, underlagIds: underlag.map((u) => u.id) });
  const kunden = await kunddel(supabase, userId, kund, betalsatt, instruktioner, new Set(underlag.map((u) => u.id)));

  // Kontrollen: varje fil laddas ner och prövas
  const hoppade: Hoppad[] = [];
  const godkanda: { u: Underlagsrad; fil: Forberedd }[] = [];
  const kontroller = await iKo(underlag, SAMTIDIGA_UPPLADDNINGAR, (u) => kontrolleraFil(supabase, u));
  underlag.forEach((u, i) => {
    const k = kontroller[i];
    if (k.ok) godkanda.push({ u, fil: k.fil });
    else hoppade.push({ underlagId: u.id, namn: u.file_name, orsak: k.orsak, varning: !k.tyst });
  });

  // Delarna: filbudgeten är det som blir kvar efter instruktionen och kunden
  const fast = instruktionensTokens() + Math.ceil(kunden.text.length / 3.5);
  const budget = Math.max(MIN_FILBUDGET, TOKENTAK - fast);
  const grupper: { u: Underlagsrad; fil: Forberedd }[][] = [];
  let tokens = 0, byte = 0;
  for (const g of godkanda) {
    const t = uppskattadeTokens(g.fil);
    const b = g.fil.typ === 'text' ? 0 : g.fil.bytes.length;
    const sista = grupper[grupper.length - 1];
    if (!sista || sista.length >= MAX_FILER || tokens + t > budget || byte + b > MAX_BYTE_PER_ANROP) {
      grupper.push([g]);
      tokens = t; byte = b;
    } else {
      sista.push(g);
      tokens += t; byte += b;
    }
  }

  const delar: Anropsdel[] = [];
  for (const grupp of grupper) {
    const uppladdade = await iKo(grupp, SAMTIDIGA_UPPLADDNINGAR, async ({ u, fil }) => {
      try {
        if (fil.typ === 'text') return { u, fil, fileId: null as string | null };
        const fileId = await laddaUpp(u.file_name, fil.bytes, fil.mime, fil.typ === 'bild' ? 'vision' : 'user_data');
        return { u, fil, fileId };
      } catch (err) {
        hoppade.push({ underlagId: u.id, namn: u.file_name, orsak: err instanceof Error ? err.message : String(err), varning: true });
        return null;
      }
    });
    const klara = uppladdade.filter((x): x is NonNullable<typeof x> => !!x);
    if (!klara.length) continue;

    const filer: Filpost[] = [];
    const indata: Indatafil[] = klara.map(({ u, fil, fileId }, i) => {
      const nr = `F${i + 1}`;
      filer.push({ fil: nr, underlagId: u.id, namn: u.file_name, fileId });
      const sidor = fil.typ === 'dokument' && fil.sidor && fil.sidor > 1 ? `, ${fil.sidor} sidor` : '';
      const kontext = underlagetsKontext(instruktioner, u.id, gamlaPer.get(u.id) ?? []);
      const rubrik = [`${nr}: ${u.file_name} — inkom ${DAG.format(new Date(u.created_at))} ${kallaText(u)}${sidor}`.trim(), kontext].filter(Boolean).join('\n');
      return {
        fil: nr,
        rubrik,
        innehall: fil.typ === 'text' ? { typ: 'text', text: fil.text }
          : fil.typ === 'bild' ? { typ: 'bild', fileId: fileId! }
          : { typ: 'dokument', fileId: fileId!, namn: u.file_name },
      };
    });
    delar.push({
      filer,
      kropp: byggKropp(kunden.text, indata, kunden.regelIdn),
      tokens: fast + klara.reduce((s, k) => s + uppskattadeTokens(k.fil), 0),
    });
  }

  return { delar, hoppade, kontext: { betalsatt, regelIdn: kunden.regelIdn, kNummer: kunden.kNummer } };
}
