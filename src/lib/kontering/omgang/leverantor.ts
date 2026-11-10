import { kostnadClaude, kostnadOpenAI, loggaClaude, loggaOpenAI, type Anropsinfo } from '@/lib/ai-logg';
import { MODELL, byggKropp as byggGpt, type Indatafil } from './anrop';
import * as claude from './claude';
import * as openai from './openai';
import type { Svarsstatus } from './openai';

/**
 * Modellerna Flöde kan köra med, bakom samma gränssnitt. Instruktionen, K1,
 * schemat och prövningen av svaret är desamma; det som skiljer är hur filerna
 * laddas upp och hur anropet skickas och hämtas.
 *
 *   gpt-6.1-sol      OpenAI, bakgrundsläget (fullpris, svar på några minuter)
 *   claude-opus-5-5  Claude, Batch-API:t (halva priset, svar när batchen körts)
 */

export const FLODESMODELLER = [MODELL, claude.CLAUDE_MODELL] as const;
export type Flodesmodell = (typeof FLODESMODELLER)[number];

export const arFlodesmodell = (m: unknown): m is Flodesmodell => FLODESMODELLER.includes(m as Flodesmodell);

export interface Leverantor {
  modell: Flodesmodell;
  /** Högst så många filer per anrop. */
  maxFiler: number;
  /** Om filtypen går att skicka, annars varför inte. */
  tarEmot(mime: string): string | null;
  laddaUpp(namn: string, bytes: Buffer, mime: string, typ: 'bild' | 'dokument'): Promise<string>;
  raderaFil(id: string): Promise<void>;
  byggKropp(kund: string, indata: Indatafil[], regelIdn: string[]): object;
  skicka(kropp: object): Promise<string>;
  hamtaSvar(id: string): Promise<Svarsstatus>;
  avbryt(id: string): Promise<void>;
  /** Loggar anropet i ai_anrop och svarar med kostnaden i dollar. */
  logga(anrop: Anropsinfo, svar: Extract<Svarsstatus, { klar: true }>): Promise<number | null>;
}

const gpt: Leverantor = {
  modell: MODELL,
  // Svaret har 128 000 tokens med tänkandet; 60 filer tog 43 000
  maxFiler: 150,
  tarEmot: () => null,
  laddaUpp: (namn, bytes, mime, typ) => openai.laddaUpp(namn, bytes, mime, typ === 'bild' ? 'vision' : 'user_data'),
  raderaFil: openai.raderaFil,
  byggKropp: byggGpt,
  skicka: openai.skickaIBakgrunden,
  hamtaSvar: openai.hamtaSvar,
  avbryt: openai.avbryt,
  async logga(anrop, svar) {
    const webb = { webbsokningar: svar.sokningar.length };
    await loggaOpenAI(anrop, svar.modell || MODELL, svar.usage, webb);
    return kostnadOpenAI(svar.modell || MODELL, svar.usage, webb);
  },
};

const opus: Leverantor = {
  modell: claude.CLAUDE_MODELL,
  // Claude har ett tak för antalet bilder per anrop; 100 ligger säkert under det
  maxFiler: 100,
  tarEmot: (mime) => (mime.startsWith('image/') || mime === 'application/pdf' ? null : 'Claude läser inte Word-filer — kör filen med GPT'),
  laddaUpp: (namn, bytes, mime) => claude.laddaUpp(namn, bytes, mime),
  raderaFil: claude.raderaFil,
  byggKropp: claude.byggKropp,
  skicka: claude.skicka,
  hamtaSvar: claude.hamtaSvar,
  avbryt: claude.avbryt,
  async logga(anrop, svar) {
    await loggaClaude(anrop, svar.modell || claude.CLAUDE_MODELL, svar.usage, { batch: true });
    return kostnadClaude(svar.modell || claude.CLAUDE_MODELL, svar.usage, { batch: true });
  },
};

export function leverantor(modell: string | null | undefined): Leverantor {
  return modell === claude.CLAUDE_MODELL ? opus : gpt;
}
