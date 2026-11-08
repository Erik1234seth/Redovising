/**
 * Regelmasterns AI-regler: byråns textregler för hur AI:n ska kontera och
 * bedöma (Regel-ID, Område, När gäller regeln?, Vad ska AI göra?, Kontroll och
 * undantag). Var kontoplan har sina, i `kontoplan_ai_regler`; de laddas ner och
 * importeras på fliken Regler (./regelmaster).
 *
 * Konteringen skickar med ALLA regler varje gång, i instruktionen före
 * kontoplanen. Den texten är lika för alla kunder och cachas därför när flera
 * kunder konteras i rad. laddaK1Andringar läser in den löpande kontoplanens
 * regler när en kontering börjar.
 */

export interface AiRegel {
  id: string;
  omrade: string;
  galler: string;
  gor: string;
  kontroll: string;
}

let aktuella: AiRegel[] = [];

export function anvandAiRegler(regler: AiRegel[]): void {
  aktuella = regler;
}

/** Reglerna som ett textblock till konteringens instruktion. Tomt när byrån inte importerat några. */
export function byransAiRegler(): string {
  if (!aktuella.length) return '';
  return `BYRÅNS REGELMASTER — regler för hur du bedömer, konterar och frågar. De gäller alla kunder. Byråns kontext och instruktioner för en kund går före. Byråns principer ovan gäller också.
${aktuella.map((r) => [
    `[${r.id}]${r.omrade ? ` ${r.omrade}` : ''}`,
    r.galler && `När: ${r.galler}`,
    r.gor && `Gör: ${r.gor}`,
    r.kontroll && `Kontroll och undantag: ${r.kontroll}`,
  ].filter(Boolean).join('\n')).join('\n\n')}`;
}
