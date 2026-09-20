import { normaliseraRader, type ExtraheradTransaktion } from './normalisera';

/**
 * Läser ett kalkylblad eller en textlista genom att låta modellen köra Python
 * mot filen i OpenAI:s sandlåda.
 *
 * Filen laddas upp som den är — vi konverterar ingenting. Koden läser den med
 * pandas och skriver resultatet till en fil i sandlådan, som vi hämtar. Det
 * betyder att siffrorna går från cellen till databasen utan att någon skriver
 * av dem, och att filens storlek inte spelar någon roll: raderna passerar
 * aldrig modellens svar, så det finns inget tak att slå i.
 *
 * Priset är att koden skrivs om vid varje körning. Väljer den fel kolumn blir
 * alla rader fel på samma sätt — därför får den också skriva en rad om vad den
 * gjorde, som sparas på underlaget och syns i panelen.
 */

const MODELL = 'gpt-5.5';
const UTFIL = 'transaktioner.json';

const INSTRUKTION = `Du läser underlag åt en svensk bokföringsbyrå. Den bifogade filen är ett kontoutdrag, en transaktionslista eller ett kalkylblad.

Läs filen med pandas (openpyxl för xlsx). Gå igenom ALLA blad och ALLA rader — korta aldrig ner, sampla aldrig, hoppa aldrig över rader.

Skriv resultatet till /mnt/data/${UTFIL} som en JSON-lista med ett objekt per transaktion:
{
  "datum": "YYYY-MM-DD" (tom sträng om datumet inte framgår),
  "beskrivning": "texten som står på raden",
  "motpart": "butik, leverantör eller kund om det framgår, annars tom sträng",
  "belopp": tal med tecknet från filen (negativt = pengar ut),
  "moms": tal, 0 om momsen inte framgår,
  "valuta": "SEK" eller valutan som står i filen,
  "riktning": "in" eller "ut",
  "anteckning": "kort notering när något är oklart, annars tom sträng"
}

Regler:
- Du ska INTE kontera. Inga konton, ingen bokföringsmässig bedömning — skriv bara av det som står.
- En kolumn med löpande saldo eller balans är inte beloppet. Använd beloppskolumnen. Är du osäker: saldot ändras med beloppet mellan raderna, det kan du kontrollera i koden.
- Hoppa över rubriker, adresser, summarader, saldobesked och tomma rader.
- Gissa inte datum som saknas. Lämna fältet tomt och skriv varför i "anteckning".
- Skriv filen med json.dump(..., ensure_ascii=False).

Svara sedan med EN kort rad på svenska om vad du gjorde: vilka blad du läste, vilken kolumn du använde som belopp och hur många rader det blev. Ingen annan text.`;

export interface SandladaResultat {
  transaktioner: ExtraheradTransaktion[];
  /** Modellens egen rad om vad den läste — sparas på underlaget. */
  notering: string;
  modell: string;
}

function api(path: string, apiKey: string, init?: RequestInit) {
  return fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, ...(init?.headers ?? {}) },
  });
}

async function felText(res: Response): Promise<string> {
  const text = await res.text().catch(() => res.statusText);
  try {
    return JSON.parse(text).error?.message ?? text;
  } catch {
    return text;
  }
}

export async function lasMedSandlada(file: {
  buffer: Buffer;
  fileName: string;
  mimeType: string | null;
}): Promise<SandladaResultat> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY saknas');

  // Filen laddas upp orörd. Den ligger hos OpenAI tills vi raderar den nedan,
  // så raderingen sker även när körningen misslyckas.
  const form = new FormData();
  form.append('purpose', 'assistants');
  form.append('file', new Blob([new Uint8Array(file.buffer)], {
    type: file.mimeType || 'application/octet-stream',
  }), file.fileName);

  const upload = await api('/files', apiKey, { method: 'POST', body: form });
  if (!upload.ok) throw new Error(`Filen kunde inte laddas upp till AI-tjänsten: ${await felText(upload)}`);
  const { id: fileId } = await upload.json();

  try {
    const res = await api('/responses', apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELL,
        tools: [{ type: 'code_interpreter', container: { type: 'auto', file_ids: [fileId] } }],
        input: INSTRUKTION,
      }),
    });
    if (!res.ok) throw new Error(`AI-tjänsten svarade inte: ${await felText(res)}`);

    const data = await res.json();
    const output = (data.output ?? []) as { type: string; container_id?: string; content?: { type: string; text?: string }[] }[];

    const notering = output
      .filter((o) => o.type === 'message')
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text ?? '')
      .join(' ')
      .trim();

    const containerId = output.find((o) => o.type === 'code_interpreter_call')?.container_id;
    if (!containerId) {
      throw new Error(notering ? `AI:n körde ingen kod: ${notering}` : 'AI:n körde ingen kod mot filen');
    }

    const list = await api(`/containers/${containerId}/files`, apiKey);
    if (!list.ok) throw new Error(`Kunde inte läsa sandlådans filer: ${await felText(list)}`);
    const files = (await list.json()).data as { id: string; path?: string }[];

    const ut = files.find((f) => f.path?.endsWith(UTFIL));
    if (!ut) {
      throw new Error(notering ? `AI:n skrev ingen resultatfil: ${notering}` : 'AI:n skrev ingen resultatfil');
    }

    const content = await api(`/containers/${containerId}/files/${ut.id}/content`, apiKey);
    if (!content.ok) throw new Error(`Kunde inte hämta resultatet: ${await felText(content)}`);

    const raw = await content.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Resultatfilen från AI:n var inte giltig JSON');
    }
    if (!Array.isArray(parsed)) throw new Error('Resultatfilen från AI:n innehöll ingen lista');

    return { transaktioner: normaliseraRader(parsed), notering, modell: MODELL };
  } finally {
    // Kundens underlag ska inte bli liggande hos OpenAI
    await api(`/files/${fileId}`, apiKey, { method: 'DELETE' })
      .catch((err) => console.error('[sandlada] kunde inte radera uppladdad fil:', err));
  }
}
