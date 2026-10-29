import type { SupabaseClient } from '@supabase/supabase-js';
import { buildImageParts, spreadsheetToText } from './fil-delar';
import { arBildEllerPdf, arTabellfil } from './filtyp';
import { FLYTTAD_FOR_HAND, sorteraEfterRegler } from './sortering';
import { OVRIGTREGEL } from '@/lib/transaktioner/normalisera';
import { isSieFile } from '@/lib/sie/parse';
import { samlaSidor } from './sidor';
import { arKontoutdrag } from '@/lib/transaktioner/normalisera';

/**
 * Definiera underlaget — första steget efter att ett underlag tagits emot.
 *
 * AI:n tittar på filen och avgör tre saker, utan att skriva av något:
 *
 * - vad det är (kvitto, leverantörsfaktura, kontoutdrag, verifikationslista …)
 * - vilket år det hör till
 * - vilken väg det ska gå: transaktioner, verifikationer eller övrigt
 *
 * Står det på underlaget plockar den också ut dokumentnummer, org.nr, datum
 * och sidnummer, så att sidor som skannats var för sig kan läsas ihop.
 *
 * Året styr inte vägen. Det sparas i `underlag_ar` och hanteras i huvudboken.
 * Vägen skrivs till `sortering`, så att övriga filer hamnar under Övriga filer
 * direkt — utom när Erik har flyttat filen för hand, då gäller det.
 *
 * Det som går att avgöra utan AI (SIE-filer, våra egna filer, filtyper vi inte
 * läser) avgörs med reglerna i `sortering.ts` och kostar ingenting.
 *
 * Körs automatiskt när ett underlag kommer in, och går att köra om från
 * flödesschemat.
 */

export type Kategori = 'transaktioner' | 'verifikationer' | 'ovrigt';

export interface Definition {
  kategori: Kategori;
  /** T.ex. "Kvitto", "Leverantörsfaktura", "Kontoutdrag", "Verifikationslista", "NE-bilaga". */
  dokumenttyp: string;
  /** En mening om vad underlaget gäller. */
  beskrivning: string;
  /** Året underlaget hör till, null när det inte framgår. */
  ar: number | null;
  /** Varför AI:n valde kategori och år. */
  motivering: string;
  /** Modellen, eller "regel" när ingen AI behövdes. */
  modell: string;
  /**
   * Det som känner igen dokumentet när det kommer i flera sidor. Fylls i bara
   * när det står på underlaget — alla underlag har det inte. Se `./sidor`.
   */
  dokumentnummer?: string | null;
  orgnr?: string | null;
  motpart?: string | null;
  datum?: string | null;
  /** "Sida 1 (2)" ger sida 1 och antalSidor 2. */
  sida?: number | null;
  antalSidor?: number | null;
}

// Luna räcker här och kostar en tjugondel av Sol — provkört på två kunders alla underlag 2026-10-29
const MODELL = 'gpt-6-luna';
// Bara ett litet JSON-svar, men modellens tänkande ryms i samma budget
const MAX_TOKENS = 16000;
const BUCKET = 'bokforing-underlag';
/** Kalkylblad skickas som text. Början räcker för att se vad det är och vilka datum det gäller. */
const MAX_TECKEN = 15000;

const SYSTEM_PROMPT = `Du tar emot underlag åt en svensk redovisningsbyrå. Alla kunder är enskilda firmor.

Du ska INTE skriva av underlaget. Du ska bara avgöra vad det är, så att det kan skickas rätt väg.

Avgör tre saker:

1. "kategori" — vilken väg underlaget ska gå:
- "transaktioner": ett kvitto, en faktura eller en lista med köp, försäljningar eller betalningar — inte ett kontoutdrag, som är "ovrigt". Underlaget säger vad som hänt, men inte hur det bokförts. Det är det vanliga.
- "verifikationer": ett underlag som REDAN är bokfört — en verifikationslista, grundbok, dagbok eller huvudbok ur ett bokföringsprogram. Kännetecknet är att raderna har kontonummer (t.ex. 1930, 2641, 3001) med belopp i debet eller kredit. Välj det bara när kontonumren faktiskt står i underlaget.
${OVRIGTREGEL}

2. "dokumenttyp" — vad det är, med ett eller två ord på svenska. Till exempel "Kvitto", "Leverantörsfaktura", "Kundfaktura", "Kontoutdrag", "Swish-lista", "Verifikationslista", "Huvudbok", "NE-bilaga", "Hyresavtal", "Skattekontoutdrag".

3. "ar" — vilket år underlaget hör till, som ett heltal (t.ex. 2025). Utgå från datumen i underlaget: kvittodatum, fakturadatum, perioden på ett kontoutdrag. Spänner underlaget över flera år väljer du året där det mesta ligger. Framgår inget år sätter du null — gissa aldrig.

4. Det som känner igen dokumentet, ifall det består av flera sidor som skickats var för sig. Skriv bara av det som står på underlaget — null när det inte står där, gissa aldrig:
- "dokumentnummer": kvitto-, köpnota-, faktura- eller ordernumret, exakt som det står.
- "orgnr": säljarens eller avsändarens organisationsnummer.
- "motpart": säljarens eller avsändarens namn.
- "datum": dokumentets datum, YYYY-MM-DD.
- "sida" och "antal_sidor": när underlaget säger vilken sida det är, t.ex. "Sida: 1 (2)", "Sida 2 av 3" eller "1/2". Null när det inte står.

Returnera BARA ett JSON-objekt:
{
  "kategori": "transaktioner", "verifikationer" eller "ovrigt",
  "dokumenttyp": "…",
  "beskrivning": "en kort mening om vad underlaget gäller, t.ex. \\"Kvitto från Biltema på verktyg\\"",
  "ar": 2025 eller null,
  "motivering": "en kort mening om varför du valde kategori och år",
  "dokumentnummer": "…" eller null,
  "orgnr": "…" eller null,
  "motpart": "…" eller null,
  "datum": "YYYY-MM-DD" eller null,
  "sida": 1 eller null,
  "antal_sidor": 2 eller null
}`;

interface UnderlagRad {
  id: string;
  user_id: string | null;
  sender_email: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  sortering: string | null;
  sortering_orsak: string | null;
}

/** Definierar ett underlag och sparar svaret. Kastar vid fel, efter att felet skrivits på underlaget. */
export async function definieraUnderlag(supabase: SupabaseClient, underlagId: string): Promise<Definition> {
  const { data: row, error } = await supabase
    .from('bokforing_underlag')
    .select('id, user_id, sender_email, file_name, file_path, mime_type, sortering, sortering_orsak')
    .eq('id', underlagId)
    .maybeSingle<UnderlagRad>();
  if (error) throw new Error(`Kunde inte läsa underlaget: ${error.message}`);
  if (!row) throw new Error('Underlaget finns inte');

  try {
    const definition = avgorMedRegler(row) ?? await fragaAi(supabase, row);
    await spara(supabase, row, definition);
    // En sida i ett dokument med flera sidor kopplas ihop med de andra
    await samlaSidor(supabase, row.id);
    return definition;
  } catch (err) {
    const fel = err instanceof Error ? err.message : 'Okänt fel';
    await supabase.from('bokforing_underlag').update({ definierad_at: new Date().toISOString(), definition_fel: fel }).eq('id', row.id);
    throw err;
  }
}

/** Definierar i bakgrunden och loggar fel i stället för att kasta — för flöden där underlaget redan är sparat. */
export async function definieraTyst(supabase: SupabaseClient, underlagId: string): Promise<void> {
  await definieraUnderlag(supabase, underlagId).catch((err) =>
    console.error(`[definiera] ${underlagId}:`, err instanceof Error ? err.message : err));
}

function avgorMedRegler(row: UnderlagRad): Definition | null {
  if (isSieFile(row.file_name)) {
    return { kategori: 'verifikationer', dokumenttyp: 'SIE-fil', beskrivning: 'Export ur ett bokföringsprogram', ar: null, motivering: 'SIE-filer är redan bokförda', modell: 'regel' };
  }
  const regel = sorteraEfterRegler(row.file_name, row.mime_type, row.sender_email);
  if (regel?.sortering === 'ovrigt') {
    return { kategori: 'ovrigt', dokumenttyp: 'Övrig fil', beskrivning: regel.sortering_orsak, ar: null, motivering: regel.sortering_orsak, modell: 'regel' };
  }
  return null;
}

/**
 * Hur många sidor en PDF har. En PDF på 19 sidor där första sidan säger
 * "Sida 1 (19)" är ett helt dokument, inte första sidan av 19 som skickats
 * var för sig. Null när filen inte går att läsa — då gäller AI:ns svar.
 */
async function pdfSidor(buffer: Buffer): Promise<number | null> {
  try {
    const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs'); // eslint-disable-line @typescript-eslint/no-explicit-any
    // Samma arbetare som avläsningen av inmejlade PDF:er (@/lib/inmail/handlers/new-transaction)
    const { resolve } = await import('path');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')}`;
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const antal = Number(pdf.numPages);
    await pdf.destroy?.();
    return Number.isInteger(antal) && antal > 0 ? antal : null;
  } catch (err) {
    console.error('[definiera] kunde inte räkna PDF:ens sidor:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function fragaAi(supabase: SupabaseClient, row: UnderlagRad): Promise<Definition> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY saknas');

  const { data: fil, error } = await supabase.storage.from(BUCKET).download(row.file_path);
  if (error || !fil) throw new Error(`Filen saknas i lagringen: ${error?.message ?? 'okänt fel'}`);
  const buffer = Buffer.from(await fil.arrayBuffer());

  const arPdfFil = row.file_name.toLowerCase().endsWith('.pdf') || row.mime_type === 'application/pdf';
  const filSidor = arPdfFil ? await pdfSidor(buffer) : null;
  const fraga = `Underlag: ${row.file_name}. Avgör vad det är, vilket år det hör till och vilken väg det ska gå.`
    + (filSidor && filSidor > 1 ? ` Filen har ${filSidor} sidor — finns alla dokumentets sidor i filen är "sida" och "antal_sidor" null.` : '');
  let content: unknown[];
  if (arTabellfil(row.file_name, row.mime_type)) {
    const text = await spreadsheetToText(buffer, row.mime_type ?? '', row.file_name);
    content = [{ type: 'text', text: `${fraga}\n\n${text.length > MAX_TECKEN ? `${text.slice(0, MAX_TECKEN)}\n[…resten av filen visas inte]` : text}` }];
  } else if (arBildEllerPdf(row.file_name, row.mime_type)) {
    const arPdf = row.file_name.toLowerCase().endsWith('.pdf') || row.mime_type === 'application/pdf';
    content = arPdf
      ? [
        { type: 'file', file: { filename: row.file_name, file_data: `data:application/pdf;base64,${buffer.toString('base64')}` } },
        { type: 'text', text: fraga },
      ]
      : buildImageParts(buffer, row.mime_type ?? '', row.file_name, fraga)[0] as unknown[];
  } else {
    throw new Error(`${row.file_name} är inte en filtyp vi kan läsa`);
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODELL,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      max_completion_tokens: MAX_TOKENS,
    }),
  });
  if (!res.ok) {
    console.error('[definiera] OpenAI-fel:', await res.text().catch(() => res.statusText));
    throw new Error('AI-tjänsten svarade inte');
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new Error(`AI:n kunde inte läsa ${row.file_name}`);
  const raw = (choice?.message?.content ?? '').trim();
  let svar: Record<string, unknown>;
  try {
    svar = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
  } catch {
    throw new Error('AI:n svarade inte med JSON');
  }

  // Ett kontoutdrag är inget underlag, vad AI:n än valt för kategori
  const kategori: Kategori = arKontoutdrag(String(svar.dokumenttyp ?? '')) ? 'ovrigt'
    : svar.kategori === 'verifikationer' || svar.kategori === 'ovrigt' ? svar.kategori : 'transaktioner';
  const ar = Number(svar.ar);
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const sida = Number(svar.sida);
  const antalSidor = Number(svar.antal_sidor);
  // Sidnumren gäller bara när båda finns och går ihop — och inte när hela
  // dokumentet redan finns i filen, som en PDF med alla sidorna
  const sidor = Number.isInteger(sida) && Number.isInteger(antalSidor) && antalSidor >= 2 && antalSidor <= 50 && sida >= 1 && sida <= antalSidor
    && !(filSidor && filSidor >= antalSidor);
  const datum = text(svar.datum, 10);
  return {
    dokumentnummer: text(svar.dokumentnummer, 60),
    orgnr: text(svar.orgnr, 20),
    motpart: text(svar.motpart, 120),
    datum: datum && /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : null,
    sida: sidor ? sida : null,
    antalSidor: sidor ? antalSidor : null,
    kategori,
    dokumenttyp: String(svar.dokumenttyp ?? '').trim().slice(0, 60) || 'Okänt',
    beskrivning: String(svar.beskrivning ?? '').trim().slice(0, 300),
    // Ett år långt från nu är en felläsning, inte ett underlag
    ar: Number.isInteger(ar) && ar >= 1990 && ar <= new Date().getFullYear() + 1 ? ar : null,
    motivering: String(svar.motivering ?? '').trim().slice(0, 500),
    modell: MODELL,
  };
}

async function spara(supabase: SupabaseClient, row: UnderlagRad, d: Definition) {
  // Har Erik flyttat filen själv gäller det, oavsett vad AI:n tycker
  const sortering = row.sortering_orsak === FLYTTAD_FOR_HAND ? {} : {
    sortering: d.kategori === 'ovrigt' ? 'ovrigt' : 'underlag',
    sortering_orsak: d.kategori === 'ovrigt' ? d.beskrivning || d.dokumenttyp : `${d.dokumenttyp} (definierat)`,
    sortering_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('bokforing_underlag').update({
    definition: d,
    definierad_at: new Date().toISOString(),
    definition_fel: null,
    underlag_ar: d.ar,
    ...sortering,
  }).eq('id', row.id);
  if (error) throw new Error(`Kunde inte spara definitionen: ${error.message}`);

  // Blir ett underlag övrigt — ett kontoutdrag som lästs ut förut — tas det som
  // lästes ut bort, så att raderna inte konteras. Det som redan bokförts rörs inte.
  if (d.kategori === 'ovrigt') {
    const { data: trans } = await supabase.from('transaktioner').select('id').eq('underlag_id', row.id);
    const ids = (trans ?? []).map((t) => t.id);
    if (ids.length) {
      const { data: bokforda } = await supabase.from('verifikationer').select('transaktion_id').in('transaktion_id', ids);
      const behall = new Set((bokforda ?? []).map((v) => v.transaktion_id));
      const bort = ids.filter((id) => !behall.has(id));
      for (let i = 0; i < bort.length; i += 200) {
        const { error: dFel } = await supabase.from('transaktioner').delete().in('id', bort.slice(i, i + 200));
        if (dFel) throw new Error(`Kunde inte ta bort det som lästs ut: ${dFel.message}`);
      }
    }
  }
}
