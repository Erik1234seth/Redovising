import { openaiFetch } from '@/lib/ai-anrop';

/**
 * Det omgången behöver hos OpenAI: filerna, anropet i bakgrunden och svaret.
 *
 * Bakgrundsläget (background: true) kör anropet hos OpenAI utan att vi håller
 * en uppkoppling öppen. Ett anrop med alla kundens underlag på hög tankenivå
 * tar ofta längre än Vercels fem minuter, så vi skickar, får ett id och frågar
 * efter svaret senare. Svaret sparas hos OpenAI (store: true) tills vi hämtat det.
 *
 * Batchen på natten skickar exakt samma anrop, bara via Batch-API:t.
 */

const BAS = 'https://api.openai.com/v1';
/** Filerna raderas när svaret hämtats. Blir de kvar ändå tar OpenAI bort dem efter tre dygn. */
const FILENS_LIVSTID = 3 * 24 * 3600;

function nyckel(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error('OPENAI_API_KEY saknas');
  return k;
}

async function fel(res: Response, vad: string): Promise<Error> {
  return new Error(`${vad}: OpenAI svarade ${res.status}: ${(await res.text()).slice(0, 400)}`);
}

/** Laddar upp en fil och svarar med dess id. Bilder har syftet vision, dokument user_data. */
/** Filändelsen OpenAI känner igen för filtypen. */
const ANDELSE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/rtf': 'rtf',
};

/**
 * Filnamnet som OpenAI får. OpenAI avgör filtypen på ändelsen och känner inte
 * igen versaler: "71.PDF" avvisades. Ändelsen sätts därför efter filtypen, med
 * gemener.
 */
function uppladdningsnamn(namn: string, mime: string): string {
  const bas = namn.replace(/\.[^./\\]+$/, '') || 'fil';
  const andelse = ANDELSE[mime] ?? (namn.match(/\.([^./\\]+)$/)?.[1] ?? '').toLowerCase();
  return andelse ? `${bas}.${andelse}` : bas;
}

export async function laddaUpp(namn: string, bytes: Buffer, mime: string, syfte: 'vision' | 'user_data'): Promise<string> {
  const form = new FormData();
  form.append('purpose', syfte);
  form.append('expires_after[anchor]', 'created_at');
  form.append('expires_after[seconds]', String(FILENS_LIVSTID));
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), uppladdningsnamn(namn, mime));
  const res = await openaiFetch(`${BAS}/files`, { method: 'POST', headers: { Authorization: `Bearer ${nyckel()}` }, body: form });
  if (!res.ok) throw await fel(res, `Kunde inte ladda upp ${namn}`);
  const json = await res.json();
  return json.id as string;
}

export async function raderaFil(id: string): Promise<void> {
  const res = await openaiFetch(`${BAS}/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${nyckel()}` } });
  // Redan borta är lika bra som raderad
  if (!res.ok && res.status !== 404) throw await fel(res, `Kunde inte radera filen ${id}`);
}

/** Skickar anropet i bakgrunden. Svarar med svarets id. */
export async function skickaIBakgrunden(body: object): Promise<string> {
  const res = await openaiFetch(`${BAS}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nyckel()}` },
    body: JSON.stringify({ ...body, background: true, store: true }),
  });
  if (!res.ok) throw await fel(res, 'Kunde inte skicka omgången');
  const json = await res.json();
  return json.id as string;
}

export type Svarsstatus =
  | { klar: false; status: string }
  | { klar: true; ok: true; text: string; usage: Record<string, unknown> | null; modell: string }
  | { klar: true; ok: false; fel: string; usage: Record<string, unknown> | null; modell: string };

interface Utdata { type: string; content?: { type: string; text?: string; refusal?: string }[] }

/** Frågar efter svaret. Klart är det när status inte längre är queued eller in_progress. */
export async function hamtaSvar(id: string): Promise<Svarsstatus> {
  const res = await openaiFetch(`${BAS}/responses/${id}`, { headers: { Authorization: `Bearer ${nyckel()}` } });
  if (!res.ok) throw await fel(res, 'Kunde inte hämta svaret');
  const json = await res.json();
  const status = String(json.status ?? '');
  if (status === 'queued' || status === 'in_progress') return { klar: false, status };

  const usage = json.usage ?? null;
  const modell = String(json.model ?? '');
  if (status !== 'completed') {
    const orsak = json.incomplete_details?.reason === 'max_output_tokens'
      ? 'Svaret blev för långt och klipptes — dela omgången i färre underlag'
      : json.error?.message ?? json.incomplete_details?.reason ?? status;
    return { klar: true, ok: false, fel: `Modellen blev inte klar (${status}): ${orsak}`, usage, modell };
  }
  const delar = ((json.output ?? []) as Utdata[]).filter((u) => u.type === 'message').flatMap((u) => u.content ?? []);
  const vagran = delar.find((d) => d.type === 'refusal');
  if (vagran) return { klar: true, ok: false, fel: `Modellen vägrade: ${vagran.refusal}`, usage, modell };
  return { klar: true, ok: true, text: delar.filter((d) => d.type === 'output_text').map((d) => d.text ?? '').join(''), usage, modell };
}

export async function avbryt(id: string): Promise<void> {
  const res = await openaiFetch(`${BAS}/responses/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${nyckel()}` } });
  if (!res.ok && res.status !== 404 && res.status !== 400) throw await fel(res, 'Kunde inte avbryta');
}
