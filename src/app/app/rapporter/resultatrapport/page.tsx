'use client';

import { useEffect, useState } from 'react';
import { hämtaTransaktioner, beräknaResultat, filterMånad, fmtKr, type Transaktion } from '@/lib/rapporter';
import { exportResultatrapportPDF } from '@/lib/pdf';

const currentYear = new Date().getFullYear();

const månader = [
  { label: 'Hela året', value: 0 },
  { label: 'Jan', value: 1 }, { label: 'Feb', value: 2 }, { label: 'Mar', value: 3 },
  { label: 'Apr', value: 4 }, { label: 'Maj', value: 5 }, { label: 'Jun', value: 6 },
  { label: 'Jul', value: 7 }, { label: 'Aug', value: 8 }, { label: 'Sep', value: 9 },
  { label: 'Okt', value: 10 }, { label: 'Nov', value: 11 }, { label: 'Dec', value: 12 },
];

export default function ResultatrapportPage() {
  const [alla, setAlla] = useState<Transaktion[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(0);

  useEffect(() => {
    hämtaTransaktioner(currentYear).then(data => {
      setAlla(data);
      setLoading(false);
    });
  }, []);

  const transaktioner = filterMånad(alla, period);
  const { intäkterRader, kostnadRader, sumIntäkter, sumKostnader, rörelseresultat } = beräknaResultat(transaktioner);

  const periodLabel = period === 0
    ? `Räkenskapsår ${currentYear}`
    : `${månader.find(m => m.value === period)?.label} ${currentYear}`;

  function ResultatFärg({ v }: { v: number }) {
    if (v === 0) return <span className="text-slate-300 font-mono text-sm">0 kr</span>;
    return <span className={`font-mono text-sm ${v > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtKr(v)}</span>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Resultatrapport</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Laddar...' : `Uppdateras automatiskt · ${periodLabel}`}
          </p>
        </div>
        <button
          onClick={() => exportResultatrapportPDF({ intäkterRader, kostnadRader, sumIntäkter, sumKostnader, rörelseresultat }, periodLabel)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportera PDF
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Periodfilter */}
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap gap-1.5">
              {månader.map(m => (
                <button key={m.value} onClick={() => setPeriod(m.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === m.value ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="text-sm">Laddar...</span>
            </div>
          ) : (
            <>
              {/* Summakort */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Intäkter', value: sumIntäkter, color: 'text-emerald-600' },
                  { label: 'Kostnader', value: sumKostnader, color: 'text-red-500' },
                  { label: 'Resultat', value: rörelseresultat, color: rörelseresultat >= 0 ? 'text-emerald-600' : 'text-red-500' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3.5 text-center">
                    <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                    <p className={`text-lg font-bold mt-1 ${s.color}`}>{fmtKr(s.value)}</p>
                  </div>
                ))}
              </div>

              {/* Intäkter */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Intäkter</p>
                </div>
                {intäkterRader.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-slate-400">Inga intäkter registrerade för perioden</p>
                ) : (
                  intäkterRader.map(r => (
                    <div key={r.konto} className="flex items-center justify-between px-6 py-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400 font-mono w-10">{r.konto}</span>
                        <span className="text-sm text-slate-600">{r.namn}</span>
                      </div>
                      <span className="text-sm font-mono text-emerald-600">{fmtKr(r.belopp)}</span>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200">
                  <span className="text-sm font-semibold text-slate-800">Summa intäkter</span>
                  <span className="text-sm font-semibold font-mono text-emerald-600">{fmtKr(sumIntäkter)}</span>
                </div>
              </div>

              {/* Kostnader */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kostnader</p>
                </div>
                {kostnadRader.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-slate-400">Inga kostnader registrerade för perioden</p>
                ) : (
                  kostnadRader.map(r => (
                    <div key={r.konto} className="flex items-center justify-between px-6 py-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400 font-mono w-10">{r.konto}</span>
                        <span className="text-sm text-slate-600">{r.namn}</span>
                      </div>
                      <span className="text-sm font-mono text-red-500">{fmtKr(r.belopp)}</span>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200">
                  <span className="text-sm font-semibold text-slate-800">Summa kostnader</span>
                  <span className="text-sm font-semibold font-mono text-red-500">{fmtKr(sumKostnader)}</span>
                </div>
              </div>

              {/* Resultat */}
              <div className="rounded-xl px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#173b57' }}>
                <span className="text-sm font-bold text-white">Resultat</span>
                <span className={`text-sm font-bold font-mono ${rörelseresultat >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {fmtKr(rörelseresultat)}
                </span>
              </div>

              {transaktioner.length === 0 && (
                <p className="text-xs text-slate-400 text-center">Inga transaktioner för perioden. Registrera under Bokföring.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
