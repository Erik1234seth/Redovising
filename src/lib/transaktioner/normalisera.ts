/**
 * Formen på en utläst transaktion, och städningen av det vi får tillbaka.
 *
 * Båda vägarna — synen för bilder och sandlådan för kalkylblad — svarar med
 * samma fält, så att de blir samma rader i databasen. Städningen är medvetet
 * försiktig: hellre ett tomt datum än ett gissat.
 */

export interface ExtraheradTransaktion {
  datum: string;
  beskrivning: string;
  motpart: string;
  belopp: number;
  moms: number;
  valuta: string;
  riktning: 'in' | 'ut';
  anteckning: string;
}

const rensa = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Datum som inte är ett riktigt datum sparas som tomt i stället för att gissa. */
export function tolkaDatum(value: unknown): string {
  const text = rensa(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  // Tolkningen skriver ibland 2026-3-4, och pandas 2026-03-04 00:00:00
  const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return '';
}

/**
 * Tal kommer som tal från sandlådan men kan komma som text från synen —
 * "1 250,00" och "-342.50" ska båda bli siffror.
 */
function tolkaTal(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = rensa(value).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

export function normaliseraRader(rader: unknown[]): ExtraheradTransaktion[] {
  return rader.map((row) => {
    const t = (row ?? {}) as Record<string, unknown>;
    const belopp = tolkaTal(t.belopp);
    return {
      datum: tolkaDatum(t.datum),
      beskrivning: rensa(t.beskrivning),
      motpart: rensa(t.motpart),
      belopp: Math.abs(belopp),
      moms: Math.abs(tolkaTal(t.moms)),
      valuta: (rensa(t.valuta) || 'SEK').toUpperCase().slice(0, 8),
      // Ett negativt belopp betyder pengar ut, även när fältet säger något annat
      riktning: belopp < 0 ? 'ut' : t.riktning === 'in' ? 'in' : 'ut',
      anteckning: rensa(t.anteckning),
    } satisfies ExtraheradTransaktion;
  // Rader utan både belopp och text säger ingenting — de är oftast rubriker
  }).filter((t) => t.belopp > 0 || t.beskrivning);
}
