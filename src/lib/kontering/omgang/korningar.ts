import type { Provrad } from './prov';
import type { Resultat, ResultatTransaktion } from './svar';

/**
 * Flödes körningar som de visas: en ny körning ersätter de äldre för samma
 * underlag. Används av Flöde (/api/admin/kontering-prov) och kundlistan
 * (/api/admin/flode), så att siffrorna i listan stämmer med flikarna.
 */

/**
 * Filer som körts om senare tas bort ur den äldre körningen, och en del där
 * allt körts om visas inte alls. En körning som inte gick att skicka eller
 * blev fel ersätter inget, och inte heller en jämförelse — den är inte
 * bokförd. Raderna kommer nyast först. Raderna i databasen ändras inte.
 */
export function utanOmkorda<R extends Pick<Provrad, 'korning' | 'status' | 'jamfor_med' | 'underlag_ids' | 'filer' | 'resultat'>>(rader: R[]): R[] {
  // Delarna i en körning hålls ihop
  const korningar = new Map<string, R[]>();
  for (const r of rader) korningar.set(r.korning, [...(korningar.get(r.korning) ?? []), r]);

  const senare = new Set<string>();
  const ut: R[] = [];
  for (const delar of korningar.values()) {
    for (const r of delar) {
      const ids = r.underlag_ids ?? [];
      const kvar = ids.filter((id) => !senare.has(id));
      if (kvar.length === ids.length) { ut.push(r); continue; }
      if (!kvar.length) continue;
      const res = r.resultat as Resultat | null;
      ut.push({
        ...r,
        underlag_ids: kvar,
        resultat: res?.filer ? { ...res, filer: res.filer.filter((f) => !senare.has(f.underlagId)) } : r.resultat,
      });
    }
    for (const r of delar) if (r.status !== 'fel' && !r.jamfor_med && r.filer?.length) for (const id of r.underlag_ids ?? []) senare.add(id);
  }
  return ut;
}

const arKopplad = (t: ResultatTransaktion) => !!t.kopplad?.startsWith('Kopplad');
/** Klar: grön, godkänd, ändrad av byrån, eller kopplad till det som redan fanns. Samma som i Flöde (_flode.tsx). */
const arKlar = (t: ResultatTransaktion) => arKopplad(t) || !!t.godkand || !!t.andrad || t.kontering?.omdome === 'gron';

/**
 * Hur många transaktioner som står i Granska, räknat som fliken gör: de som
 * inte är klara, och en klar transaktion som en möjlig dubblett står ihop med.
 */
export function antalIGranska(rader: Pick<Provrad, 'korning' | 'status' | 'jamfor_med' | 'underlag_ids' | 'filer' | 'resultat'>[]): number {
  const poster: { t: ResultatTransaktion; fil: string }[] = [];
  for (const r of utanOmkorda(rader.filter((x) => !x.jamfor_med))) {
    for (const f of (r.resultat as Resultat | null)?.filer ?? []) for (const t of f.transaktioner) poster.push({ t, fil: f.namn });
  }
  const perTx = new Map(poster.filter((p) => p.t.transaktionId).map((p) => [p.t.transaktionId!, p]));
  const raknade = new Set<(typeof poster)[number]>();
  for (const p of poster) {
    if (arKlar(p.t)) continue;
    raknade.add(p);
    // En möjlig dubblett står i Granska tillsammans med transaktionen den pekar på
    if (p.t.dublett.status === 'unik') continue;
    const refFil = p.t.dublett.refText?.startsWith('filen ') ? p.t.dublett.refText.slice(6) : null;
    const mal = (p.t.dublett.transaktionId ? perTx.get(p.t.dublett.transaktionId) : undefined)
      ?? (refFil ? poster.find((x) => x !== p && x.fil === refFil && x.t.riktning === p.t.riktning && Math.abs(x.t.belopp - p.t.belopp) < 1) : undefined);
    if (mal) raknade.add(mal);
  }
  return raknade.size;
}
