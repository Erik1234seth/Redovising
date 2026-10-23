import type { SupabaseClient } from '@supabase/supabase-js';
import { KUNDREGLER, type Kundregel } from './kundregler';

/**
 * Byråns instruktioner, skrivna på ett steg i flödesschemat.
 *
 * En kontext är fritext — "köparen är ett tyskt företag, VAT DE123…" — och
 * gäller en transaktion, ett underlag, en kund eller alla kunder. En regel har
 * ett villkor och en instruktion, som kundreglerna i koden, och gäller en kund
 * eller alla. Konterings-AI:n väljer själv om en regel passar transaktionen.
 *
 * Båda följer med till alla AI-steg, före och efter steget de skrevs på: en
 * kontext skriven på Skriv mail påverkar också kompletteringen, dublettkollen
 * och konteringen. Steget sparas bara för att visa var den skrevs.
 */

export const INSTRUKTION_STEG = ['komplettera', 'dublett', 'tillrackligt', 'skriv-mejl', 'konteras'] as const;
export type InstruktionSteg = typeof INSTRUKTION_STEG[number];
export type Omfang = 'transaktion' | 'underlag' | 'kund' | 'alla';

export interface Instruktion {
  id: string;
  typ: 'kontext' | 'regel';
  omfang: Omfang;
  steg: InstruktionSteg;
  user_id: string | null;
  underlag_id: string | null;
  transaktion_id: string | null;
  namn: string | null;
  galler: string | null;
  text: string;
  created_at: string;
}

export const KOLUMNER = 'id, typ, omfang, steg, user_id, underlag_id, transaktion_id, namn, galler, text, created_at';

/**
 * Instruktionerna som kan gälla kundens eller underlagens transaktioner.
 * Vilka som gäller en viss transaktion avgör `kontextFor`.
 */
export async function hamtaInstruktioner(
  supabase: SupabaseClient,
  { userId, underlagIds = [] }: { userId: string | null; underlagIds?: string[] },
): Promise<Instruktion[]> {
  const villkor = ['omfang.eq.alla', userId ? `user_id.eq.${userId}` : '', ...underlagIds.map((id) => `underlag_id.eq.${id}`)].filter(Boolean);
  const { data, error } = await supabase.from('flodes_instruktioner').select(KOLUMNER).or(villkor.join(',')).order('created_at');
  if (error) throw new Error(`Kunde inte läsa byråns instruktioner: ${error.message}`);
  return (data ?? []) as Instruktion[];
}

const galler = (i: Instruktion, t: { id: string; underlag_id: string | null; user_id?: string | null }) =>
  i.omfang === 'alla'
  || (i.omfang === 'kund' && (!t.user_id || i.user_id === t.user_id))
  || (i.omfang === 'underlag' && i.underlag_id === t.underlag_id)
  || (i.omfang === 'transaktion' && i.transaktion_id === t.id);

const OMFANG_TEXT: Record<Omfang, string> = {
  transaktion: 'den här transaktionen',
  underlag: 'hela underlaget',
  kund: 'kunden',
  alla: 'alla kunder',
};

/** Kontexterna som gäller transaktionen, som ett textblock. Tom när inga finns. */
export function kontextFor(lista: Instruktion[], t: { id: string; underlag_id: string | null; user_id?: string | null }): string {
  const rader = lista.filter((i) => i.typ === 'kontext' && galler(i, t))
    .map((i) => `- (gäller ${OMFANG_TEXT[i.omfang]}) ${i.text}`);
  return rader.length ? `BYRÅNS KONTEXT (väger tyngre än underlaget och historiken — följ den):\n${rader.join('\n')}` : '';
}

/** Kundreglerna i koden plus de byrån lagt till, för kunden. */
export function reglerFor(lista: Instruktion[], userId?: string | null): Kundregel[] {
  const egna = lista.filter((i) => i.typ === 'regel' && (i.omfang === 'alla' || !userId || i.user_id === userId))
    .map((i) => ({ id: i.id, namn: i.namn || 'Byråns regel', galler: i.galler || 'Alltid', instruktion: i.text }));
  return [...KUNDREGLER, ...egna];
}

/** Byråns tillagda regler som text, till stegen som inte väljer regler själva. Tom när inga finns. */
export function reglerText(lista: Instruktion[], userId?: string | null): string {
  const egna = reglerFor(lista, userId).filter((r) => !KUNDREGLER.includes(r));
  if (!egna.length) return '';
  return `BYRÅNS REGLER (följ en regel när transaktionen stämmer med "Gäller när"):\n${egna.map((r) => `- ${r.namn}\n  Gäller när: ${r.galler}\n  Gör så här: ${r.instruktion}`).join('\n')}`;
}
