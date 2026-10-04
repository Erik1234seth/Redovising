import type { Betalsatt } from '@/lib/admin-types';

export type { Betalsatt };

/**
 * `profiles.har_foretagskonto` har två generationer av värden: först ja/nej
 * ("har du företagskonto?"), numera vilket konto som används. Båda finns kvar.
 */
export function tolkaBetalsatt(v: string | null | undefined): Betalsatt | null {
  if (v === 'foretagskonto' || v === 'ja') return 'foretagskonto';
  if (v === 'privatkonto' || v === 'nej') return 'privatkonto';
  if (v === 'bada') return 'bada';
  return null;
}
