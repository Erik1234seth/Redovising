import type { SupabaseClient } from '@supabase/supabase-js';
import { KUND_KOLUMNER, byggKundkontext, type Kund } from '@/lib/ai-test/kundkontext';
import { iKo } from '@/lib/ai-anrop';
import { byggMejlkontext } from '@/lib/mejlkontext';
import { reglerAttValja } from '@/lib/transaktioner/kundregler';
import { hamtaInstruktioner, kontextFor, reglerFor, type Instruktion } from '@/lib/transaktioner/instruktioner';
import { tolkaBetalsatt, type Betalsatt } from '../betalsatt';
import { bokfordaVerifikationer, hamtaArslista, hamtaKundbild, verifikationsSammanfattning } from '../kundbild';
import { laddaK1Andringar } from '../k1-andringar';
import { instruktionensTokens, type Indatafil } from './anrop';
import { kontrolleraFil, uppskattadeTokens, type Forberedd, type Underlagsrad } from './filer';
import type { Leverantor } from './leverantor';

/**
 * Förbereder en omgång för en kund: kontrollerar filerna, bygger kunddelen,
 * delar upp underlagen i anrop och laddar upp filerna till modellens
 * leverantör (./leverantor: OpenAI eller Claude).
 *
 * Helst läses hela omgången i ett anrop, så att en kontoutdragsrad och kvittot
 * till den ses tillsammans. Över 272 000 tokens in tar OpenAI dubbelt betalt —
 * det är värt det. Gränserna som återstår är modellens fönster (1 050 000
 * tokens, varav svaret får 128 000 med tänkandet) och 50 MB filer per anrop.
 * Bara över dem delas underlagen, i delar med högst så många filer som
 * leverantören tar (maxFiler) och en tokenbudget.
 *
 * Ingen sida får tappa sitt dokument för att omgången delas:
 * - Ordningen (iOrdning): filerna i samma mejl eller samma uppladdning hålls
 *   ihop och sorteras på namnet, så att "Skanning (33)" och "Skanning (34)"
 *   ligger bredvid varandra. Uppladdningstiden duger inte — filerna laddas upp
 *   parallellt och kommer in huller om buller.
 * - Grannsidorna: varje del får också de GRANNAR filerna närmast före och
 *   efter sig ur samma mejl eller uppladdning, som sammanhang. Ett dokument
 *   som delas av gränsen läses i delen där det börjar, med sidorna efter, och
 *   delen efter sätter sin sida som del_av dokumentets första sida.
 */

/** Under modellens 922 000 tokens in, med marginal för att uppskattningen är grov. */
const TOKENTAK = 800_000;
/** Så många filer på var sida om en del följer med som grannsidor. Ett dokument på upp till fyra sidor klarar gränsen. */
const GRANNAR = 3;
/** Plats som hålls för grannsidorna: sex bilder. */
const GRANNRESERV = 2 * GRANNAR * 1_700;
/** Filer som laddats upp med mindre mellanrum än så räknas som samma uppladdning. */
const SAMMA_UPPLADDNING_MS = 10 * 60 * 1000;
/** OpenAIs gräns är 50 MB filer per anrop. Bilder räknas inte in. */
const MAX_BYTE_PER_ANROP = 45 * 1024 * 1024;
/** Så här många tokens får filerna minst, även när kunddelen är stor. */
const MIN_FILBUDGET = 40_000;
const SAMTIDIGA_UPPLADDNINGAR = 5;

export interface Filpost {
  fil: string;
  underlagId: string;
  namn: string;
  fileId: string | null;
  /** En grannsida (G1, G2 …): läses i en annan del, med här som sammanhang. Får inget svar. */
  granne?: boolean;
}

export interface Anropsdel {
  filer: Filpost[];
  kropp: object;
  tokens: number;
}

/** Det som behövs när svaret kommer tillbaka. */
export interface Kontext {
  betalsatt: Betalsatt;
  /** profiles.redovisningsmetod — faktureringsmetoden ger två verifikationer per faktura. */
  redovisningsmetod?: string | null;
  regelIdn: string[];
  /** K-nummer i kundens lista → transaktionens id. */
  kNummer: Record<string, string>;
  /** BOK-nummer i listan över bokförda verifikationer → verifikationen i text ("A55 2026-07-31 0060"). */
  vNummer?: Record<string, string>;
  /** BOK-numret → verifikationens id, för kopplingar (./skriv). */
  vId?: Record<string, string>;
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

const SORTERA = new Intl.Collator('sv', { numeric: true, sensitivity: 'base' });

/**
 * "Skanning (12).jpg" → ["Skanning", 12]. Utan nummer är filen den första —
 * så namnger Windows och skannrar en serie: "Skanning", "Skanning (2)" …
 */
function namnnyckel(namn: string): [string, number] {
  const bas = namn.replace(/\.[^.]+$/, '');
  const m = bas.match(/^(.*?)\s*\((\d+)\)$/);
  return m ? [m[1], Number(m[2])] : [bas, 1];
}

/**
 * Underlagen i den ordning sidorna hör ihop: samlade per mejl eller per
 * uppladdning, samlingarna i den ordning de kom in, och filerna i varje
 * samling efter namnet. `samling` säger vilken samling filen hör till.
 */
export function iOrdning<T extends Pick<Underlagsrad, 'file_name' | 'created_at' | 'source' | 'gmail_message_id'>>(rader: T[]): { rad: T; samling: number }[] {
  const tid = (r: T) => new Date(r.created_at).getTime();
  const samlingar: T[][] = [];
  const perMejl = new Map<string, T[]>();
  let uppladdning: { lista: T[]; tid: number; kalla: string } | null = null;
  for (const r of [...rader].sort((a, b) => tid(a) - tid(b))) {
    if (r.gmail_message_id) {
      let lista = perMejl.get(r.gmail_message_id);
      if (!lista) { lista = []; perMejl.set(r.gmail_message_id, lista); samlingar.push(lista); }
      lista.push(r);
      continue;
    }
    const kalla = r.source ?? '';
    if (uppladdning && uppladdning.kalla === kalla && tid(r) - uppladdning.tid < SAMMA_UPPLADDNING_MS) {
      uppladdning.lista.push(r);
      uppladdning.tid = tid(r);
    } else {
      uppladdning = { lista: [r], tid: tid(r), kalla };
      samlingar.push(uppladdning.lista);
    }
  }
  return samlingar.flatMap((lista, samling) => lista
    .map((rad) => ({ rad, nyckel: namnnyckel(rad.file_name) }))
    .sort((a, b) => SORTERA.compare(a.nyckel[0], b.nyckel[0]) || a.nyckel[1] - b.nyckel[1])
    .map(({ rad }) => ({ rad, samling })));
}

/** Bilder och korta PDF:er kan vara en sida av ett dokument i en annan fil. Längre dokument följer inte med som grannar. */
function kanVaraSida(f: Forberedd): boolean {
  return f.typ === 'bild' || (f.typ === 'dokument' && (f.sidor ?? 99) <= 2 && f.bytes.length < 5 * 1024 * 1024);
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
): Promise<{ text: string; regelIdn: string[]; kNummer: Record<string, string>; vNummer: Record<string, string>; vId: Record<string, string> }> {
  const regler = reglerFor(instruktioner, userId);
  const [kundbild, arslista, mejl, bokfort, verifikationer] = await Promise.all([
    hamtaKundbild(supabase, userId),
    hamtaArslista(supabase, userId, { medKonton: true, utanUnderlag }),
    byggMejlkontext(supabase, { userId, emails: [kund?.email] }),
    verifikationsSammanfattning(supabase, userId),
    bokfordaVerifikationer(supabase, userId),
  ]);
  const kontext = kontextFor(instruktioner, { id: '', underlag_id: null, user_id: userId });
  const text = [
    `KUNDEN:\n${byggKundkontext(kund)}\nBetalar via: ${betalsatt === 'privatkonto' ? 'privatkonto' : 'företagskonto'}`,
    kundbild ? `KUNDBILDEN:\n${utanRadnummer(kundbild)}` :'KUNDBILDEN: inte sammanställd än — utgå från kundens transaktioner nedan.',
    kontext,
    `KUNDREGLER:\n${reglerAttValja(regler)}`,
    bokfort,
    verifikationer.text,
    mejl,
    `KUNDENS TRANSAKTIONER (${arslista.rader.length} st, äldst först):\n${arslista.text || '(inga)'}`,
  ].filter(Boolean).join('\n\n');
  const kNummer = Object.fromEntries([...arslista.nummer].map(([id, nr]) => [`K${nr}`, id]));
  return { text, regelIdn: regler.map((r) => r.id), kNummer, vNummer: verifikationer.vNummer, vId: verifikationer.vId };
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
  lev: Leverantor,
): Promise<Forberedelse> {
  // Byråns ändringar i kontobeskrivningarna gäller från och med nu
  await laddaK1Andringar(supabase);
  const { data: profil, error: profilFel } = await supabase.from('profiles').select(KUND_KOLUMNER).eq('id', userId).maybeSingle();
  if (profilFel) throw new Error(`Kunde inte läsa kunden: ${profilFel.message}`);
  const kund = profil as unknown as Kund | null;
  const betalsatt = tolkaBetalsatt(kund?.har_foretagskonto ?? null);
  if (!betalsatt) throw new Error('Välj först om kunden betalar via företagskonto eller privatkonto (Kundkontext).');

  // I omgångar om 100 — hundratals id i en fråga blir en för lång adress
  const underlag: Underlagsrad[] = [];
  const gamlaPer = new Map<string, string[]>();
  for (let i = 0; i < underlagIds.length; i += 100) {
    const ids = underlagIds.slice(i, i + 100);
    const [{ data: rader, error }, { data: gamla }] = await Promise.all([
      supabase.from('bokforing_underlag').select(UNDERLAG_KOLUMNER).eq('user_id', userId).in('id', ids),
      // Transaktioner som lästs ut ur underlagen förut: deras kontext följer med filen
      supabase.from('transaktioner').select('id, underlag_id').in('underlag_id', ids),
    ]);
    if (error) throw new Error(`Kunde inte läsa underlagen: ${error.message}`);
    underlag.push(...((rader ?? []) as Underlagsrad[]));
    for (const g of gamla ?? []) gamlaPer.set(g.underlag_id, [...(gamlaPer.get(g.underlag_id) ?? []), g.id]);
  }
  underlag.sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!underlag.length) throw new Error('Inga underlag valda');

  const instruktioner = await hamtaInstruktioner(supabase, { userId, underlagIds: underlag.map((u) => u.id) });
  const kunden = await kunddel(supabase, userId, kund, betalsatt, instruktioner, new Set(underlag.map((u) => u.id)));

  // Kontrollen: varje fil laddas ner och prövas
  const hoppade: Hoppad[] = [];
  type Godkand = { u: Underlagsrad; fil: Forberedd; samling: number; tokens: number; byte: number };
  const godkanda: Godkand[] = [];
  const ordnade = iOrdning(underlag);
  const kontroller = await iKo(ordnade, SAMTIDIGA_UPPLADDNINGAR, ({ rad }) => kontrolleraFil(supabase, rad));
  ordnade.forEach(({ rad: u, samling }, i) => {
    const k = kontroller[i];
    const nej = k.ok && k.fil.typ !== 'text' ? lev.tarEmot(k.fil.mime) : null;
    if (nej) hoppade.push({ underlagId: u.id, namn: u.file_name, orsak: nej, varning: true });
    else if (k.ok) godkanda.push({ u, fil: k.fil, samling, tokens: uppskattadeTokens(k.fil), byte: k.fil.typ === 'dokument' ? k.fil.bytes.length : 0 });
    else hoppade.push({ underlagId: u.id, namn: u.file_name, orsak: k.orsak, varning: !k.tyst });
  });

  // Delarna: filbudgeten är det som blir kvar efter instruktionen, kunden och grannsidorna
  const fast = instruktionensTokens() + Math.ceil(kunden.text.length / 3.5);
  const budget = Math.max(MIN_FILBUDGET, TOKENTAK - fast - GRANNRESERV);
  const grupper: Godkand[][] = [];
  let tokens = 0, byte = 0;
  for (const g of godkanda) {
    const sista = grupper[grupper.length - 1];
    if (!sista || sista.length >= lev.maxFiler || tokens + g.tokens > budget || byte + g.byte > MAX_BYTE_PER_ANROP) {
      grupper.push([g]);
      tokens = g.tokens; byte = g.byte;
    } else {
      sista.push(g);
      tokens += g.tokens; byte += g.byte;
    }
  }

  const delar: Anropsdel[] = [];
  for (const [gi, grupp] of grupper.entries()) {
    // Grannsidorna: närmast gränsen först, bara ur samma samling och bara så länge de ryms
    let gTokens = fast + grupp.reduce((s, g) => s + g.tokens, 0);
    let gByte = grupp.reduce((s, g) => s + g.byte, 0);
    const grannar = (kandidater: Godkand[], samling: number | undefined): Godkand[] => {
      const ut: Godkand[] = [];
      for (const g of kandidater.slice(0, GRANNAR)) {
        if (g.samling !== samling || !kanVaraSida(g.fil) || gTokens + g.tokens > TOKENTAK || gByte + g.byte > MAX_BYTE_PER_ANROP) break;
        ut.push(g);
        gTokens += g.tokens; gByte += g.byte;
      }
      return ut;
    };
    const fore = grannar([...(grupper[gi - 1] ?? [])].reverse(), grupp[0].samling).reverse();
    const efter = grannar(grupper[gi + 1] ?? [], grupp[grupp.length - 1].samling);

    const poster = [
      ...fore.map((g) => ({ ...g, granne: 'fore' as const })),
      ...grupp.map((g) => ({ ...g, granne: undefined })),
      ...efter.map((g) => ({ ...g, granne: 'efter' as const })),
    ];
    const uppladdade = await iKo(poster, SAMTIDIGA_UPPLADDNINGAR, async (p) => {
      try {
        if (p.fil.typ === 'text') return { ...p, fileId: null as string | null };
        const fileId = await lev.laddaUpp(p.u.file_name, p.fil.bytes, p.fil.mime, p.fil.typ);
        return { ...p, fileId };
      } catch (err) {
        // En grannsida som inte gick upp är bara mindre sammanhang
        if (!p.granne) hoppade.push({ underlagId: p.u.id, namn: p.u.file_name, orsak: err instanceof Error ? err.message : String(err), varning: true });
        return null;
      }
    });
    const klara = uppladdade.filter((x): x is NonNullable<typeof x> => !!x);
    if (!klara.some((k) => !k.granne)) {
      await Promise.all(klara.filter((k) => k.fileId).map((k) => lev.raderaFil(k.fileId!).catch(() => {})));
      continue;
    }

    const filer: Filpost[] = [];
    let f = 0, g = 0;
    const indata: Indatafil[] = klara.map(({ u, fil, fileId, granne }) => {
      const nr = granne ? `G${++g}` : `F${++f}`;
      filer.push({ fil: nr, underlagId: u.id, namn: u.file_name, fileId, ...(granne ? { granne: true } : {}) });
      const sidor = fil.typ === 'dokument' && fil.sidor && fil.sidor > 1 ? `, ${fil.sidor} sidor` : '';
      const kontext = granne ? '' : underlagetsKontext(instruktioner, u.id, gamlaPer.get(u.id) ?? []);
      const rubrik = [`${nr}: ${u.file_name} — inkom ${DAG.format(new Date(u.created_at))} ${kallaText(u)}${sidor}`.trim(), kontext].filter(Boolean).join('\n');
      return {
        fil: nr,
        rubrik,
        granne,
        innehall: fil.typ === 'text' ? { typ: 'text', text: fil.text }
          : fil.typ === 'bild' ? { typ: 'bild', fileId: fileId! }
          : { typ: 'dokument', fileId: fileId!, namn: u.file_name },
      };
    });
    delar.push({
      filer,
      kropp: lev.byggKropp(kunden.text, indata, kunden.regelIdn),
      tokens: fast + klara.reduce((s, k) => s + k.tokens, 0),
    });
  }

  return { delar, hoppade, kontext: { betalsatt, redovisningsmetod: kund?.redovisningsmetod ?? null, regelIdn: kunden.regelIdn, kNummer: kunden.kNummer, vNummer: kunden.vNummer, vId: kunden.vId } };
}
