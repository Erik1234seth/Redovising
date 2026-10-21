'use client';

import { Fragment, useMemo, useState } from 'react';
import type { SieIb } from '@/lib/sie/ingaende-balans';
import { kr, type Ver } from './_verifikationer';

/**
 * Huvudboken: kundens verifikationer ordnade per konto, för ett räkenskapsår.
 *
 * Verifikationerna läggs på det räkenskapsår deras datum hör till — ett
 * underlag från förra året hamnar i förra årets huvudbok, utan att någon
 * behöver flytta det. Enskilda firmor har kalenderår, utom ett förlängt
 * första räkenskapsår, som här blir startåret och året efter tillsammans.
 *
 * Ingående balans per balanskonto (1000–2999):
 * - Från kundens SIE-fil när den har #IB för året.
 * - Annars uträknad: närmaste tidigare IB ur en SIE-fil (eller noll) plus
 *   allt som bokförts sedan dess. Vid årsskiftet förs resultatet och de
 *   privata kontona 2011–2019 till eget kapital 2010, som i ett bokslut.
 * Resultatkonton (3000–8999) börjar på noll varje år.
 */

export interface Period { id: string; namn: string; fran: string; tom: string }

interface Rad { datum: string; ver: string; text: string; belopp: number }

interface Konto {
  konto: string;
  namn: string;
  ib: number;
  rader: Rad[];
}

// Som i verifikationslistan: borttagna rader gäller inte, och en rad
// "tillagd i efterhand" (#RTRANS) följs av samma rad som vanlig rad
export const giltiga = (v: Ver) => v.transaktioner.filter((t) => !t.borttagen && !t.tillagd);
const arBalanskonto = (k: string) => /^[12]\d{3}$/.test(k);
const arResultatkonto = (k: string) => /^[3-8]\d{3}$/.test(k);
const ore = (n: number) => Math.round(n * 100) / 100;

/** Räkenskapsåren som har verifikationer, nyast först. */
export function perioder(verifikationer: Ver[], startAr: number | null, forlangt: boolean): Period[] {
  const ar = [...new Set(verifikationer.map((v) => Number(v.datum.slice(0, 4))).filter((y) => y > 1900))].sort();
  const ut: Period[] = [];
  for (const y of ar) {
    if (forlangt && startAr && (y === startAr || y === startAr + 1)) {
      if (!ut.some((p) => p.id === `${startAr}`)) {
        ut.push({ id: `${startAr}`, namn: `${startAr}–${startAr + 1} (förlängt)`, fran: `${startAr}-01-01`, tom: `${startAr + 1}-12-31` });
      }
      continue;
    }
    ut.push({ id: `${y}`, namn: `${y}`, fran: `${y}-01-01`, tom: `${y}-12-31` });
  }
  return ut.reverse();
}

/** Ingående balanser för perioden, och var de kommer ifrån. */
export function ingaendeBalans(verifikationer: Ver[], sieIb: Record<string, SieIb>, p: Period): { saldon: Map<string, number>; kalla: string } {
  const ibs = Object.values(sieIb).filter((ib) => /^\d{4}-\d{2}-\d{2}$/.test(ib.start)).sort((a, b) => a.start.localeCompare(b.start));
  // En IB som börjar i perioden är periodens egen
  const egen = ibs.find((ib) => ib.start >= p.fran && ib.start <= p.tom);
  const balans = (saldon: Record<string, number>) =>
    new Map(Object.entries(saldon).filter(([k]) => arBalanskonto(k)).map(([k, b]) => [k, ore(b)] as [string, number]));
  if (egen) return { saldon: balans(egen.saldon), kalla: `Ingående balans från ${egen.fil}` };

  const bas = [...ibs].reverse().find((ib) => ib.start < p.fran);
  const saldon = bas ? balans(bas.saldon) : new Map<string, number>();
  const fran = bas?.start ?? '';
  let resultat = 0;
  let bokfort = false;
  for (const v of verifikationer) {
    if (v.datum < fran || v.datum >= p.fran) continue;
    for (const t of giltiga(v)) {
      bokfort = true;
      // Privata konton och resultatet stängs mot eget kapital vid årsskiftet
      if (arResultatkonto(t.konto) || /^201[1-9]$/.test(t.konto)) resultat += t.belopp;
      else if (arBalanskonto(t.konto)) saldon.set(t.konto, ore((saldon.get(t.konto) ?? 0) + t.belopp));
    }
  }
  if (resultat) saldon.set('2010', ore((saldon.get('2010') ?? 0) + resultat));
  for (const [k, b] of saldon) if (Math.abs(b) < 0.005) saldon.delete(k);
  const kalla = bas
    ? `Ingående balans uträknad från ${bas.fil} (${bas.start}) och bokföringen sedan dess`
    : bokfort ? 'Ingående balans uträknad ur tidigare års bokföring' : 'Ingen ingående balans — inga tidigare år finns';
  return { saldon, kalla };
}

export function Huvudbok({ verifikationer, sieIb, startAr, forlangt, kundnamn }: {
  verifikationer: Ver[];
  sieIb: Record<string, SieIb>;
  startAr: number | null;
  forlangt: boolean;
  kundnamn: string;
}) {
  const lista = useMemo(() => perioder(verifikationer, startAr, forlangt), [verifikationer, startAr, forlangt]);
  const [periodId, setPeriodId] = useState('');
  const p = lista.find((x) => x.id === periodId) ?? lista[0];
  const [sok, setSok] = useState('');
  const [oppna, setOppna] = useState<Set<string>>(new Set());

  const bok = useMemo(() => {
    if (!p) return null;
    const { saldon, kalla } = ingaendeBalans(verifikationer, sieIb, p);
    // Ett konto med bara ingående balans får namnet från ett annat år
    const namn = new Map<string, string>();
    for (const v of verifikationer) for (const t of v.transaktioner) if (t.kontonamn && !namn.has(t.konto)) namn.set(t.konto, t.kontonamn);
    const konton = new Map<string, Konto>();
    const hamta = (konto: string, namn: string) => {
      let k = konton.get(konto);
      if (!k) { k = { konto, namn, ib: saldon.get(konto) ?? 0, rader: [] }; konton.set(konto, k); }
      if (!k.namn && namn) k.namn = namn;
      return k;
    };
    for (const [konto, ib] of saldon) hamta(konto, namn.get(konto) ?? '').ib = ib;
    const iPerioden = verifikationer
      .filter((v) => v.datum >= p.fran && v.datum <= p.tom)
      .sort((a, b) => a.datum.localeCompare(b.datum) || `${a.serie}${a.nummer}`.localeCompare(`${b.serie}${b.nummer}`, 'sv', { numeric: true }));
    for (const v of iPerioden) {
      for (const t of giltiga(v)) {
        hamta(t.konto, t.kontonamn).rader.push({ datum: v.datum, ver: `${v.serie}${v.nummer}`, text: t.text || v.text, belopp: t.belopp });
      }
    }
    const sorterade = [...konton.values()].sort((a, b) => a.konto.localeCompare(b.konto));
    let debet = 0;
    let kredit = 0;
    let resultat = 0;
    for (const k of sorterade) for (const r of k.rader) {
      if (r.belopp > 0) debet += r.belopp; else kredit -= r.belopp;
      if (arResultatkonto(k.konto)) resultat -= r.belopp;
    }
    return { konton: sorterade, kalla, antal: iPerioden.length, debet: ore(debet), kredit: ore(kredit), resultat: ore(resultat) };
  }, [verifikationer, sieIb, p]);

  if (!p || !bok) return <p className="text-slate-500 text-sm">Inga verifikationer att bygga en huvudbok av än.</p>;

  const q = sok.trim().toLowerCase();
  const visade = q ? bok.konton.filter((k) => k.konto.startsWith(q) || k.namn.toLowerCase().includes(q)) : bok.konton;
  const allaOppna = visade.length > 0 && visade.every((k) => oppna.has(k.konto));

  const exportera = async () => {
    const XLSX = await import('xlsx');
    const rader: (string | number)[][] = [
      [`Huvudbok ${p.namn}`, kundnamn], [`${p.fran} – ${p.tom}`], [bok.kalla], [],
      ['Konto', 'Benämning', 'Datum', 'Ver', 'Text', 'Debet', 'Kredit', 'Saldo'],
    ];
    for (const k of bok.konton) {
      let saldo = k.ib;
      rader.push([k.konto, k.namn, p.fran, '', 'Ingående balans', '', '', k.ib]);
      for (const r of k.rader) {
        saldo = ore(saldo + r.belopp);
        rader.push([k.konto, k.namn, r.datum, r.ver, r.text, r.belopp > 0 ? r.belopp : '', r.belopp < 0 ? -r.belopp : '', saldo]);
      }
      rader.push([k.konto, k.namn, p.tom, '', 'Utgående balans', '', '', saldo], []);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rader), 'Huvudbok');
    XLSX.writeFile(wb, `Huvudbok ${p.namn.replace(/\s.*$/, '')} ${kundnamn}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={p.id}
          onChange={(e) => setPeriodId(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
        >
          {lista.map((x) => <option key={x.id} value={x.id}>Räkenskapsår {x.namn}</option>)}
        </select>
        <input
          value={sok}
          onChange={(e) => setSok(e.target.value)}
          placeholder="Sök konto eller benämning"
          className="flex-1 min-w-[12rem] bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => setOppna(allaOppna ? new Set() : new Set(visade.map((k) => k.konto)))}
          className="px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm text-slate-700"
        >
          {allaOppna ? 'Fäll ihop alla' : 'Visa alla rader'}
        </button>
        <button onClick={exportera} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold">
          Ladda ner Excel
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Verifikationer', value: bok.antal.toLocaleString('sv-SE') },
          { label: 'Summa debet', value: kr.format(bok.debet) },
          { label: 'Summa kredit', value: kr.format(bok.kredit) },
          { label: 'Årets resultat', value: kr.format(bok.resultat) },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border p-4 bg-slate-50 border-slate-200">
            <p className="text-slate-500 text-[11px] uppercase tracking-widest">{t.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{t.value}</p>
          </div>
        ))}
      </div>
      <p className="text-slate-400 text-xs -mt-3">{p.fran} – {p.tom} · {bok.kalla}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-[11px] uppercase tracking-widest border-b border-slate-200">
              <th className="text-left font-medium pb-1.5 pr-3 w-24">Konto</th>
              <th className="text-left font-medium pb-1.5 pr-3">Benämning / text</th>
              <th className="text-right font-medium pb-1.5 pl-3 w-28">Ingående</th>
              <th className="text-right font-medium pb-1.5 pl-3 w-28">Debet</th>
              <th className="text-right font-medium pb-1.5 pl-3 w-28">Kredit</th>
              <th className="text-right font-medium pb-1.5 pl-3 w-28">Utgående</th>
            </tr>
          </thead>
          <tbody>
            {visade.map((k) => {
              const debet = ore(k.rader.filter((r) => r.belopp > 0).reduce((s, r) => s + r.belopp, 0));
              const kredit = ore(k.rader.filter((r) => r.belopp < 0).reduce((s, r) => s - r.belopp, 0));
              const ub = ore(k.ib + debet - kredit);
              const oppen = oppna.has(k.konto);
              let saldo = k.ib;
              return (
                <Fragment key={k.konto}>
                  <tr
                    onClick={() => setOppna((o) => { const n = new Set(o); if (n.has(k.konto)) n.delete(k.konto); else n.add(k.konto); return n; })}
                    className="border-t border-slate-200 cursor-pointer hover:bg-slate-50 font-medium text-slate-900"
                  >
                    <td className="py-1.5 pr-3 tabular-nums">
                      <span className="text-slate-400 text-xs mr-1">{k.rader.length ? (oppen ? '▾' : '▸') : ' '}</span>{k.konto}
                    </td>
                    <td className="py-1.5 pr-3">
                      {k.namn || '—'}
                      <span className="text-slate-400 text-xs font-normal"> · {k.rader.length} {k.rader.length === 1 ? 'rad' : 'rader'}</span>
                    </td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{k.ib ? kr.format(k.ib) : ''}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{debet ? kr.format(debet) : ''}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{kredit ? kr.format(kredit) : ''}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums">{kr.format(ub)}</td>
                  </tr>
                  {oppen && k.rader.map((r, i) => {
                    saldo = ore(saldo + r.belopp);
                    return (
                      <tr key={i} className="text-slate-600 text-xs">
                        <td className="py-1 pr-3 pl-5 tabular-nums">{r.datum}</td>
                        <td className="py-1 pr-3"><span className="text-blue-700 tabular-nums mr-2">{r.ver}</span>{r.text}</td>
                        <td />
                        <td className="py-1 pl-3 text-right tabular-nums">{r.belopp > 0 ? kr.format(r.belopp) : ''}</td>
                        <td className="py-1 pl-3 text-right tabular-nums">{r.belopp < 0 ? kr.format(-r.belopp) : ''}</td>
                        <td className="py-1 pl-3 text-right tabular-nums text-slate-400">{kr.format(saldo)}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {visade.length === 0 && <p className="text-slate-500 text-sm py-6 text-center">Inga konton matchar.</p>}
      </div>
    </div>
  );
}
