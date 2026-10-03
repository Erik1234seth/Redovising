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

/** En konteringsrad som den står i underlaget. */
export interface ExtraheradRad {
  konto: string;
  kontonamn: string;
  /** Debet positivt, kredit negativt — samma tecken som i SIE. */
  belopp: number;
  text: string;
}

/**
 * En verifikation ur ett underlag som redan är bokfört — en verifikationslista,
 * grundbok eller huvudbok. Kontona kommer från underlaget, inte från AI:n.
 */
export interface ExtraheradVerifikation {
  serie: string;
  nummer: string;
  datum: string;
  text: string;
  rader: ExtraheradRad[];
  /** Summan av raderna. Noll när verifikationen går jämnt ut. */
  summa: number;
  balanserad: boolean;
}

const avrunda = (n: number) => Math.round(n * 100) / 100;

/**
 * AI:n skriver debet och kredit i var sin kolumn, som i underlaget. Här blir
 * de ett belopp med tecken, och varje verifikation summeras — det är den
 * summan som avgör om den sparas.
 */
export function normaliseraVerifikationer(lista: unknown[]): ExtraheradVerifikation[] {
  return lista.map((item) => {
    const v = (item ?? {}) as Record<string, unknown>;
    const rader = (Array.isArray(v.rader) ? v.rader : []).map((r) => {
      const rad = (r ?? {}) as Record<string, unknown>;
      // Ett ensamt belopp med tecken går också bra, om debet och kredit saknas
      const belopp = 'debet' in rad || 'kredit' in rad
        ? tolkaTal(rad.debet) - tolkaTal(rad.kredit)
        : tolkaTal(rad.belopp);
      return {
        konto: rensa(String(rad.konto ?? '')).replace(/\s/g, ''),
        kontonamn: rensa(rad.kontonamn),
        belopp: avrunda(belopp),
        text: rensa(rad.text),
      } satisfies ExtraheradRad;
    }).filter((r) => r.konto || r.belopp !== 0);

    const summa = avrunda(rader.reduce((s, r) => s + r.belopp, 0));
    return {
      serie: rensa(String(v.serie ?? '')),
      nummer: rensa(String(v.nummer ?? '')),
      datum: tolkaDatum(v.datum),
      text: rensa(v.text),
      rader,
      summa,
      // Minst två rader med riktiga konton, och de ska ta ut varandra
      balanserad: Math.abs(summa) < 0.005
        && rader.length >= 2
        && rader.every((r) => /^\d{3,6}$/.test(r.konto)),
    } satisfies ExtraheradVerifikation;
  }).filter((v) => v.rader.length > 0);
}

export type Underlagstyp = 'transaktioner' | 'verifikationer';

export interface TolkatSvar {
  typ: Underlagstyp;
  transaktioner: ExtraheradTransaktion[];
  verifikationer: ExtraheradVerifikation[];
}

/**
 * Tolkar svaret från båda vägarna — synen och sandlådan. Ett svar med
 * verifikationer men utan typ räknas som verifikationer: listan säger mer än
 * ett saknat fält.
 */
export function tolkaSvar(parsed: unknown): TolkatSvar {
  // Äldre form: bara en lista med transaktioner
  if (Array.isArray(parsed)) return { typ: 'transaktioner', transaktioner: normaliseraRader(parsed), verifikationer: [] };

  const svar = (parsed ?? {}) as { typ?: unknown; transaktioner?: unknown; verifikationer?: unknown };
  const verifikationer = Array.isArray(svar.verifikationer) ? normaliseraVerifikationer(svar.verifikationer) : [];
  const transaktioner = Array.isArray(svar.transaktioner) ? normaliseraRader(svar.transaktioner) : [];

  if (svar.typ === 'verifikationer' || (verifikationer.length > 0 && transaktioner.length === 0)) {
    return { typ: 'verifikationer', transaktioner: [], verifikationer };
  }
  return { typ: 'transaktioner', transaktioner, verifikationer: [] };
}
