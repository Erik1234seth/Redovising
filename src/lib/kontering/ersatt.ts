import type { SupabaseClient } from '@supabase/supabase-js';
import { tolkaBetalsatt } from './betalsatt';
import { TRANSAKTION_KOLUMNER, verifikationsrader, type ValdKontering } from './kontera';
import { slutligKontering } from './preliminar';
import type { Flagga } from './regelverk';

/**
 * Kör om alla: en bokförd transaktion har konterats om. Blev det samma
 * verifikation ligger den kvar. Blev det något annat — ett annat konto,
 * en annan moms, eller ingen klar kontering alls — tas verifikationen bort,
 * och transaktionen är preliminär igen: grön blir den verifikation om 14
 * dagar, annars väntar den på Granska. Har dublettkollen nu kommit fram till
 * att transaktionen är en dubblett tas verifikationen bort på samma sätt.
 *
 * Utom när perioden redan är inlämnad till Skatteverket — momsperioden
 * (månad, kvartal eller år) eller inkomståret. Då ligger verifikationen kvar,
 * och konteringarna får en flagga om att den avviker, så att den rättas för
 * hand.
 *
 * Bara AI-konteringens verifikationer (kalla ai) rörs. SIE-importen och
 * dagskassorna har inga transaktioner att kontera om.
 */

export interface Ersattning {
  /** Verifikationer som togs bort för att konteringen ändrats. */
  ersatta: number;
  /** Verifikationer som låg kvar för att konteringen blev densamma. */
  oforandrade: number;
  /** Verifikationer som avviker men ligger kvar för att perioden är inlämnad. */
  inlamnade: number;
}

type Rad = Parameters<typeof verifikationsrader>[0] & { vald_kontering: ValdKontering | null; dublett_av: string | null; dublett_orsak: string | null };

const nyckel = (rader: { konto: string; belopp: number }[]) =>
  rader.filter((r) => Math.abs(r.belopp) >= 0.005).map((r) => `${r.konto}:${Math.round(r.belopp * 100)}`).sort().join('|');

/** Periodnycklarna i `inlamningar` som ett datum hör till. */
function perioder(datum: string): { moms: string[]; ne: string } {
  const ar = datum.slice(0, 4);
  const manad = Number(datum.slice(5, 7));
  return { moms: [`${ar}-${String(manad).padStart(2, '0')}`, `${ar}-K${Math.ceil(manad / 3)}`, ar], ne: ar };
}

export async function ersattVerifikationer(supabase: SupabaseClient, userId: string, transaktionIds: string[]): Promise<Ersattning> {
  const res: Ersattning = { ersatta: 0, oforandrade: 0, inlamnade: 0 };
  if (!transaktionIds.length) return res;

  const { data: verif, error } = await supabase.from('verifikationer')
    .select('id, transaktion_id, datum, verifikation_rader(konto, belopp, borttagen)')
    .in('transaktion_id', transaktionIds).eq('user_id', userId).eq('kalla', 'ai');
  if (error) throw new Error(`Kunde inte läsa verifikationerna: ${error.message}`);
  if (!verif?.length) return res;

  const ids = verif.map((v) => v.transaktion_id as string);
  const [{ data: trans, error: tFel }, { data: konteringar, error: kFel }, { data: profil }, { data: inl }] = await Promise.all([
    supabase.from('transaktioner').select(`${TRANSAKTION_KOLUMNER}, vald_kontering, dublett_av, dublett_orsak`).in('id', ids),
    supabase.from('konteringar').select('transaktion_id, modell, konto, momssats, momsdelar, omdome, flaggor').in('transaktion_id', ids),
    supabase.from('profiles').select('har_foretagskonto').eq('id', userId).maybeSingle(),
    supabase.from('inlamningar').select('typ, period').eq('profile_id', userId),
  ]);
  if (tFel ?? kFel) throw new Error(`Kunde inte läsa transaktionerna: ${(tFel ?? kFel)!.message}`);
  const betalsatt = tolkaBetalsatt(profil?.har_foretagskonto ?? null);
  const inlamnad = new Set((inl ?? []).map((r) => `${r.typ}:${r.period}`));
  const arInlamnad = (datum: string | null) => {
    if (!datum) return false;
    const p = perioder(datum);
    return p.moms.some((m) => inlamnad.has(`moms:${m}`)) || inlamnad.has(`ne:${p.ne}`);
  };

  for (const v of verif) {
    const t = (trans ?? []).find((x) => x.id === v.transaktion_id) as unknown as Rad | undefined;
    if (!t) continue;
    const k = (konteringar ?? []).filter((x) => x.transaktion_id === t.id);
    const dublett = !!(t.dublett_av || t.dublett_orsak);
    const slutlig = dublett ? null : slutligKontering(t.vald_kontering, k);

    let samma = false;
    if (slutlig && betalsatt) {
      try {
        const nya = verifikationsrader(t, slutlig.konto, slutlig.momssats, betalsatt, slutlig.motkonto ?? undefined, slutlig.momsdelar);
        const gamla = ((v.verifikation_rader ?? []) as { konto: string; belopp: number; borttagen: boolean }[])
          .filter((r) => !r.borttagen).map((r) => ({ konto: r.konto, belopp: Number(r.belopp) }));
        samma = nyckel(nya) === nyckel(gamla);
      } catch {
        samma = false;
      }
    }
    if (samma) { res.oforandrade++; continue; }

    if (arInlamnad(v.datum)) {
      res.inlamnade++;
      const text = dublett
        ? 'Är nu markerad som dubblett, men verifikationen ligger kvar eftersom perioden är inlämnad — rätta för hand.'
        : 'Den nya konteringen avviker från den bokförda verifikationen, men perioden är inlämnad och verifikationen ligger kvar — rätta för hand.';
      for (const x of k) {
        const flaggor: Flagga[] = [...((x.flaggor ?? []) as Flagga[]).filter((f) => f.typ !== 'inlamnad'), { typ: 'inlamnad', allvar: 'granskning', text }];
        await supabase.from('konteringar').update({ flaggor, omdome: x.omdome === 'gron' ? 'gul' : x.omdome })
          .eq('transaktion_id', t.id).eq('modell', x.modell);
      }
      continue;
    }

    const { error: dFel } = await supabase.from('verifikationer').delete().eq('id', v.id);
    if (dFel) throw new Error(`Kunde inte ta bort verifikationen: ${dFel.message}`);
    // Preliminär igen från nu — konteringen satte redan tiden, men en dubblett konteras inte
    await supabase.from('transaktioner').update({ preliminar_at: dublett ? null : new Date().toISOString() }).eq('id', t.id);
    res.ersatta++;
  }
  return res;
}
