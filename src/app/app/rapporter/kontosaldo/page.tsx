'use client';

import { useEffect, useState } from 'react';
import { hämtaTransaktioner, beräknaKontosaldo, fmtKr, type Kontorad, type Transaktion } from '@/lib/rapporter';
import { exportKontosaldoPDF } from '@/lib/pdf';

const currentYear = new Date().getFullYear();

const kontoklassNamn: Record<string, string> = {
  '1': 'Tillgångskonton',
  '2': 'Skuld- och eget kapitalkonton',
  '3': 'Intäktskonton',
  '4': 'Kostnadskonton (varor)',
  '5': 'Kostnadskonton (lokaler m.m.)',
  '6': 'Kostnadskonton (övrigt)',
  '7': 'Kostnadskonton (personal)',
  '8': 'Finansiella konton',
};

export default function KontosaldoPage() {
  const [transaktioner, setTransaktioner] = useState<Transaktion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hämtaTransaktioner(currentYear).then(data => {
      setTransaktioner(data);
      setLoading(false);
    });
  }, []);

  const rader = beräknaKontosaldo(transaktioner);

  const grupperadeKonton = rader.reduce<Record<string, Kontorad[]>>((acc, r) => {
    const klass = r.konto[0] ?? '9';
    if (!acc[klass]) acc[klass] = [];
    acc[klass].push(r);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Kontosaldo</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Laddar...' : `Saldo per konto · ${new Date().toLocaleDateString('sv-SE')} · ${currentYear}`}
          </p>
        </div>
        <button
          onClick={() => exportKontosaldoPDF(grupperadeKonton, currentYear)}
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
          ) : rader.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm font-medium text-slate-600">Inga konton ännu</p>
              <p className="text-xs text-slate-400">Registrera transaktioner under Bokföring så visas saldon här.</p>
            </div>
          ) : (
            Object.entries(grupperadeKonton).sort().map(([klass, kontor]) => {
              const summa = kontor.reduce((s, k) => s + k.saldo, 0);
              return (
                <div key={klass} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded">
                        Klass {klass}
                      </span>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {kontoklassNamn[klass] ?? 'Övriga konton'}
                      </p>
                    </div>
                    <span className={`text-xs font-mono font-semibold ${summa !== 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                      {fmtKr(summa)}
                    </span>
                  </div>
                  {kontor.map(k => (
                    <div key={k.konto} className="flex items-center justify-between px-6 py-3 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400 font-mono w-10">{k.konto}</span>
                        <span className="text-sm text-slate-600">{k.namn}</span>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <span className="text-xs font-mono text-slate-400 hidden sm:block">
                          Dr {fmtKr(k.debet)} / Cr {fmtKr(k.kredit)}
                        </span>
                        <span className={`text-sm font-mono font-semibold w-24 text-right ${k.saldo !== 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                          {fmtKr(k.saldo)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}

          {!loading && rader.length > 0 && (
            <p className="text-xs text-slate-400 text-center">
              Saldon uppdateras automatiskt när du registrerar transaktioner i Bokföring
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
