'use client';

import { useEffect, useState } from 'react';
import { hämtaTransaktioner, beräknaMoms, filterMånad, fmtKr, type Transaktion } from '@/lib/rapporter';
import { exportMomsredovisningPDF } from '@/lib/pdf';

const currentYear = new Date().getFullYear();

const perioder = [
  { label: 'Kvartal 1 (jan–mar)', value: 'q1', månader: [1, 2, 3] },
  { label: 'Kvartal 2 (apr–jun)', value: 'q2', månader: [4, 5, 6] },
  { label: 'Kvartal 3 (jul–sep)', value: 'q3', månader: [7, 8, 9] },
  { label: 'Kvartal 4 (okt–dec)', value: 'q4', månader: [10, 11, 12] },
  { label: 'Helår', value: 'full', månader: [] },
];

export default function MomsredovisningPage() {
  const [alla, setAlla] = useState<Transaktion[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('q1');

  useEffect(() => {
    hämtaTransaktioner(currentYear).then(data => {
      setAlla(data);
      setLoading(false);
    });
  }, []);

  const valdPeriod = perioder.find(p => p.value === period)!;
  const transaktioner = valdPeriod.månader.length === 0
    ? alla
    : alla.filter(t => {
        const m = parseInt(t.datum.slice(5, 7));
        return valdPeriod.månader.includes(m);
      });

  const moms = beräknaMoms(transaktioner);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Momsredovisning</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Laddar...' : `Underlag för Skatteverket · ${currentYear}`}
          </p>
        </div>
        <button
          onClick={() => exportMomsredovisningPDF({ utgåendeMoms: moms.sumUtgående, ingåendeMoms: moms.ingående, netto: moms.netto, moms25: moms.utgående25.moms, moms12: moms.utgående12.moms, moms6: moms.utgående6.moms }, valdPeriod.label)}
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

          {/* Perioder */}
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap gap-1.5">
              {perioder.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p.value ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  {p.label}
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
              {/* Nettoruta */}
              <div className={`rounded-xl border px-5 py-4 ${moms.netto > 0 ? 'bg-red-50 border-red-200' : moms.netto < 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${moms.netto > 0 ? 'text-red-800' : moms.netto < 0 ? 'text-emerald-800' : 'text-slate-700'}`}>
                      {moms.netto > 0 ? 'Moms att betala' : moms.netto < 0 ? 'Moms att få tillbaka' : 'Ingen moms'}
                    </p>
                    <p className={`text-xs mt-0.5 ${moms.netto > 0 ? 'text-red-600' : moms.netto < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      Utgående {fmtKr(moms.sumUtgående)} − Ingående {fmtKr(moms.ingående)}
                    </p>
                  </div>
                  <p className={`text-2xl font-bold font-mono ${moms.netto > 0 ? 'text-red-700' : moms.netto < 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {fmtKr(Math.abs(moms.netto))}
                  </p>
                </div>
              </div>

              {/* Utgående moms */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Utgående moms (din försäljning)</p>
                </div>
                <div className="grid grid-cols-[40px_1fr_130px_130px] px-6 py-2 border-b border-slate-100 bg-slate-50/40">
                  <span className="text-xs font-semibold text-slate-400">Ruta</span>
                  <span className="text-xs font-semibold text-slate-400">Beskrivning</span>
                  <span className="text-xs font-semibold text-slate-400 text-right">Underlag</span>
                  <span className="text-xs font-semibold text-slate-400 text-right">Moms</span>
                </div>
                {[
                  { ruta: '05', label: 'Momspliktig försäljning 25%', data: moms.utgående25 },
                  { ruta: '06', label: 'Momspliktig försäljning 12%', data: moms.utgående12 },
                  { ruta: '07', label: 'Momspliktig försäljning 6%',  data: moms.utgående6  },
                ].map(r => (
                  <div key={r.ruta} className="grid grid-cols-[40px_1fr_130px_130px] px-6 py-3 border-b border-slate-100 last:border-0">
                    <span className="text-xs font-mono font-bold text-slate-400">{r.ruta}</span>
                    <span className="text-sm text-slate-600">{r.label}</span>
                    <span className={`text-sm font-mono text-right ${r.data.underlag > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                      {fmtKr(r.data.underlag)}
                    </span>
                    <span className={`text-sm font-mono text-right ${r.data.moms > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                      {fmtKr(r.data.moms)}
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-[40px_1fr_130px_130px] px-6 py-3.5 bg-slate-50 border-t border-slate-200">
                  <span /><span className="text-sm font-semibold text-slate-700">Summa utgående moms</span>
                  <span />
                  <span className="text-sm font-semibold font-mono text-right text-slate-700">{fmtKr(moms.sumUtgående)}</span>
                </div>
              </div>

              {/* Ingående moms */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ingående moms (dina inköp)</p>
                </div>
                <div className="grid grid-cols-[40px_1fr_130px] px-6 py-3 border-b border-slate-100">
                  <span className="text-xs font-mono font-bold text-slate-400">48</span>
                  <span className="text-sm text-slate-600">Ingående moms att dra av</span>
                  <span className={`text-sm font-mono text-right ${moms.ingående > 0 ? 'text-slate-700' : 'text-slate-300'}`}>{fmtKr(moms.ingående)}</span>
                </div>
                <div className="grid grid-cols-[40px_1fr_130px] px-6 py-3.5 bg-slate-50 border-t border-slate-200">
                  <span /><span className="text-sm font-semibold text-slate-700">Summa ingående moms</span>
                  <span className="text-sm font-semibold font-mono text-right text-slate-700">{fmtKr(moms.ingående)}</span>
                </div>
              </div>

              {/* Info */}
              <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-700">
                  Lämna in din momsdeklaration via Skatteverkets e-tjänst. Exportera PDF härifrån och använd som underlag. Glöm inte att betala eventuell moms i tid.
                </p>
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
