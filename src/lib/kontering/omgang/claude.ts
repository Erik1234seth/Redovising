import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { instruktion, schema, type Indatafil } from './anrop';
import type { Svarsstatus } from './openai';

/**
 * Flöde med Claude: samma omgång som hos OpenAI (./openai), med samma
 * instruktion, K1 och schema — bara sättet att skicka skiljer.
 *
 * Claude har inget bakgrundsläge, och ett anrop med alla kundens underlag på
 * hög tankenivå tar längre än Vercels fem minuter. Omgången skickas därför
 * som en batch med ett enda anrop: vi får ett id och frågar efter svaret
 * senare, precis som hos OpenAI. Batchen kostar hälften, men Anthropic lovar
 * inte när den är klar — oftast inom några minuter, högst ett dygn.
 *
 * Filerna laddas upp till Claudes Files API och raderas när svaret hämtats.
 * Word-filer läser Claude inte (./forbered hoppar över dem). Ingen reservmodell
 * vid en vägran: Batch-API:t tar inte emot fallbacks.
 */

export const CLAUDE_MODELL = 'claude-opus-5-5';
/** Svarets tak med tänkandet. Batchen har ingen tidsgräns att hålla sig under. */
const MAX_UTDATA = 128_000;
/** Filerna raderas när svaret hämtats. Blir de kvar tar Anthropic bort dem efter tre dygn. */
const FILENS_LIVSTID = 3 * 24 * 3600;
/** Högst så här många sökningar per omgång — fler gör att svaret pausar mitt i, och en batch kan inte fortsätta. */
const MAX_SOKNINGAR = 8;

let klient: Anthropic | null = null;
function claude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY saknas');
  klient ??= new Anthropic({ maxRetries: 4 });
  return klient;
}

export async function laddaUpp(namn: string, bytes: Buffer, mime: string): Promise<string> {
  try {
    const fil = await claude().files.upload({ file: await toFile(bytes, namn, { type: mime }), expires_in_seconds: FILENS_LIVSTID });
    return fil.id;
  } catch (err) {
    throw new Error(`Kunde inte ladda upp ${namn} till Claude: ${err instanceof Error ? err.message : err}`);
  }
}

export async function raderaFil(id: string): Promise<void> {
  try {
    await claude().files.delete(id);
  } catch (err) {
    // Redan borta är lika bra som raderad
    if (err instanceof Anthropic.NotFoundError) return;
    throw err;
  }
}

type Schema = { type?: unknown; enum?: unknown[]; description?: string; properties?: Record<string, Schema>; items?: Schema; required?: string[] };

/**
 * Schemat som Claude tar emot. Hela schemat blir en för stor grammatik hos
 * Claude, och uppgifternas 19 fält som kan vara null går över Claudes gräns på
 * 16 (prövat 2026-11-10). Uppgifterna skickas därför som en JSON-sträng med
 * fälten i beskrivningen, och görs om till ett objekt när svaret kommer
 * (`medUppgifter`). En tom lista att välja ur (kunden har inga regler) går inte
 * heller, och blir fri text.
 */
export function claudeSchema(s: Schema): Schema {
  const kopia: Schema = { ...s };
  if (Array.isArray(s.enum) && !s.enum.length) delete kopia.enum;
  if (s.items) kopia.items = claudeSchema(s.items);
  if (s.properties) {
    kopia.properties = Object.fromEntries(Object.entries(s.properties).map(([namn, p]) => [namn, namn === 'uppgifter' ? somText(p) : claudeSchema(p)]));
  }
  return kopia;
}

/** Ett objekt som JSON-text, med fälten och deras typer beskrivna. */
function somText(s: Schema): Schema {
  const typ = (p: Schema): string => {
    if (p.type === 'array' && p.items?.properties) return `lista av {${Object.keys(p.items.properties).join(', ')}}`;
    return (Array.isArray(p.type) ? p.type : [p.type]).join(' eller ');
  };
  const falt = Object.entries(s.properties ?? {}).map(([namn, p]) => `${namn} (${typ(p)}${p.description ? `: ${p.description}` : ''})`);
  return { type: 'string', description: `Ett JSON-objekt med exakt de här fälten, null när uppgiften saknas: ${falt.join('; ')}` };
}

/** Svaret med uppgifterna som objekt igen. Text som inte går att läsa blir ett tomt objekt. */
function medUppgifter(text: string): string {
  try {
    const svar = JSON.parse(text) as { filer?: { transaktioner?: { uppgifter?: unknown }[] }[] };
    for (const f of svar.filer ?? []) {
      for (const t of f.transaktioner ?? []) {
        if (typeof t.uppgifter !== 'string') continue;
        try {
          const u = JSON.parse(t.uppgifter);
          t.uppgifter = u && typeof u === 'object' && !Array.isArray(u) ? u : {};
        } catch {
          t.uppgifter = {};
        }
      }
    }
    return JSON.stringify(svar);
  } catch {
    // Prövningen säger till att svaret inte är JSON
    return text;
  }
}

/** Anropets kropp: instruktionen och K1 först (cachas), sedan kunden, sist underlagen. */
export function byggKropp(kund: string, alla: Indatafil[], regelIdn: string[]): Anthropic.Messages.MessageCreateParamsNonStreaming {
  const fore = alla.filter((f) => f.granne === 'fore');
  const filer = alla.filter((f) => !f.granne);
  const efter = alla.filter((f) => f.granne === 'efter');
  const content: Anthropic.Messages.ContentBlockParam[] = [{ type: 'text', text: kund }];
  const text = (t: string) => content.push({ type: 'text', text: t });
  const lagg = (lista: Indatafil[]) => {
    for (const f of lista) {
      text(f.rubrik);
      const i = f.innehall;
      if (i.typ === 'bild') content.push({ type: 'image', source: { type: 'file', file_id: i.fileId } });
      else if (i.typ === 'dokument') content.push({ type: 'document', source: { type: 'file', file_id: i.fileId }, title: i.namn });
      else text(i.text);
    }
  };
  if (fore.length) {
    text(`SIDOR FÖRE (${fore.length} filer närmast före dina, läses i ett annat anrop — svara inte för dem):`);
    lagg(fore);
  }
  text(`UNDERLAGEN (${filer.length} filer):`);
  lagg(filer);
  if (efter.length) {
    text(`SIDOR EFTER (${efter.length} filer närmast efter dina, läses i ett annat anrop — svara inte för dem):`);
    lagg(efter);
  }
  text(`Gå igenom alla ${filer.length} filerna (${filer.map((f) => f.fil).join(', ')}) och svara i formatet.`);
  return {
    model: CLAUDE_MODELL,
    max_tokens: MAX_UTDATA,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: claudeSchema(schema(regelIdn)) as Record<string, unknown> } },
    // Instruktionen och K1 är lika för alla kunder: cachas en timme
    system: [{ type: 'text', text: instruktion(), cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages: [{ role: 'user', content }],
    // Internet, framför allt för att slå upp motpartens VAT-nummer när underlaget saknar det
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_SOKNINGAR }],
  };
}

/** Skickar omgången som en batch med ett anrop. Svarar med batchens id. */
export async function skicka(kropp: object): Promise<string> {
  const batch = await claude().messages.batches.create({
    requests: [{ custom_id: 'omgang', params: kropp as Anthropic.Messages.MessageCreateParamsNonStreaming }],
  });
  return batch.id;
}

/** Frågar efter svaret. Klart är det när batchen är slut. */
export async function hamtaSvar(id: string): Promise<Svarsstatus> {
  const batch = await claude().messages.batches.retrieve(id);
  if (batch.processing_status !== 'ended') return { klar: false, status: batch.processing_status };

  let svar: Anthropic.Messages.Batches.MessageBatchIndividualResponse | null = null;
  for await (const r of await claude().messages.batches.results(id)) svar = r;
  const tom = { usage: null, modell: CLAUDE_MODELL, sokningar: [] as string[] };
  if (!svar) return { klar: true, ok: false, fel: 'Batchen gav inget svar', ...tom };
  const r = svar.result;
  if (r.type === 'errored') return { klar: true, ok: false, fel: `Claude svarade med fel: ${r.error.error?.message ?? JSON.stringify(r.error).slice(0, 300)}`, ...tom };
  if (r.type !== 'succeeded') return { klar: true, ok: false, fel: r.type === 'expired' ? 'Batchen hann inte köras inom ett dygn' : 'Batchen avbröts', ...tom };

  const msg = r.message;
  const usage = msg.usage as unknown as Record<string, unknown>;
  const sokningar = msg.content.flatMap((b) => {
    const q = b.type === 'server_tool_use' && b.name === 'web_search' ? (b.input as { query?: unknown }).query : null;
    return typeof q === 'string' && q ? [q] : [];
  });
  const bas = { usage, modell: msg.model, sokningar };
  if (msg.stop_reason === 'refusal') return { klar: true, ok: false, fel: 'Claude vägrade svara', ...bas };
  if (msg.stop_reason === 'max_tokens') return { klar: true, ok: false, fel: 'Svaret blev för långt och klipptes — dela omgången i färre underlag', ...bas };
  if (msg.stop_reason === 'pause_turn') return { klar: true, ok: false, fel: 'Claude pausade mitt i sökningarna och hann inte svara — kör om', ...bas };
  // Svaret är texten efter det sista verktygsblocket (sökningarna)
  const sista = msg.content.reduce((s, b, i) => (b.type === 'text' || b.type === 'thinking' || b.type === 'redacted_thinking' ? s : i), -1);
  const text = msg.content.slice(sista + 1).flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return { klar: true, ok: true, text: medUppgifter(text), ...bas };
}

export async function avbryt(id: string): Promise<void> {
  try {
    await claude().messages.batches.cancel(id);
  } catch (err) {
    if (err instanceof Anthropic.NotFoundError || err instanceof Anthropic.BadRequestError) return;
    throw err;
  }
}
