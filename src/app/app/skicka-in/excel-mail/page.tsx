'use client';

import { useState } from 'react';
import Link from 'next/link';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const SHEET_COLS = ['Datum', 'Beskrivning', 'Belopp (kr)', 'Moms (kr)', 'Typ'];
const SHEET_ROWS = [
  ['2025-03-15', 'Kontorsmaterial', '1 000', '200', 'Utgift'],
  ['2025-03-20', 'Faktura 101 – Kund AB', '6 250', '1 250', 'Inkomst'],
  ['2025-04-02', 'Mobilabonnemang', '400', '80', 'Utgift'],
];

export default function ExcelMailPage() {
  const [copied, setCopied] = useState(false);

  function copyEmail() {
    navigator.clipboard.writeText('erik@enklabokslut.se');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d2236 0%, #173b57 100%)' }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative px-8 pt-10 pb-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-8">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tillbaka
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
              Maila in fil
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Maila in din bokföringsfil</h1>
          <p className="text-white/55 text-sm mt-2 leading-relaxed max-w-xs">
            Se hur filen ska se ut, ladda ner mallen och maila in den när den är klar.
          </p>
          <div className="flex gap-3 mt-7 flex-wrap">
            {[{ value: '5', label: 'kolumner' }, { value: '1–2 dagar', label: 'svarstid' }, { value: 'Vi', label: 'bokför åt dig' }].map(s => (
              <div key={s.label} className="rounded-xl px-4 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-white font-extrabold text-base leading-none">{s.value}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pb-12 max-w-2xl flex flex-col gap-5 mt-6">

        {/* Mac-stil Excel-visualisering */}
        <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
          <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: '#1e2d3d' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 bg-white/10 rounded-md px-3 py-1">
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
                </svg>
                <span className="text-xs text-white/70 font-medium">bokforing-mall.xlsx</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200" style={{ backgroundColor: '#f0f4f8' }}>
            {['B', 'I', 'U'].map(l => (
              <span key={l} className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-500 bg-white rounded border border-slate-200 cursor-default select-none">{l}</span>
            ))}
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <span className="text-xs text-slate-400 font-mono">A1</span>
            <div className="flex-1 h-5 bg-white rounded border border-slate-200 px-2 flex items-center">
              <span className="text-xs text-slate-500 font-mono">Datum</span>
            </div>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-xs border-collapse" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th className="w-8 border-r border-b border-slate-200 bg-slate-50 text-slate-400 font-medium py-1.5 text-center sticky left-0" />
                  {['A', 'B', 'C', 'D', 'E'].map(l => (
                    <th key={l} className="border-r border-b border-slate-200 bg-slate-50 text-slate-400 font-medium py-1.5 px-2 text-center w-28">{l}</th>
                  ))}
                </tr>
                <tr>
                  <td className="border-r border-b border-slate-200 bg-slate-50 text-slate-400 font-medium text-center py-1.5 text-[11px] sticky left-0">1</td>
                  {SHEET_COLS.map((col, i) => (
                    <td key={i} className="border-r border-b px-2 py-2 font-bold text-white text-[11px]" style={{ backgroundColor: '#1d6f42' }}>
                      {col}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHEET_ROWS.map((row, ri) => (
                  <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? 'white' : '#f7faf8' }}>
                    <td className="border-r border-b border-slate-200 bg-slate-50 text-slate-400 font-medium text-center py-1.5 text-[11px] sticky left-0">{ri + 2}</td>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border-r border-b border-slate-100 px-2 py-2 text-[11px]"
                        style={{ color: cell === 'Utgift' ? '#dc2626' : cell === 'Inkomst' ? '#16a34a' : '#374151', fontWeight: (cell === 'Utgift' || cell === 'Inkomst') ? 600 : 400 }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                {[4, 5].map(n => (
                  <tr key={n} style={{ backgroundColor: n % 2 === 0 ? 'white' : '#f7faf8' }}>
                    <td className="border-r border-b border-slate-200 bg-slate-50 text-slate-300 font-medium text-center py-1.5 text-[11px] sticky left-0">{n + 1}</td>
                    {[0, 1, 2, 3, 4].map(i => <td key={i} className="border-r border-b border-slate-100 px-2 py-2" />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolumnförklaring */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">Vad ska filen innehålla?</h2>
            <p className="text-xs text-slate-400 mt-1">Varje rad är en transaktion. Kolumnerna behöver inte heta exakt så — vi tolkar dem automatiskt.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { col: 'Datum', badge: 'Krav', color: 'rose', desc: 'Format ÅÅÅÅ-MM-DD, t.ex. 2025-03-15.' },
              { col: 'Beskrivning', badge: 'Krav', color: 'rose', desc: 'Vad transaktionen gäller, t.ex. "Faktura 101 – Kund AB".' },
              { col: 'Belopp', badge: 'Krav', color: 'rose', desc: 'Hela beloppet inklusive moms, i kronor.' },
              { col: 'Moms', badge: 'Krav', color: 'rose', desc: 'Momsbeloppet i kronor. Skriv 0 om ingen moms.' },
              { col: 'Typ', badge: 'Krav', color: 'rose', desc: '"Inkomst" för pengar in och "Utgift" för pengar ut.' },
              { col: 'Valuta', badge: 'Valfritt', color: 'slate', desc: 'Behövs bara om transaktionen inte är i SEK.' },
            ].map(item => (
              <div key={item.col} className="flex items-start gap-3 px-6 py-3.5">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${item.color === 'rose' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                  {item.badge}
                </span>
                <div>
                  <span className="text-sm font-semibold text-slate-700">{item.col}</span>
                  <span className="text-xs text-slate-400 ml-2">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400">Stödjer <span className="font-medium text-slate-500">.csv</span>, <span className="font-medium text-slate-500">.xlsx</span> och <span className="font-medium text-slate-500">.xls</span></p>
          </div>
        </div>

        {/* Mall */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-800 mb-0.5">Ladda ner mall</h2>
            <p className="text-xs text-slate-400">Färdig fil med rätt kolumner — fyll i och maila in.</p>
          </div>
          <a
            href="/templates/bokforing-mall.csv"
            download="bokforing-mall.csv"
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: NAV_BG }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Ladda ner
          </a>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Maila in nedan
          </div>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Mail CTA */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f2840 0%, #173b57 100%)' }}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-white text-sm">Maila in din fil</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Vi bokför och återkommer om vi har frågor</p>
              </div>
            </div>

            <div className="rounded-xl px-5 py-3.5 flex items-center justify-between gap-3 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Mailadress</p>
                <p className="text-white font-bold text-sm">erik@enklabokslut.se</p>
              </div>
              <button
                onClick={copyEmail}
                className="text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all flex-shrink-0"
                style={{ backgroundColor: copied ? '#059669' : 'rgba(255,255,255,0.14)', color: 'white' }}
              >
                {copied ? '✓ Kopierat' : 'Kopiera'}
              </button>
            </div>

            <a
              href="mailto:erik@enklabokslut.se?subject=Bokföringsfil"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 mb-5"
              style={{ backgroundColor: CORAL }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Öppna mail
            </a>

            <div className="flex flex-col gap-2.5">
              {[
                'Spara filen som .xlsx och namnge den med ditt företagsnamn',
                'Fyll i ämnesraden med vilket år eller kvartal det gäller',
                'Vi svarar inom 1–2 arbetsdagar',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <span className="text-[10px] font-extrabold text-white/60">{i + 1}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}18` }}>
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-slate-500 leading-relaxed">
            Du kan alltid bokföra direkt på hemsidan under <span className="font-medium text-slate-600">Bokföra</span> — oavsett om du också mailar in fil.
          </p>
        </div>

      </div>
    </div>
  );
}
