'use client';

import { Fragment, useMemo, useState } from 'react';
import type { AdminVerifikation, BokslutData, Person } from '@/lib/admin-types';
import {
  B_FALT, R_FALT, byggSru, neFalt, personnummer12, raknaNe,
  type BKod, type NeManuellt,
} from '@/lib/ne/ne';
import { exportArsbokslutPDF } from '@/lib/pdf';
import { Varningar } from './_varningar';

/**
 * NE-bilagan och det förenklade årsbokslutet (K1) för ett inkomstår.
 *
 * Räkenskapsschemat räknas ur verifikationerna. Det bokföringen inte vet —
 * ingående balanser och de skattemässiga raderna — fylls i här och sparas på
 * profilen per år. Ut kommer två filer: NE som SRU (INFO.SRU + BLANKETTER.SRU
 * i en zip) för Skatteverkets filöverföring, och årsbokslutet som PDF till
 * kunden.
 */

const kr = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const st = (n: number, en: string, flera: string) => `${n} ${n === 1 ? en : flera}`;
const namn = (v: AdminVerifikation) => `${v.serie}${v.nummer}`.trim() || v.datum || v.text || '?';

/** "12 000", "12000,50" och "-500" ska alla gå att skriva. Tomt = inget värde. */
function tal(text: string): number | undefined {
  const t = text.replace(/[\s ]/g, '').replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

type Skattefalt = 'r13' | 'r14' | 'r15' | 'r16' | 'r24' | 'r32' | 'r34' | 'r40' | 'r41' | 'r43';

const SKATTERADER: { falt: Skattefalt; rad: string; namn: string; tecken: '+' | '−' }[] = [
  { falt: 'r13', rad: 'R13', namn: 'Bokförda kostnader som inte ska dras av', tecken: '+' },
  { falt: 'r14', rad: 'R14', namn: 'Bokförda intäkter som inte ska tas upp', tecken: '−' },
  { falt: 'r15', rad: 'R15', namn: 'Intäkter som inte bokförts men ska tas upp', tecken: '+' },
  { falt: 'r16', rad: 'R16', namn: 'Kostnader som inte bokförts men ska dras av', tecken: '−' },
  { falt: 'r24', rad: 'R24', namn: 'Outnyttjat underskott från förra året (fjolårets R48)', tecken: '−' },
  { falt: 'r32', rad: 'R32', namn: 'Återföring av periodiseringsfond', tecken: '+' },
  { falt: 'r34', rad: 'R34', namn: 'Avsättning till periodiseringsfond (högst 30 % av R33)', tecken: '−' },
  { falt: 'r40', rad: 'R40', namn: 'Fjolårets avdrag för egenavgifter (fjolårets R43)', tecken: '+' },
  { falt: 'r41', rad: 'R41', namn: 'Påförda egenavgifter enligt slutskattebeskedet', tecken: '−' },
  { falt: 'r43', rad: 'R43', namn: 'Årets avdrag för egenavgifter', tecken: '−' },
];

export function NeBilaga({ verifikationer, person, data, onData, onError }: {
  verifikationer: AdminVerifikation[] | null;
  person: Person;
  data: BokslutData | null;
  onData: (data: BokslutData) => void;
  onError: (message: string) => void;
}) {
  const iar = new Date().getFullYear();
  const ar0 = useMemo(() => {
    // Förra året om det finns bokföring där — det är det som deklareras i maj
    const harFjol = verifikationer?.some((v) => v.datum.startsWith(String(iar - 1)));
    return harFjol ? iar - 1 : iar;
  }, [verifikationer, iar]);
  const [valtAr, setValtAr] = useState<number | null>(null);
  const ar = valtAr ?? ar0;
  const [sparar, setSparar] = useState(false);

  const manuellt: NeManuellt = data?.neUppgifter?.[String(ar)] ?? {};
  const pnr = personnummer12(data?.orgNr);
  const verksamhet = manuellt.verksamhet ?? (person.verksamhet ?? '').slice(0, 80);

  const { ne, varningar } = useMemo(() => {
    const varningar: string[] = [];
    const lista = verifikationer ?? [];
    const iAret = lista.filter((v) => v.datum.startsWith(String(ar)));
    const odaterade = lista.filter((v) => !v.datum);
    if (odaterade.length) {
      varningar.push(`${st(odaterade.length, 'verifikation', 'verifikationer')} saknar datum och kommer inte med: ${odaterade.slice(0, 5).map(namn).join(', ')}${odaterade.length > 5 ? ' …' : ''}`);
    }
    const obalanserade = iAret.filter((v) => !v.balanserad);
    if (obalanserade.length) {
      varningar.push(`${st(obalanserade.length, 'verifikation', 'verifikationer')} går inte jämnt ut men är medräknade: ${obalanserade.slice(0, 5).map(namn).join(', ')}${obalanserade.length > 5 ? ' …' : ''}`);
    }
    const alla = iAret.flatMap((v) => v.transaktioner);
    const struket = alla.filter((t) => t.borttagen || t.tillagd).length;
    if (struket) varningar.push(`${st(struket, 'rad', 'rader')} markerade som borttagna eller tillagda i efterhand räknas inte med`);
    const ne = raknaNe(alla.filter((t) => !t.borttagen && !t.tillagd), manuellt);
    return { ne, varningar: [...varningar, ...ne.varningar] };
  }, [verifikationer, ar, manuellt]);

  const allaVarningar = [
    ...(!data?.orgNr ? ['Personnummer saknas på profilen (org_nr) — det behövs i NE-filen']
      : !pnr ? [`Personnumret ${data.orgNr} är inte ett giltigt personnummer`] : []),
    ...(!manuellt.ib ? ['Ingen ingående balans ifylld — balansräkningen blir bara årets rörelser. Är det första året är det rätt.'] : []),
    ...varningar,
  ];

  const spara = async (nytt: NeManuellt) => {
    if (!data || !person.profileId) {
      onError('Personen har inget konto att spara NE-uppgifterna på');
      return;
    }
    const neUppgifter = { ...data.neUppgifter, [String(ar)]: nytt };
    onData({ ...data, neUppgifter });
    setSparar(true);
    try {
      const res = await fetch('/api/admin/people', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: person.profileId, neUppgifter: { ar, data: nytt } }),
      });
      const svar = await res.json().catch(() => ({}));
      if (!res.ok) onError(svar.error || 'NE-uppgifterna kunde inte sparas');
    } finally {
      setSparar(false);
    }
  };

  const satt = (falt: Skattefalt, text: string) => {
    const n = tal(text);
    const nytt = { ...manuellt };
    if (n === undefined) delete nytt[falt]; else nytt[falt] = Math.abs(n);
    if (nytt[falt] !== manuellt[falt]) spara(nytt);
  };
  const sattIb = (kod: BKod, text: string) => {
    const n = tal(text);
    const ib = { ...(manuellt.ib ?? {}) };
    if (n === undefined) delete ib[kod]; else ib[kod] = n;
    if (ib[kod] !== manuellt.ib?.[kod]) spara({ ...manuellt, ib });
  };

  const laddaNerSru = async () => {
    if (!pnr) return;
    const { info, blanketter } = byggSru({ ar, personnummer: pnr, namn: person.name ?? '', falt: neFalt(ne, ar, verksamhet) });
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    // Filnamnen får inte ändras — Skatteverket läser dem som de är
    zip.file('INFO.SRU', info);
    zip.file('BLANKETTER.SRU', blanketter);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NE_${ar}_${pnr}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const laddaNerPdf = () => {
    exportArsbokslutPDF({
      ar,
      namn: person.name ?? '',
      personnummer: pnr ?? (data?.orgNr ?? ''),
      verksamhet,
      resultat: R_FALT.map((f) => ({ rad: f.rad, namn: f.namn, belopp: ne.r[f.kod], intakt: f.intakt })),
      bokfortResultat: ne.r11,
      tillgangar: B_FALT.filter((f) => !f.skuld).map((f) => ({ rad: f.rad, namn: f.namn, belopp: ne.b[f.kod] })),
      summaTillgangar: ne.summaTillgangar,
      egetKapital: ne.b10,
      skulder: B_FALT.filter((f) => f.skuld).map((f) => ({ rad: f.rad, namn: f.namn, belopp: ne.b[f.kod] })),
    });
  };

  const ars = [iar - 2, iar - 1, iar];
  const knapp = 'px-3 py-1.5 text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed';
  const input = 'w-24 bg-navy-700 border border-navy-600 text-white text-xs rounded px-2 py-1 text-right tabular-nums placeholder:text-warm-600';
  const s = ne.skatt;

  return (
    <section className="mt-8 bg-navy-800/60 border border-navy-700 rounded-xl p-4">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h3 className="text-white text-sm font-semibold mr-auto">
          NE-bilaga och förenklat årsbokslut (K1)
          {sparar && <span className="text-warm-500 font-normal text-xs ml-2">Sparar…</span>}
        </h3>
        <select value={ar} onChange={(e) => setValtAr(Number(e.target.value))}
          className="bg-navy-700 border border-navy-600 text-white text-xs rounded-lg px-2 py-1.5">
          {ars.map((y) => <option key={y} value={y}>Inkomstår {y}</option>)}
        </select>
        <button onClick={laddaNerPdf} disabled={!verifikationer}
          className={`${knapp} bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white`}>
          Årsbokslut (PDF)
        </button>
        <button onClick={laddaNerSru} disabled={!verifikationer || !pnr}
          title={pnr ? 'Zip med INFO.SRU och BLANKETTER.SRU — packa upp och ladda upp båda i Skatteverkets Filöverföring' : 'Giltigt personnummer saknas'}
          className={`${knapp} bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/30 text-gold-400`}>
          NE-fil (SRU)
        </button>
      </div>

      {!verifikationer ? (
        <p className="text-warm-500 text-xs">Hämtar verifikationerna…</p>
      ) : (
        <>
          <Varningar varningar={allaVarningar} className="mb-4" />

          <label className="flex items-center gap-2 text-xs mb-4">
            <span className="text-warm-400 shrink-0">Verksamhetens art</span>
            <input
              defaultValue={verksamhet}
              key={`verksamhet-${ar}`}
              maxLength={80}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== verksamhet) spara({ ...manuellt, verksamhet: v });
              }}
              className="flex-1 bg-navy-700 border border-navy-600 text-white text-xs rounded px-2 py-1"
            />
          </label>

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[11px] font-semibold text-warm-400 uppercase tracking-widest mb-2">Resultaträkning</h4>
              <table className="w-full text-xs">
                <tbody>
                  {R_FALT.map((f) => (
                    <tr key={f.kod} className="border-t border-navy-700/60">
                      <td className="py-1 pr-2 text-warm-500 w-9">{f.rad}</td>
                      <td className="py-1 pr-2 text-warm-300">{f.namn}</td>
                      <td className="py-1 text-right text-white tabular-nums">{ne.r[f.kod] ? kr.format(ne.r[f.kod]) : '–'}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-navy-500">
                    <td className="py-1.5 pr-2 text-warm-500">R11</td>
                    <td className="py-1.5 pr-2 text-white font-semibold">Bokfört resultat</td>
                    <td className="py-1.5 text-right text-white font-semibold tabular-nums">{kr.format(ne.r11)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold text-warm-400 uppercase tracking-widest mb-2">Balansräkning 31/12</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-warm-600 text-[10px]">
                    <th className="text-left font-normal" colSpan={2} />
                    <th className="text-right font-normal pb-1" title="Förra årets NE, samma rad">Ingående</th>
                    <th className="text-right font-normal pb-1 pl-2">Årets</th>
                    <th className="text-right font-normal pb-1 pl-2">Utgående</th>
                  </tr>
                </thead>
                <tbody>
                  {B_FALT.map((f, i) => (
                    <Fragment key={f.kod}>
                      {i === 9 && (
                        <tr key="b10" className="border-t border-navy-500">
                          <td className="py-1 pr-2 text-warm-500 w-9">B10</td>
                          <td className="py-1 pr-2 text-white font-semibold" colSpan={3}>Eget kapital (tillgångar − skulder)</td>
                          <td className="py-1 text-right text-white font-semibold tabular-nums">{kr.format(ne.b10)}</td>
                        </tr>
                      )}
                      <tr className="border-t border-navy-700/60">
                        <td className="py-1 pr-2 text-warm-500 w-9">{f.rad}</td>
                        <td className="py-1 pr-2 text-warm-300">{f.namn}</td>
                        <td className="py-0.5 text-right">
                          <input
                            key={`${ar}-${f.kod}`}
                            defaultValue={manuellt.ib?.[f.kod] ?? ''}
                            placeholder="0"
                            onBlur={(e) => sattIb(f.kod, e.target.value)}
                            className={input}
                          />
                        </td>
                        <td className="py-1 pl-2 text-right text-warm-400 tabular-nums">{ne.rorelser[f.kod] ? kr.format(Math.round(ne.rorelser[f.kod])) : '–'}</td>
                        <td className={`py-1 pl-2 text-right tabular-nums ${ne.b[f.kod] < 0 ? 'text-amber-300' : 'text-white'}`}>
                          {ne.b[f.kod] ? kr.format(ne.b[f.kod]) : '–'}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <h4 className="text-[11px] font-semibold text-warm-400 uppercase tracking-widest mt-6 mb-2">Skattemässiga justeringar</h4>
          <table className="w-full text-xs max-w-2xl">
            <tbody>
              <tr className="border-t border-navy-700/60">
                <td className="py-1 pr-2 text-warm-500 w-9">R12</td>
                <td className="py-1 pr-2 text-warm-300">Bokfört resultat (R11)</td>
                <td className="py-1 text-right text-white tabular-nums">{kr.format(s.r12)}</td>
              </tr>
              {SKATTERADER.map((r) => {
                const forslag = r.falt === 'r13' ? ne.forslag.r13 : r.falt === 'r14' ? ne.forslag.r14 : r.falt === 'r43' ? ne.forslag.r43 : null;
                return (
                  <tr key={r.falt} className="border-t border-navy-700/60">
                    <td className="py-1 pr-2 text-warm-500">{r.rad}</td>
                    <td className="py-1 pr-2 text-warm-300">
                      <span className="text-warm-500 mr-1">{r.tecken}</span>{r.namn}
                      {forslag !== null && manuellt[r.falt] === undefined && (
                        <span className="text-warm-600 ml-1">(förslag{r.falt === 'r43' ? ', 25 % schablon' : ' ur kontona'})</span>
                      )}
                    </td>
                    <td className="py-0.5 text-right">
                      <input
                        key={`${ar}-${r.falt}`}
                        defaultValue={manuellt[r.falt] ?? ''}
                        placeholder={forslag !== null ? String(forslag) : '0'}
                        onBlur={(e) => satt(r.falt, e.target.value)}
                        className={input}
                      />
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-navy-500">
                <td className="py-1.5 pr-2 text-warm-500">{s.resultat >= 0 ? 'R47' : 'R48'}</td>
                <td className="py-1.5 pr-2 text-white font-semibold">
                  {s.resultat >= 0 ? 'Överskott (förs till INK1 p. 10.1)' : 'Underskott (förs till INK1 p. 10.2)'}
                </td>
                <td className="py-1.5 text-right text-white font-semibold tabular-nums">{kr.format(Math.abs(s.resultat))}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-warm-600 text-[11px] mt-2">
            Tomma fält räknas som 0, utom R13, R14 och R43 som tar förslaget. Räntefördelning och expansionsfond ingår inte.
          </p>
        </>
      )}
    </section>
  );
}
