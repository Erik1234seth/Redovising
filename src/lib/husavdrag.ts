// ROT- och RUT-avdrag på fakturor (regler för 2026).
// Hela fakturabeloppet inkl. moms räknas som arbete. Kunden betalar resten,
// och säljaren begär mellanskillnaden från Skatteverket.

export type HusavdragTyp = 'rot' | 'rut';

export const HUSAVDRAG_PROCENT: Record<HusavdragTyp, number> = { rot: 30, rut: 50 };

export interface Husavdrag {
  typ: HusavdragTyp;
  procent: number;
  personnummer: string;
  fastighet: string | null; // ROT: fastighetsbeteckning eller BRF + lägenhetsnummer
  info: string | null; // fritext från den som gör fakturan
  arbetskostnad: number; // inkl. moms
  avdrag: number;
  att_betala: number;
}

// Skatteverket vill ha hela kronor, avrundat nedåt.
export function beraknaAvdrag(typ: HusavdragTyp, arbetskostnad: number) {
  return Math.floor(arbetskostnad * HUSAVDRAG_PROCENT[typ] / 100);
}

export function husavdragEtikett(typ: HusavdragTyp) {
  return typ === 'rot' ? 'ROT-avdrag' : 'RUT-avdrag';
}
