/**
 * Kundspecifika regler — konteringens AI väljer vilka som gäller.
 *
 * Varje regel säger när den gäller och vad den som konterar då ska göra.
 * Transaktionen styr: båda modellerna får hela listan i första passet och
 * svarar med id på de regler som stämmer. Granskningen (andra passet) prövar
 * kontot mot de valda reglernas instruktioner. Valet sparas i
 * `konteringar.regler`.
 *
 * Kryssrutor på kunden (t.ex. Periodisk sammanfattning) styr inte reglerna —
 * de är till för kalendern och påminnelserna.
 */

export interface Kundregel {
  id: string;
  namn: string;
  /** När regeln gäller. */
  galler: string;
  /** Vad den som konterar ska göra när regeln gäller. */
  instruktion: string;
}

export const KUNDREGLER: Kundregel[] = [
  {
    id: 'periodisk-sammanstallning',
    namn: 'Periodisk sammanställning',
    galler: 'Försäljning (pengar in) av varor eller tjänster till ett företag i ett annat EU-land utan svensk moms — t.ex. köparen har ett VAT-nummer från ett annat EU-land, eller fakturan anger omvänd skattskyldighet / reverse charge. Gäller inte försäljning till privatpersoner, till svenska företag eller till länder utanför EU.',
    instruktion: 'Köparen redovisar momsen, så ingen svensk utgående moms tas ut: momssats 0, momshantering "ingen". Varor bokförs på 3108, tjänster på 3308 — aldrig på 3100. Försäljningen ska med i den periodiska sammanställningen och i momsdeklarationen (ruta 35 för varor, ruta 39 för tjänster), så köparens VAT-nummer måste finnas. Skriv köparens VAT-nummer i motiveringen.',
  },
];

export const REGEL_IDN = KUNDREGLER.map((r) => r.id);

/** Hela listan till konteringens första pass. */
export function reglerAttValja(): string {
  return KUNDREGLER.map((r) => `- ${r.id} (${r.namn})\n  Gäller när: ${r.galler}\n  Gör så här: ${r.instruktion}`).join('\n');
}

/** Instruktionerna för de valda reglerna, till granskningen. Tom när ingen gäller. */
export function regelText(ids: string[]): string {
  const regler = ids.map((id) => KUNDREGLER.find((r) => r.id === id)).filter((r): r is Kundregel => !!r);
  if (!regler.length) return '';
  return `KUNDREGLER SOM GÄLLER (byråns instruktion):\n${regler.map((r) => `- ${r.namn}: ${r.instruktion}`).join('\n')}`;
}

export const regelNamn = (id: string) => KUNDREGLER.find((r) => r.id === id)?.namn ?? id;
