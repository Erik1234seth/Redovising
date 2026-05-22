'use client';

import { useEffect, useState } from 'react';
import { hämtaTransaktioner, beräknaKontosaldo, fmtKr, type Transaktion } from '@/lib/rapporter';
import { exportBalansrapportPDF } from '@/lib/pdf';

const currentYear = new Date().getFullYear();

export default function BalansrapportPage() {
  const [transaktioner, setTransaktioner] = useState<Transaktion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hämtaTransaktioner(currentYear).then(data => {
      setTransaktioner(data);
      setLoading(false);
    });
  }, []);

  const kontosaldo = beräknaKontosaldo(transaktioner);

  const tillgångar = kontosaldo.filter(k => k.konto.startsWith('1'));
  const skulderEK  = kontosaldo.filter(k => k.konto.startsWith('2'));

  const sumTillgångar = tillgångar.reduce((s, k) => s + k.saldo, 0);
  const sumSkulderEK  = skulderEK.reduce((s, k) => s + k.saldo, 0);

  // Add period profit to equity if accounts don't balance
  const periodresltat = kontosaldo
    .filter(k => /^[3-7]/.test(k.konto))
    .reduce((s, k) => {
      const isIntäkt = k.konto.startsWith('3');
      return isIntäkt ? s + k.saldo : s - k.saldo;
    }, 0);

  const sumSkulderEKMedResultat = sumSkulderEK + periodresltat;
  const balances = Math.abs(sumTillgångar - sumSkulderEKMedResultat) < 1;

  function BalansSektion({ title, rader }: { title: string; rader: typeof tillgångar }) {
    const summa = rader.reduce((s, k) => s + k.saldo, 0);
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
        </div>
        {rader.length === 0 ? (
          <p className="px-6 py-4 text-sm text-slate-400">Inga poster</p>
        ) : (
          rader.map(k => (
            <div key={k.konto} className="flex items-center justify-between px-6 py-3 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-400 font-mono w-10">{k.konto}</span>
                <span className="text-sm text-slate-600">{k.namn}</span>
              </div>
              <span className={`text-sm font-mono ${k.saldo !== 0 ? 'text-slate-700' : 'text-slate-300'}`}>{fmtKr(k.saldo)}</span>
            </div>
          ))
        )}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200">
          <span className="text-sm font-semibold text-slate-700">Summa</span>
          <span className="text-sm font-semibold font-mono text-slate-700">{fmtKr(summa)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Balansrapport</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Laddar...' : `${new Date().toLocaleDateString('sv-SE')} · Räkenskapsår ${currentYear}`}
          </p>
        </div>
        <button
          onClick={() => exportBalansrapportPDF({ tillgångar, skulderEK, periodresltat, sumTillgångar, sumSkulderEKMedResultat, year: currentYear })}
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
              {/* Balansstatus */}
              {transaktioner.length > 0 && (
                <div className={`flex items-center gap-3 rounded-xl px-5 py-3.5 border ${balances ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${balances ? 'bg-emerald-500' : 'bg-amber-400'}`}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {balances
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                      }
                    </svg>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${balances ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {balances ? 'Balansräkningen balanserar' : 'Preliminär rapport — bokslut ej gjort'}
                    </p>
                    <p className={`text-xs mt-0.5 ${balances ? 'text-emerald-600' : 'text-amber-700'}`}>
                      Tillgångar: {fmtKr(sumTillgångar)} · Skulder & EK: {fmtKr(sumSkulderEKMedResultat)}
                    </p>
                  </div>
                </div>
              )}

              {/* Tillgångar */}
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 mb-2">Tillgångar</h2>
                <BalansSektion title="Anläggningstillgångar (1000–1499)" rader={tillgångar.filter(k => parseInt(k.konto) < 1500)} />
                <div className="mt-3">
                  <BalansSektion title="Omsättningstillgångar (1500–1999)" rader={tillgångar.filter(k => parseInt(k.konto) >= 1500)} />
                </div>
                <div className="mt-3 rounded-xl px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#173b57' }}>
                  <span className="text-sm font-bold text-white">Summa tillgångar</span>
                  <span className="text-sm font-bold font-mono text-white">{fmtKr(sumTillgångar)}</span>
                </div>
              </div>

              {/* Skulder & EK */}
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 mb-2">Skulder & Eget kapital</h2>
                <BalansSektion title="Eget kapital (2000–2099)" rader={skulderEK.filter(k => parseInt(k.konto) < 2100)} />
                <div className="mt-3">
                  <BalansSektion title="Kortfristiga skulder (2100–2999)" rader={skulderEK.filter(k => parseInt(k.konto) >= 2100)} />
                </div>
                {periodresltat !== 0 && (
                  <div className="mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-3">
                      <span className="text-sm text-slate-600">Årets resultat (ej bokfört)</span>
                      <span className={`text-sm font-mono ${periodresltat >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtKr(periodresltat)}</span>
                    </div>
                  </div>
                )}
                <div className="mt-3 rounded-xl px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#173b57' }}>
                  <span className="text-sm font-bold text-white">Summa skulder & eget kapital</span>
                  <span className="text-sm font-bold font-mono text-white">{fmtKr(sumSkulderEKMedResultat)}</span>
                </div>
              </div>

              {transaktioner.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 gap-3">
                  <p className="text-sm font-medium text-slate-600">Inga poster ännu</p>
                  <p className="text-xs text-slate-400">Registrera transaktioner under Bokföring så visas balansen här.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
