import { arVarAdress } from './var-fil';
import { isSieFile } from '@/lib/sie/parse';
import { kanLasasAvAi } from './filtyp';

/**
 * Sorteringen av kundens filer: underlag för bokföringen, eller övriga filer
 * som är bra att ha men inte ska konteras.
 *
 * Det som går att avgöra på namn och avsändare sorteras här, direkt när filen
 * kommer in. Resten sorterar AI-avläsningen (se `OVRIGTREGEL`), som ändå läser
 * hela filen — och då innan något hunnit bli transaktioner.
 *
 * `bokforing_underlag.sortering` är 'underlag', 'ovrigt' eller null (inte
 * sorterad än — visas bland underlagen tills avläsningen sorterat den).
 */

export type Sortering = 'underlag' | 'ovrigt';

/** Orsaken när Erik flyttat filen själv. Den gäller före AI:ns bedömning. */
export const FLYTTAD_FOR_HAND = 'Flyttad för hand';

/** Bokslutsfliken sätter de här först i namnet (se laddaUppBokslut i personkortet). */
const BOKSLUTSFILER = ['ne-bilaga', 'lager-inventarielista'];

export function sorteraEfterRegler(fileName: string, mimeType: string | null, senderEmail: string | null):
  { sortering: Sortering; sortering_orsak: string } | null {
  if (arVarAdress(senderEmail)) return { sortering: 'ovrigt', sortering_orsak: 'Skickad av oss' };
  const namn = fileName.trim().toLowerCase();
  if (BOKSLUTSFILER.some((p) => namn.startsWith(p))) {
    return { sortering: 'ovrigt', sortering_orsak: 'Bokslutsfil (NE-bilaga eller lagerlista)' };
  }
  if (isSieFile(fileName)) return { sortering: 'underlag', sortering_orsak: 'SIE-fil' };
  // Word, zip och liknande läser vi inte av, och då kan de inte heller konteras
  if (!kanLasasAvAi(fileName, mimeType)) return { sortering: 'ovrigt', sortering_orsak: 'Filtyp som inte läses av' };
  return null;
}

/** Kolumnerna att skriva när filen sparas. Tomt när AI-avläsningen får sortera. */
export function sorteringVidUppladdning(fileName: string, mimeType: string | null, senderEmail: string | null) {
  const regel = sorteraEfterRegler(fileName, mimeType, senderEmail);
  return regel ? { ...regel, sortering_at: new Date().toISOString() } : {};
}
