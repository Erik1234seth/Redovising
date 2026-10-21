'use client';

import { Fragment, useMemo, useState } from 'react';
import type { SieIb } from '@/lib/sie/ingaende-balans';
import { RUTNAMN, periodDatum, type Ruta } from '@/lib/moms/eskd';
import { giltiga, ingaendeBalans, perioder, type Period } from './_huvudbok';
import { momsForPeriod } from './_momsfil';
import { Varningar } from './_varningar';
import { kr, type Ver } from './_verifikationer';

/**
 * Resultaträkning, balansräkning och momsrapport för en period, räknade ur
 * huvudboken varje gång fliken öppnas. Det finns inget att uppdatera: en ny
 * verifikation syns i rapporterna direkt.
 *
 * Perioden är ett räkenskapsår, eller ett kvartal eller en månad i det.
 * Resultaträkningen visar perioden och året hittills. Balansräkningen visar
 * ingående balans vid årets början — samma som huvudboken — och utgående
 * balans vid periodens slut. Momsrapporten räknas som momsfilen.
 *
 * Grupperna följer BAS-kontoplanens klasser. 899x är bokslutets
 * resultatkonto och står inte i resultaträkningen; resultatet räknas fram.
 */

interface Grupp { namn: string; fran: number; tom: number }
interface SektionDef { rubrik: string; grupper: Grupp[]; /** Delsumman efter sektionen, räknad över alla sektioner hittills. */ summa?: string }

const RR: SektionDef[] = [
  { rubrik: 'Rörelsens intäkter', grupper: [
    { namn: 'Nettoomsättning', fran: 3000, tom: 3799 },
    { namn: 'Övriga rörelseintäkter', fran: 3800, tom: 3999 },
  ] },
  { rubrik: 'Rörelsens kostnader', summa: 'Rörelseresultat', grupper: [
    { namn: 'Varor, material och tjänster', fran: 4000, tom: 4999 },
    { namn: 'Övriga externa kostnader', fran: 5000, tom: 6999 },
    { namn: 'Personalkostnader', fran: 7000, tom: 7699 },
    { namn: 'Av- och nedskrivningar', fran: 7700, tom: 7899 },
    { namn: 'Övriga rörelsekostnader', fran: 7900, tom: 7999 },
  ] },
  { rubrik: 'Finansiella poster', summa: 'Resultat efter finansiella poster', grupper: [
    { namn: 'Finansiella intäkter och kostnader', fran: 8000, tom: 8799 },
  ] },
  { rubrik: 'Bokslutsdispositioner och skatt', summa: 'Årets resultat', grupper: [
    { namn: 'Bokslutsdispositioner', fran: 8800, tom: 8899 },
    { namn: 'Skatter', fran: 8900, tom: 8989 },
  ] },
];

const TILLGANGAR: SektionDef[] = [
  { rubrik: 'Anläggningstillgångar', grupper: [
    { namn: 'Immateriella anläggningstillgångar', fran: 1000, tom: 1099 },
    { namn: 'Byggnader och mark', fran: 1100, tom: 1199 },
    { namn: 'Maskiner och inventarier', fran: 1200, tom: 1299 },
    { namn: 'Finansiella anläggningstillgångar', fran: 1300, tom: 1399 },
  ] },
  { rubrik: 'Omsättningstillgångar', summa: 'Summa tillgångar', grupper: [
    { namn: 'Varulager', fran: 1400, tom: 1499 },
    { namn: 'Kundfordringar', fran: 1500, tom: 1599 },
    { namn: 'Övriga fordringar', fran: 1600, tom: 1699 },
    { namn: 'Förutbetalda kostnader och upplupna intäkter', fran: 1700, tom: 1799 },
    { namn: 'Kortfristiga placeringar', fran: 1800, tom: 1899 },
    { namn: 'Kassa och bank', fran: 1900, tom: 1999 },
  ] },
];

const SKULDER: SektionDef[] = [
  { rubrik: 'Eget kapital', grupper: [{ namn: 'Eget kapital', fran: 2000, tom: 2099 }] },
  { rubrik: 'Obeskattade reserver och avsättningar', grupper: [
    { namn: 'Obeskattade reserver', fran: 2100, tom: 2199 },
    { namn: 'Avsättningar', fran: 2200, tom: 2299 },
  ] },
  { rubrik: 'Långfristiga skulder', grupper: [{ namn: 'Långfristiga skulder', fran: 2300, tom: 2399 }] },
  { rubrik: 'Kortfristiga skulder', summa: 'Summa eget kapital och skulder', grupper: [
    { namn: 'Leverantörsskulder och skulder till kreditinstitut', fran: 2400, tom: 2499 },
    { namn: 'Skatteskulder', fran: 2500, tom: 2599 },
    { namn: 'Moms', fran: 2600, tom: 2699 },
    { namn: 'Personalens skatter och avgifter', fran: 2700, tom: 2799 },
    { namn: 'Övriga kortfristiga skulder', fran: 2800, tom: 2899 },
    { namn: 'Upplupna kostnader och förutbetalda intäkter', fran: 2900, tom: 2999 },
  ] },
];

interface Rad { konto: string; namn: string; v: number[] }
interface GruppRad { namn: string; konton: Rad[]; v: number[] }
interface Sektion { rubrik: string; grupper: GruppRad[]; v: number[]; summa?: { namn: string; v: number[] } }

const ore = (n: number) => Math.round(n * 100) / 100;
const plus = (a: number[], b: number[]) => a.map((x, i) => ore(x + (b[i] ?? 0)));
const noll = (n: number) => Array<number>(n).fill(0);

/** Sektionerna med de konton som har något, och delsummorna efter dem. */
function bygg(defs: SektionDef[], konton: string[], varde: (konto: string) => number[], namn: Map<string, string>, bredd: number): Sektion[] {
  let hittills = noll(bredd);
  return defs.map((d) => {
    const grupper = d.grupper.map((g) => {
      const rader = konton
        .filter((k) => Number(k) >= g.fran && Number(k) <= g.tom)
        .map((k) => ({ konto: k, namn: namn.get(k) ?? '', v: varde(k) }))
        .filter((r) => r.v.some((x) => Math.abs(x) >= 0.005));
      return { namn: g.namn, konton: rader, v: rader.reduce((s, r) => plus(s, r.v), noll(bredd)) };
    }).filter((g) => g.konton.length);
    const v = grupper.reduce((s, g) => plus(s, g.v), noll(bredd));
    hittills = plus(hittills, v);
    return { rubrik: d.rubrik, grupper, v, summa: d.summa ? { namn: d.summa, v: hittills } : undefined };
  });
}

/** Hela året, och kvartal och månader i det — ett förlängt år har fler. */
function delar(p: Period): Period[] {
  const ut: Period[] = [{ id: 'ar', namn: 'Hela räkenskapsåret', fran: p.fran, tom: p.tom }];
  const kvartal: Period[] = [];
  const manader: Period[] = [];
  const MANAD = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  for (let ar = Number(p.fran.slice(0, 4)); ar <= Number(p.tom.slice(0, 4)); ar++) {
    for (let q = 1; q <= 4; q++) kvartal.push({ id: `${ar}-K${q}`, namn: `Kvartal ${q} ${ar}`, ...periodDatum(ar, 'kvartal', q) });
    for (let m = 1; m <= 12; m++) manader.push({ id: `${ar}-${m}`, namn: `${MANAD[m - 1]} ${ar}`, ...periodDatum(ar, 'månad', m) });
  }
  const inom = (d: Period) => d.fran >= p.fran && d.tom <= p.tom;
  return [...ut, ...kvartal.filter(inom), ...manader.filter(inom)];
}

/** Rapporterna för en del av ett räkenskapsår. */
export function raknaRapporter(verifikationer: Ver[], sieIb: Record<string, SieIb>, ar: Period, del: Period) {
  const helaAret = del.id === 'ar';
  const { saldon: ib, kalla } = ingaendeBalans(verifikationer, sieIb, ar);
  const namn = new Map<string, string>();
  for (const v of verifikationer) for (const t of v.transaktioner) if (t.kontonamn && !namn.has(t.konto)) namn.set(t.konto, t.kontonamn);

  // Rörelserna i perioden, och från årets början till periodens slut
  const perioden = new Map<string, number>();
  const hittills = new Map<string, number>();
  const lagg = (m: Map<string, number>, k: string, b: number) => m.set(k, (m.get(k) ?? 0) + b);
  const varningar: string[] = [];
  let obalanserade = 0;
  const utanforBas = new Set<string>();
  for (const v of verifikationer) {
    if (!v.datum || v.datum < ar.fran || v.datum > del.tom) continue;
    if (!v.balanserad) obalanserade++;
    for (const t of giltiga(v)) {
      if (!/^[1-8]\d{3}$/.test(t.konto)) utanforBas.add(t.konto);
      lagg(hittills, t.konto, t.belopp);
      if (v.datum >= del.fran) lagg(perioden, t.konto, t.belopp);
    }
  }
  if (obalanserade) varningar.push(`${obalanserade} ${obalanserade === 1 ? 'verifikation går' : 'verifikationer går'} inte jämnt ut — då går inte heller balansräkningen ihop`);
  if (utanforBas.size) varningar.push(`Konton utanför BAS 1000–8999 kommer inte med: ${[...utanforBas].sort().join(', ')}`);
  const odaterade = verifikationer.filter((v) => !v.datum).length;
  if (odaterade) varningar.push(`${odaterade} ${odaterade === 1 ? 'verifikation saknar' : 'verifikationer saknar'} datum och kommer inte med`);

  const alla = [...new Set([...ib.keys(), ...hittills.keys()])].sort();
  const g = (m: Map<string, number>, k: string) => ore(m.get(k) ?? 0);

  // Resultaträkningen med intäkter positiva och kostnader negativa
  const rr = bygg(RR, alla, (k) => helaAret ? [-g(hittills, k)] : [-g(perioden, k), -g(hittills, k)], namn, helaAret ? 1 : 2);

  // Allt på 3000–8999, även 899x: före bokslutet är det årets resultat,
  // efter bokslutet är det noll och resultatet står på eget kapital
  const resultat = ore(-alla.filter((k) => /^[3-8]\d{3}$/.test(k)).reduce((s, k) => s + g(hittills, k), 0));
  const tillgangar = bygg(TILLGANGAR, alla, (k) => {
    const i = g(ib, k); const f = g(hittills, k);
    return [i, f, ore(i + f)];
  }, namn, 3);
  const skulder = bygg(SKULDER, alla, (k) => {
    const i = -g(ib, k); const f = -g(hittills, k);
    return [i, f, ore(i + f)];
  }, namn, 3);
  // Årets resultat hör till eget kapital tills bokslutet fört över det
  if (resultat) {
    const ek = skulder[0];
    const rad = { konto: '', namn: 'Årets resultat (beräknat)', v: [0, resultat, resultat] };
    if (ek.grupper.length) ek.grupper[0].konton.push(rad);
    else ek.grupper.push({ namn: 'Eget kapital', konton: [rad], v: noll(3) });
    ek.grupper[0].v = plus(ek.grupper[0].v, rad.v);
    ek.v = plus(ek.v, rad.v);
    for (const s of skulder) if (s.summa) s.summa.v = plus(s.summa.v, rad.v);
  }
  const summaT = tillgangar.find((s) => s.summa)?.summa?.v[2] ?? 0;
  const summaS = skulder.find((s) => s.summa)?.summa?.v[2] ?? 0;
  const differens = ore(summaT - summaS);
// En ingående balans som inte går jämnt ut följer med till utgående balans
const ibDifferens = ore([...ib.values()].reduce((s, b) => s + b, 0));
if (ibDifferens) varningar.push(`Den ingående balansen går inte jämnt ut, den skiljer ${kr.format(ibDifferens)} kr. Oftast har förra årets resultat inte förts över till eget kapital.`);

  const moms = momsForPeriod(verifikationer, del.fran, del.tom);
  return { kalla, rr, tillgangar, skulder, differens, ibDifferens, moms, varningar, helaAret };
}

export function Rapporter({ verifikationer, sieIb, startAr, forlangt, kundnamn }: {
  verifikationer: Ver[];
  sieIb: Record<string, SieIb>;
  startAr: number | null;
  forlangt: boolean;
  kundnamn: string;
}) {
  const lista = useMemo(() => perioder(verifikationer, startAr, forlangt), [verifikationer, startAr, forlangt]);
  const [arId, setArId] = useState('');
  const ar = lista.find((x) => x.id === arId) ?? lista[0];
  const val = useMemo(() => (ar ? delar(ar) : []), [ar]);
  const [delId, setDelId] = useState('ar');
  const del = val.find((d) => d.id === delId) ?? val[0];
  const [visaKonton, setVisaKonton] = useState(false);

  const rapport = useMemo(() => (ar && del ? raknaRapporter(verifikationer, sieIb, ar, del) : null), [verifikationer, sieIb, ar, del]);

  if (!ar || !rapport || !del) return <p className="text-slate-500 text-sm">Inga verifikationer att räkna rapporter av än.</p>;

  const rrKolumner = rapport.helaAret ? [ar.namn] : ['Perioden', 'Året hittills'];
  const brKolumner = [`Ingående ${ar.fran}`, 'Förändring', `Utgående ${del.tom}`];
  const momsRutor = (Object.keys(rapport.moms.rutor) as Ruta[]).filter((r) => r !== '49').sort();

  const exportera = async () => {
    const XLSX = await import('xlsx');
    const ark = (rubrik: string, kolumner: string[], sektioner: Sektion[][]) => {
      const rader: (string | number)[][] = [[rubrik, kundnamn], [`${del.fran} – ${del.tom}`], [], ['Konto', 'Benämning', ...kolumner]];
      for (const grupp of sektioner) for (const s of grupp) {
        rader.push([s.rubrik]);
        for (const g of s.grupper) {
          for (const k of g.konton) rader.push([k.konto, k.namn, ...k.v]);
          rader.push(['', `Summa ${g.namn.toLowerCase()}`, ...g.v]);
        }
        if (s.summa) rader.push(['', s.summa.namn, ...s.summa.v]);
        rader.push([]);
      }
      return XLSX.utils.aoa_to_sheet(rader);
    };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ark('Resultaträkning', rrKolumner, [rapport.rr]), 'Resultaträkning');
    XLSX.utils.book_append_sheet(wb, ark('Balansräkning', brKolumner, [rapport.tillgangar, rapport.skulder]), 'Balansräkning');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Momsrapport', kundnamn], [`${del.fran} – ${del.tom}`], [], ['Ruta', 'Benämning', 'Belopp'],
      ...momsRutor.map((r) => [r, RUTNAMN[r], rapport.moms.rutor[r] ?? 0]),
      ['49', RUTNAMN['49'], rapport.moms.rutor['49'] ?? 0],
    ]), 'Moms');
    XLSX.writeFile(wb, `Rapporter ${del.id === 'ar' ? ar.namn.replace(/\s.*$/, '') : del.namn} ${kundnamn}.xlsx`);
  };

  const select = 'bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500';
  const belopp = (n: number) => (Math.abs(n) >= 0.005 ? kr.format(n) : '');

  const tabell = (kolumner: string[], sektioner: Sektion[]) => (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-slate-500 text-[11px] uppercase tracking-widest border-b border-slate-200">
          <th className="text-left font-medium pb-1.5 pr-3">Post</th>
          {kolumner.map((k) => <th key={k} className="text-right font-medium pb-1.5 pl-3 w-36">{k}</th>)}
        </tr>
      </thead>
      <tbody>
        {sektioner.map((s) => (
          <Fragment key={s.rubrik}>
            {s.grupper.length > 0 && (
              <tr><td colSpan={kolumner.length + 1} className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.rubrik}</td></tr>
            )}
            {s.grupper.map((g) => (
              <Fragment key={g.namn}>
                {visaKonton && g.konton.map((k) => (
                  <tr key={`${k.konto}${k.namn}`} className="text-slate-600 text-xs">
                    <td className="py-0.5 pr-3 pl-4"><span className="tabular-nums text-slate-400 mr-2">{k.konto}</span>{k.namn || '—'}</td>
                    {k.v.map((x, i) => <td key={i} className="py-0.5 pl-3 text-right tabular-nums">{belopp(x)}</td>)}
                  </tr>
                ))}
                <tr className={visaKonton ? 'border-b border-slate-100 text-slate-900' : 'border-t border-slate-100 text-slate-900'}>
                  <td className="py-1.5 pr-3">{visaKonton ? `Summa ${g.namn.toLowerCase()}` : g.namn}</td>
                  {g.v.map((x, i) => <td key={i} className="py-1.5 pl-3 text-right tabular-nums">{belopp(x)}</td>)}
                </tr>
              </Fragment>
            ))}
            {s.summa && (
              <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
                <td className="py-2 pr-3">{s.summa.namn}</td>
                {s.summa.v.map((x, i) => <td key={i} className="py-2 pl-3 text-right tabular-nums">{kr.format(x)}</td>)}
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-8">
      <div className="flex gap-2 flex-wrap items-center">
        <select value={ar.id} onChange={(e) => { setArId(e.target.value); setDelId('ar'); }} className={select}>
          {lista.map((x) => <option key={x.id} value={x.id}>Räkenskapsår {x.namn}</option>)}
        </select>
        <select value={del.id} onChange={(e) => setDelId(e.target.value)} className={select}>
          {val.map((d) => <option key={d.id} value={d.id}>{d.namn}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-700 mr-auto">
          <input type="checkbox" checked={visaKonton} onChange={(e) => setVisaKonton(e.target.checked)} />
          Visa konton
        </label>
        <button onClick={exportera} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold">
          Ladda ner Excel
        </button>
      </div>
      <div className="-mt-5">
        <p className="text-slate-400 text-xs">{del.fran} – {del.tom} · {rapport.kalla}</p>
        <Varningar varningar={rapport.varningar} className="mt-1" />
      </div>

      <section>
        <h3 className="text-slate-900 text-base font-semibold mb-1">Resultaträkning</h3>
        <div className="overflow-x-auto">{tabell(rrKolumner, rapport.rr)}</div>
      </section>

      <section>
        <h3 className="text-slate-900 text-base font-semibold mb-1">Balansräkning</h3>
        {rapport.differens !== 0 && (
          <p className="text-red-600 text-xs mb-2">
            Balansräkningen går inte ihop: tillgångarna och eget kapital och skulder skiljer {kr.format(rapport.differens)} kr
            {rapport.differens === rapport.ibDifferens
              ? '. Hela skillnaden kommer från den ingående balansen — årets bokföring går jämnt ut.'
              : rapport.ibDifferens ? `, varav ${kr.format(rapport.ibDifferens)} kr från den ingående balansen.` : '.'}
          </p>
        )}
        <div className="overflow-x-auto">{tabell(brKolumner, [...rapport.tillgangar, ...rapport.skulder])}</div>
      </section>

      <section>
        <h3 className="text-slate-900 text-base font-semibold mb-1">Momsrapport</h3>
        <p className="text-slate-500 text-xs mb-2">
          {del.fran} – {del.tom} · {rapport.moms.antal} {rapport.moms.antal === 1 ? 'verifikation' : 'verifikationer'}.
          Momsfilen till Skatteverket laddas ner under Verifikationer.
        </p>
        <Varningar varningar={rapport.moms.varningar} className="mb-2" />
        {momsRutor.length === 0 ? (
          <p className="text-slate-500 text-sm">Ingen moms att redovisa i perioden.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {momsRutor.map((r) => (
                <tr key={r} className="border-t border-slate-100">
                  <td className="py-1 pr-3 text-slate-500 w-12 tabular-nums">{r}</td>
                  <td className="py-1 pr-3 text-slate-700">{RUTNAMN[r]}</td>
                  <td className="py-1 pl-3 text-right tabular-nums w-36">{kr.format(rapport.moms.rutor[r] ?? 0)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
                <td className="py-2 pr-3 tabular-nums">49</td>
                <td className="py-2 pr-3">{(rapport.moms.rutor['49'] ?? 0) < 0 ? 'Moms att få tillbaka' : 'Moms att betala'}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{kr.format(Math.abs(rapport.moms.rutor['49'] ?? 0))}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
