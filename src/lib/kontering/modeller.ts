import Anthropic from '@anthropic-ai/sdk';
import { openaiFetch } from '@/lib/ai-anrop';
import { loggaClaude, loggaOpenAI, type Anropsinfo } from '@/lib/ai-logg';

/**
 * De två modellerna som konterar, bakom samma anrop.
 *
 * GPT-6.1 Sol ersatte GPT-6 Astra (2026-10-29): en provkörning på två kunders
 * alla transaktioner gav samma konton till en femtedel av priset.
 *
 * Båda kör med samma prompter, så att svaren går att jämföra rad för rad.
 * Svaret tvingas till ett JSON-schema hos båda leverantörerna — då behöver vi
 * aldrig gissa oss fram i fritext.
 *
 * Båda tänker på nivån high. Med max tog en transaktion upp till 4,5
 * minuter, och den måste hinna klart inom Vercels fem minuter.
 */

export const MODELLER = ['gpt-6.1-sol', 'claude-opus-5-5'] as const;
/** Konteringens modeller, och de andra som går genom samma anrop (kundbilden och helhetskontrollen). */
export type Modell = (typeof MODELLER)[number] | 'claude-sonnet-5-5';

export interface Svar<T> {
  data: T;
  /** Modellen som faktiskt svarade — kan skilja sig om Claude lämnade över vid en vägran. */
  modell: string;
}

let anthropic: Anthropic | null = null;
function claude() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY saknas');
  // SDK:n försöker själv igen vid 429 och överbelastning — fler gånger när flera filer körs samtidigt
  anthropic ??= new Anthropic({ maxRetries: 4 });
  return anthropic;
}

/**
 * Systemprompten i två delar: den fasta (instruktion och kontoplan) först och
 * det som skiljer mellan kunder sist, så att den fasta delen kan cachas och
 * inte läses om för varje rad.
 */
export interface System {
  fast: string;
  kund: string;
}

/**
 * Det som är samma för många anrop i rad — originaldokumentet och filens
 * andra transaktioner. Det läggs först i användarmeddelandet, före det som
 * gäller just den här transaktionen, så att båda leverantörerna kan cacha det.
 */
export type Del =
  | { typ: 'text'; text: string }
  | { typ: 'pdf'; namn: string; data: string }
  | { typ: 'bild'; mime: 'image/png' | 'image/jpeg'; data: string };

function gptDel(d: Del): unknown {
  if (d.typ === 'text') return { type: 'text', text: d.text };
  if (d.typ === 'pdf') return { type: 'file', file: { filename: d.namn, file_data: `data:application/pdf;base64,${d.data}` } };
  return { type: 'image_url', image_url: { url: `data:${d.mime};base64,${d.data}` } };
}

function claudeDel(d: Del): Anthropic.Beta.Messages.BetaContentBlockParam {
  if (d.typ === 'text') return { type: 'text', text: d.text };
  if (d.typ === 'pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: d.data } };
  return { type: 'image', source: { type: 'base64', media_type: d.mime, data: d.data } };
}

async function fragaGpt<T>(modell: string, system: System, delat: Del[], user: string, namn: string, schema: object, anrop: Anropsinfo): Promise<Svar<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY saknas');

  const res = await openaiFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modell,
      reasoning_effort: 'high',
      response_format: { type: 'json_schema', json_schema: { name: namn, strict: true, schema } },
      messages: [
        { role: 'system', content: [system.fast, system.kund].filter(Boolean).join('\n\n') },
        { role: 'user', content: delat.length ? [...delat.map(gptDel), { type: 'text', text: user }] : user },
      ],
      max_completion_tokens: 32000,
    }),
  });
  if (!res.ok) throw new Error(`${modell} svarade ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const json = await res.json();
  await loggaOpenAI(anrop, modell, json.usage);
  const choice = json.choices?.[0];
  if (choice?.message?.refusal) throw new Error(`${modell} vägrade: ${choice.message.refusal}`);
  if (choice?.finish_reason === 'length') throw new Error(`${modell} hann inte svara klart`);
  return { data: JSON.parse(choice?.message?.content ?? '') as T, modell: json.model ?? modell };
}

async function fragaClaude<T>(modell: string, system: System, delat: Del[], user: string, schema: object, anrop: Anropsinfo): Promise<Svar<T>> {
  // Tre cachepunkter: den fasta instruktionen, kunden och det delade
  // underlaget. Allt före en punkt läses ur cachen när nästa anrop börjar likadant.
  const cache = { type: 'ephemeral' as const, ttl: '1h' as const };
  const delar = delat.map(claudeDel);
  if (delar.length) delar[delar.length - 1] = { ...delar[delar.length - 1], cache_control: cache } as Anthropic.Beta.Messages.BetaContentBlockParam;
  // Strömmat, eftersom tänkandet kan ta längre tid än ett
  // vanligt anrop hinner vänta. Vid en vägran tar en annan modell över i
  // samma anrop (fallbacks), och vilken som svarade sparas.
  const stream = claude().beta.messages.stream({
    model: modell,
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema } },
    system: [
      { type: 'text', text: system.fast, cache_control: cache },
      ...(system.kund ? [{ type: 'text' as const, text: system.kund, cache_control: cache }] : []),
    ],
    messages: [{ role: 'user', content: [...delar, { type: 'text', text: user }] }],
  } as Anthropic.Beta.Messages.MessageCreateParamsStreaming);
  const msg = await stream.finalMessage();
  await loggaClaude(anrop, msg.model, msg.usage);

  if (msg.stop_reason === 'refusal') throw new Error(`${modell} vägrade svara`);
  if (msg.stop_reason === 'max_tokens') throw new Error(`${modell} hann inte svara klart`);
  const text = msg.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error(`${modell} gav inget svar`);
  return { data: JSON.parse(text.text) as T, modell: msg.model };
}

export function fraga<T>(modell: Modell, o: { system: System; delat?: Del[]; user: string; namn: string; schema: object; anrop: Anropsinfo }): Promise<Svar<T>> {
  return modell.startsWith('gpt-')
    ? fragaGpt<T>(modell, o.system, o.delat ?? [], o.user, o.namn, o.schema, o.anrop)
    : fragaClaude<T>(modell, o.system, o.delat ?? [], o.user, o.schema, o.anrop);
}

// ---------- samtal med uppslag ----------

/**
 * Ett samtal där modellen själv slår upp de konton den vill läsa, så många
 * den behöver. Den kan också öppna kundens andra underlag och söka på webben.
 *
 * Antalet uppslag är fritt, tiden är det inte: efter `mjukGrans` får modellen
 * inte slå upp mer och måste svara med det den har (`tidSlut` i svaret, och
 * raden flaggas). Efter `hardGrans` avbryts anropet med ett fel, så att Vercels
 * fem minuter aldrig tar hela omgången med sig.
 */
export interface Samtal<T> {
  data: T;
  /** Svaret tvingades fram eftersom tiden tog slut. */
  tidSlut: boolean;
  /** Kontona modellen har läst hela regeltexten för, i den ordning den läste dem. */
  lasta: Set<string>;
  /** Modellerna som faktiskt svarade — Claude kan lämna över vid en vägran. */
  svarade: Set<string>;
  /** Vad modellen sökte på webben. */
  sokningar: Set<string>;
  /** Kundens andra filer som modellen öppnade. */
  filer: Set<string>;
}

/** Säger till när ett svar inte går att godta: texten går tillbaka till modellen. */
export type Prova<T> = (svar: T) => string | null;

interface Uppslag<T> {
  /** Tidpunkt (ms) då modellen måste svara utan fler uppslag. */
  mjukGrans: number;
  /** Tidpunkt (ms) då anropet avbryts. */
  hardGrans: number;
  system: System;
  delat?: Del[];
  user: string;
  namn: string;
  schema: object;
  anrop: Anropsinfo;
  /** Regeltexten för ett konto, eller varför det inte finns. */
  lasKonto: (konto: string) => string;
  /** Originalfilerna bakom rader i kundens lista (K12). */
  lasUnderlag: (rader: string[]) => Promise<Underlagssvar>;
  prova: Prova<T>;
}

export interface Underlagssvar {
  /** Vad som hände med varje rad. */
  text: string;
  delar: Del[];
  /** Filnamnen som öppnades. */
  filer: string[];
}

/** Vad en runda med modellen gav: uppslag den vill göra, annars svaret. */
interface Runda {
  uppslag: { id: string; namn: string; indata: unknown }[];
  /** Webbsökningarna som leverantören körde under rundan. */
  sokningar: string[];
  /** Leverantören pausade under en sökning: rundan ska köras vidare. */
  pausad: boolean;
  text: string;
  modell: string;
}

/** Skillnaden mellan leverantörerna: hur en runda körs och hur samtalet byggs på. */
interface Part {
  runda(medVerktyg: boolean, signal: AbortSignal): Promise<Runda>;
  uppslagssvar(svar: Uppslagssvar[]): void;
  meddelande(text: string): void;
}

/** Svaret på ett uppslag, med filerna när modellen öppnat några. */
interface Uppslagssvar {
  id: string;
  text: string;
  delar: Del[];
}

const VERKTYG = 'las_konton';
const VERKTYG_TEXT = 'Läser hela regeltexten för ett eller flera konton i K1-kontoplanen: beskrivning, använd när, använd inte när, beslutsregler, varningar, exempel, när en människa ska granska och uträknade gränsprövningar.';
const VERKTYG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['konton'],
  properties: {
    konton: { type: 'array', items: { type: 'string', description: 'Fyrsiffrigt konto ur K1-kontoplanen' } },
  },
};
const UNDERLAG_VERKTYG = 'las_underlag';
const UNDERLAG_TEXT = 'Öppnar originalfilen bakom en eller flera rader i kundens lista, till exempel kvittot bakom K12.';
const UNDERLAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rader'],
  properties: {
    rader: { type: 'array', items: { type: 'string', description: 'Radens nummer i kundens lista, till exempel K12' } },
  },
};
const TID_SLUT = 'Tiden är slut, och du kan inte läsa eller söka mer. Svara nu med det du har. Säg i motiveringen vad du inte hann pröva, och sätt sakerhet till "lag" om det kan ändra kontot eller momsen.';

function listaUr(indata: unknown, falt: 'konton' | 'rader'): string[] {
  const k = (indata as Record<string, unknown> | null)?.[falt];
  return Array.isArray(k) ? k.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
}

/** Samma sak som gptDel, i det format Responses-API:t vill ha. */
function gptIndata(d: Del): unknown {
  if (d.typ === 'text') return { type: 'input_text', text: d.text };
  if (d.typ === 'pdf') return { type: 'input_file', filename: d.namn, file_data: `data:application/pdf;base64,${d.data}` };
  return { type: 'input_image', image_url: `data:${d.mime};base64,${d.data}` };
}

/**
 * GPT-6.1 tar verktyg tillsammans med tänkande bara i Responses-API:t. Inget
 * sparas hos OpenAI (store: false): samtalet skickas med varje gång, och
 * tänkandet följer med krypterat så att modellen kan bygga vidare på det.
 */
function gptPart(modell: string, o: Uppslag<unknown>, apiKey: string): Part {
  const input: unknown[] = [
    { role: 'user', content: [...(o.delat ?? []).map(gptIndata), { type: 'input_text', text: o.user }] },
  ];
  return {
    async runda(medVerktyg, signal) {
      const res = await openaiFetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modell,
          store: false,
          include: ['reasoning.encrypted_content'],
          reasoning: { effort: 'high' },
          instructions: [o.system.fast, o.system.kund].filter(Boolean).join('\n\n'),
          text: { format: { type: 'json_schema', name: o.namn, strict: true, schema: o.schema } },
          tools: [
            { type: 'function', name: VERKTYG, description: VERKTYG_TEXT, strict: true, parameters: VERKTYG_SCHEMA },
            { type: 'function', name: UNDERLAG_VERKTYG, description: UNDERLAG_TEXT, strict: true, parameters: UNDERLAG_SCHEMA },
            { type: 'web_search' },
          ],
          tool_choice: medVerktyg ? 'auto' : 'none',
          input,
          max_output_tokens: 32000,
        }),
      });
      if (!res.ok) throw new Error(`${modell} svarade ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = await res.json();
      const utdata: { type: string; call_id?: string; name?: string; arguments?: string; action?: { query?: string }; content?: { type: string; text?: string; refusal?: string }[] }[] = json.output ?? [];
      input.push(...utdata);
      await loggaOpenAI(o.anrop, modell, json.usage, { webbsokningar: utdata.filter((u) => u.type === 'web_search_call').length });
      if (json.status === 'incomplete') throw new Error(`${modell} hann inte svara klart`);
      const delar = utdata.filter((u) => u.type === 'message').flatMap((u) => u.content ?? []);
      const vagran = delar.find((d) => d.type === 'refusal');
      if (vagran) throw new Error(`${modell} vägrade: ${vagran.refusal}`);
      return {
        uppslag: utdata.filter((u) => u.type === 'function_call').map((u) => ({ id: u.call_id ?? '', namn: u.name ?? '', indata: JSON.parse(u.arguments || '{}') })),
        sokningar: utdata.flatMap((u) => (u.type === 'web_search_call' && u.action?.query ? [u.action.query] : [])),
        pausad: false,
        text: delar.filter((d) => d.type === 'output_text').map((d) => d.text ?? '').join(''),
        modell: json.model ?? modell,
      };
    },
    uppslagssvar(svar) {
      for (const s of svar) input.push({ type: 'function_call_output', call_id: s.id, output: s.text });
      const filer = svar.flatMap((s) => s.delar);
      if (filer.length) input.push({ role: 'user', content: filer.map(gptIndata) });
    },
    meddelande(text) {
      input.push({ role: 'user', content: [{ type: 'input_text', text }] });
    },
  };
}

function claudePart(modell: string, o: Uppslag<unknown>): Part {
  const cache = { type: 'ephemeral' as const, ttl: '1h' as const };
  const delar = (o.delat ?? []).map(claudeDel);
  if (delar.length) delar[delar.length - 1] = { ...delar[delar.length - 1], cache_control: cache } as Anthropic.Beta.Messages.BetaContentBlockParam;
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: 'user', content: [...delar, { type: 'text', text: o.user }] }];
  // Fjärde och sista cachepunkten: första öppnade filen, som annars läses om varje runda
  let filCachad = false;
  return {
    async runda(medVerktyg, signal) {
      const stream = claude().beta.messages.stream({
        model: modell,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high', format: { type: 'json_schema', schema: o.schema } },
        tools: [
          { name: VERKTYG, description: VERKTYG_TEXT, strict: true, input_schema: VERKTYG_SCHEMA },
          { name: UNDERLAG_VERKTYG, description: UNDERLAG_TEXT, strict: true, input_schema: UNDERLAG_SCHEMA },
          // Högst fem sökningar per runda, så att tidsgränsen hinner slå till mellan rundorna
          { type: 'web_search_20250305', name: 'web_search', max_uses: 5 },
        ],
        tool_choice: { type: medVerktyg ? 'auto' : 'none' },
        system: [
          { type: 'text', text: o.system.fast, cache_control: cache },
          ...(o.system.kund ? [{ type: 'text' as const, text: o.system.kund, cache_control: cache }] : []),
        ],
        messages,
      } as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming, { signal });
      const msg = await stream.finalMessage();
      await loggaClaude(o.anrop, msg.model, msg.usage);

      if (msg.stop_reason === 'refusal') throw new Error(`${modell} vägrade svara`);
      if (msg.stop_reason === 'max_tokens') throw new Error(`${modell} hann inte svara klart`);
      // Hela svaret går tillbaka oförändrat: tänkandet måste följa med till nästa runda
      messages.push({ role: 'assistant', content: msg.content as Anthropic.Beta.Messages.BetaContentBlockParam[] });
      // Svaret är texten efter det sista verktygsblocket
      const sistaVerktyg = msg.content.reduce((sist, b, i) => (b.type === 'text' || b.type === 'thinking' ? sist : i), -1);
      return {
        uppslag: msg.content.flatMap((b) => (b.type === 'tool_use' ? [{ id: b.id, namn: b.name, indata: b.input }] : [])),
        sokningar: msg.content.flatMap((b) => {
          const fraga = b.type === 'server_tool_use' && b.name === 'web_search' ? (b.input as { query?: unknown }).query : null;
          return typeof fraga === 'string' && fraga ? [fraga] : [];
        }),
        pausad: msg.stop_reason === 'pause_turn',
        text: msg.content.slice(sistaVerktyg + 1).flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(''),
        modell: msg.model,
      };
    },
    uppslagssvar(svar) {
      // Allt ligger inuti verktygssvaren. Söker modellen i samma svar som den använder ett
      // eget verktyg körs sökningen klart i nästa runda, och det går bara om meddelandet
      // inte innehåller något annat än verktygssvar.
      messages.push({
        role: 'user',
        content: svar.map((s) => {
          const cachas = s.delar.length > 0 && !filCachad;
          if (cachas) filCachad = true;
          return {
            type: 'tool_result' as const,
            tool_use_id: s.id,
            content: s.delar.length ? [{ type: 'text' as const, text: s.text }, ...s.delar.map(claudeDel)] : s.text,
            ...(cachas ? { cache_control: cache } : {}),
          };
        }),
      } as Anthropic.Beta.Messages.BetaMessageParam);
    },
    meddelande(text) {
      // Av samma skäl hamnar ett meddelande direkt efter verktygssvar i det sista svaret
      const sista = messages[messages.length - 1];
      const svar = sista.role === 'user' && Array.isArray(sista.content) ? sista.content[sista.content.length - 1] : null;
      if (svar?.type === 'tool_result') {
        const fore = typeof svar.content === 'string' ? [{ type: 'text' as const, text: svar.content }] : svar.content ?? [];
        svar.content = [...fore, { type: 'text' as const, text }] as typeof svar.content;
        return;
      }
      messages.push({ role: 'user', content: text });
    },
  };
}

/** Startar ett samtal och kör det tills modellen har ett svar som går att godta. */
export async function samtalMedUppslag<T>(modell: Modell, o: Uppslag<T>): Promise<Samtal<T>> {
  let part: Part;
  if (modell.startsWith('gpt-')) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY saknas');
    part = gptPart(modell, o as Uppslag<unknown>, apiKey);
  } else {
    part = claudePart(modell, o as Uppslag<unknown>);
  }
  const lasta = new Set<string>();
  const svarade = new Set<string>();
  const sokningar = new Set<string>();
  const filer = new Set<string>();

  /** Regeltexten för kontona. Det modellen redan läst står kvar i samtalet och skickas inte igen. */
  const las = (konton: string[]) => [...new Set(konton)].map((k) => {
    if (lasta.has(k)) return `KONTO ${k}: du har redan läst det här kontot.`;
    const text = o.lasKonto(k);
    if (!text.endsWith('finns inte bland K1-kontona.')) lasta.add(k);
    return text;
  }).join('\n\n---\n\n');

  const signal = AbortSignal.timeout(Math.max(1, o.hardGrans - Date.now()));
  let tidSlut = false;
  try {
    for (;;) {
      if (!tidSlut && Date.now() >= o.mjukGrans) {
        tidSlut = true;
        part.meddelande(TID_SLUT);
      }
      const r = await part.runda(!tidSlut, signal);
      svarade.add(r.modell);
      for (const s of r.sokningar) sokningar.add(s);
      if (r.pausad) continue;
      if (r.uppslag.length) {
        const svar: Uppslagssvar[] = [];
        for (const u of r.uppslag) {
          if (u.namn === UNDERLAG_VERKTYG) {
            const f = await o.lasUnderlag(listaUr(u.indata, 'rader'));
            for (const namn of f.filer) filer.add(namn);
            svar.push({ id: u.id, text: f.text || 'Ange minst en rad ur kundens lista, till exempel K12.', delar: f.delar });
          } else {
            svar.push({ id: u.id, text: las(listaUr(u.indata, 'konton')) || 'Ange minst ett konto ur K1-kontoplanen.', delar: [] });
          }
        }
        part.uppslagssvar(svar);
        continue;
      }
      if (!r.text) throw new Error(`${modell} gav inget svar`);
      const data = JSON.parse(r.text) as T;
      const fel = tidSlut ? null : o.prova(data);
      if (!fel) return { data, tidSlut, lasta, svarade, sokningar, filer };
      part.meddelande(fel);
    }
  } catch (err) {
    if (signal.aborted) throw new Error(`${modell} hann inte svara inom tidsgränsen, så transaktionen konterades inte. Kör om den.`);
    throw err;
  }
}
