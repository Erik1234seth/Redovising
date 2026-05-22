'use client';

import { useEffect, useState } from 'react';
import { hämtaTransaktioner, type Transaktion } from '@/lib/rapporter';
import { exportTransaktionslistaPDF } from '@/lib/pdf';

const year = new Date().getFullYear();

const haendelseLabel: Record<string, string> = {
  'kund-betalat': 'Kund betalat',
  'kopt-nagot': 'Köpt något',
  'privat-pengar': 'Privata pengar',
  'ladda-upp': 'Bankkontoutdrag',
  'skatteverket': 'Skatteverket',
  'ovrigt': 'Övrigt',
};

const haendelseFärg: Record<string, string> = {
  'kund-betalat': 'bg-emerald-100 text-emerald-700',
  'kopt-nagot': 'bg-red-100 text-red-700',
  'privat-pengar': 'bg-blue-100 text-blue-700',
  'skatteverket': 'bg-amber-100 text-amber-700',
  'ladda-upp': 'bg-slate-100 text-slate-600',
  'ovrigt': 'bg-slate-100 text-slate-600',
};

export default function TransaktionslistaPage() {
  const [transaktioner, setTransaktioner] = useState<Transaktion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(`${year}-01-01`);
  const [toDate, setToDate] = useState(`${year}-12-31`);

  useEffect(() => {
    hämtaTransaktioner(year).then(data => {
      setTransaktioner(data);
      setLoading(false);
    });
  }, []);

  const filtered = transaktioner.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      t.beskrivning.toLowerCase().includes(q) ||
      (t.ai_debit_konto ?? '').includes(q) ||
      (t.ai_kredit_konto ?? '').includes(q) ||
      (t.ai_kategori ?? '').toLowerCase().includes(q);
    const matchFrom = !fromDate || t.datum >= fromDate;
    const matchTo   = !toDate   || t.datum <= toDate;
    return matchSearch && matchFrom && matchTo;
  });

  const totalIntäkter = filtered
    .filter(t => t.haendelse_typ === 'kund-betalat')
    .reduce((s, t) => s + t.belopp, 0);
  const totalKostnader = filtered
    .filter(t => ['kopt-nagot', 'skatteverket'].includes(t.haendelse_typ))
    .reduce((s, t) => s + t.belopp, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Transaktionslista</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Laddar...' : `${filtered.length} transaktioner · Räkenskapsår ${year}`}
          </p>
        </div>
        <button
          onClick={() => exportTransaktionslistaPDF(filtered, `${fromDate} – ${toDate}`)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportera PDF
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Summakort */}
          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Totalt in', value: totalIntäkter, color: 'text-emerald-600' },
                { label: 'Totalt ut', value: totalKostnader, color: 'text-red-500' },
                { label: 'Netto', value: totalIntäkter - totalKostnader, color: totalIntäkter - totalKostnader >= 0 ? 'text-emerald-600' : 'text-red-500' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-center">
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className={`text-base font-bold mt-0.5 ${s.color}`}>
                    {s.value.toLocaleString('sv-SE')} kr
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Filter */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Sök beskrivning, konto, kategori..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700 placeholder-slate-400"
              />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-slate-500 whitespace-nowrap">Från</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700" />
              <label className="text-xs text-slate-500 whitespace-nowrap">Till</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700" />
            </div>
          </div>

          {/* Tabell */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-sm">Laddar transaktioner...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">
                    {search ? 'Inga träffar' : 'Inga transaktioner ännu'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {search ? 'Prova en annan sökning.' : 'Registrera din första transaktion under Bokföring.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[100px_1fr_140px_110px_110px] px-5 py-2.5 bg-slate-50 border-b border-slate-200">
                  {['Datum', 'Beskrivning', 'Typ', 'Belopp', 'Moms'].map((h, i) => (
                    <span key={i} className={`text-xs font-semibold text-slate-500 uppercase tracking-wide ${i >= 3 ? 'text-right' : ''}`}>{h}</span>
                  ))}
                </div>
                {filtered.map(t => (
                  <div key={t.id} className="grid grid-cols-[100px_1fr_140px_110px_110px] px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <span className="text-xs font-mono text-slate-500 self-center">{t.datum}</span>
                    <div className="min-w-0 self-center">
                      <p className="text-sm text-slate-700 font-medium truncate">{t.beskrivning}</p>
                      {(t.ai_debit_konto || t.ai_kredit_konto) && (
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          Dr {t.ai_debit_konto ?? '—'} · Cr {t.ai_kredit_konto ?? '—'}
                        </p>
                      )}
                    </div>
                    <div className="self-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${haendelseFärg[t.haendelse_typ] ?? 'bg-slate-100 text-slate-600'}`}>
                        {haendelseLabel[t.haendelse_typ] ?? t.haendelse_typ}
                      </span>
                    </div>
                    <span className="text-sm font-mono text-right self-center text-slate-700">
                      {t.belopp.toLocaleString('sv-SE')} kr
                    </span>
                    <span className="text-sm font-mono text-right self-center text-slate-400">
                      {t.moms > 0 ? `${t.moms.toLocaleString('sv-SE')} kr` : '—'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
