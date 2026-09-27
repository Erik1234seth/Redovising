'use client';

import { useState } from 'react';
import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';
const EXCEL_GREEN = '#1D6F42';

const columns = [
  {
    letter: 'A',
    name: 'Datum',
    width: 'w-32',
    desc: 'Datumet då transaktionen ägde rum. Format: ÅÅÅÅ-MM-DD.',
    tip: 'Använd ISO-format: 2025-03-14',
  },
  {
    letter: 'B',
    name: 'Beskrivning',
    width: 'w-56',
    desc: 'Kort beskrivning av vad transaktionen gäller. Var specifik — det gör bokföringen snabbare och mer exakt.',
    tip: 'T.ex. "Faktura kund A" eller "Adobe Creative Cloud"',
  },
  {
    letter: 'C',
    name: 'Belopp',
    width: 'w-28',
    desc: 'Beloppet inklusive moms. Negativt för utgifter, positivt för inkomster.',
    tip: 'Utgifter skrivs med minustecken: -1 250,00',
  },
  {
    letter: 'D',
    name: 'Momsprocent',
    width: 'w-28',
    desc: 'Momssatsen för transaktionen. Vanligast är 25 %, 12 %, 6 % eller 0 % (momsfri).',
    tip: 'Osäker? Lämna en kommentar i cellen så kollar vi',
  },
];

const rows = [
  { datum: '2025-03-01', desc: 'Inkomst konsultuppdrag kund A', belopp: '18 750,00', moms: '25 %', income: true },
  { datum: '2025-03-07', desc: 'Adobe Creative Cloud', belopp: '-1 250,00', moms: '25 %', income: false },
  { datum: '2025-03-12', desc: 'Tågbiljett kundmöte Göteborg', belopp: '-438,00', moms: '6 %', income: false },
  { datum: '2025-03-20', desc: 'Försäkring företag', belopp: '-890,00', moms: '0 %', income: false },
  { datum: '2025-03-28', desc: 'Inkomst konsultuppdrag kund B', belopp: '12 500,00', moms: '25 %', income: true },
];

function ExcelMockup({ activeCol, onColClick }: { activeCol: number | null; onColClick: (i: number) => void }) {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-300 select-none" style={{ fontFamily: 'Calibri, Arial, sans-serif' }}>

      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm flex items-center justify-center" style={{ backgroundColor: EXCEL_GREEN }}>
            <span className="text-white font-extrabold" style={{ fontSize: '9px' }}>X</span>
          </div>
          <span className="text-gray-200 text-xs font-medium">Transaktioner_2025.xlsx</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <div className="w-3 h-3 rounded-full bg-red-400" />
        </div>
      </div>

      {/* Ribbon (simplified) */}
      <div className="px-3 py-1 flex items-center gap-3 border-b border-gray-300" style={{ backgroundColor: EXCEL_GREEN }}>
        {['Arkiv', 'Start', 'Infoga', 'Formler', 'Data'].map((t, i) => (
          <span key={t} className="text-xs cursor-default px-1.5 py-0.5 rounded" style={{ color: i === 1 ? 'white' : 'rgba(255,255,255,0.7)', backgroundColor: i === 1 ? 'rgba(255,255,255,0.15)' : 'transparent' }}>
            {t}
          </span>
        ))}
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-200 bg-white">
        <span className="text-xs text-gray-500 font-mono w-10 text-center border border-gray-300 rounded px-1 py-0.5">
          {activeCell ? `${columns[activeCell.col]?.letter}${activeCell.row + 2}` : 'A1'}
        </span>
        <span className="text-gray-300 text-xs">fx</span>
        <span className="text-xs text-gray-700 font-mono truncate">
          {activeCell
            ? activeCell.row === -1
              ? columns[activeCell.col]?.name
              : [rows[activeCell.row]?.datum, rows[activeCell.row]?.desc, rows[activeCell.row]?.belopp, rows[activeCell.row]?.moms][activeCell.col]
            : 'Datum'
          }
        </span>
      </div>

      {/* Sheet */}
      <div className="overflow-x-auto bg-white">
        <table className="border-collapse text-xs" style={{ minWidth: '100%' }}>

          {/* Column letters row */}
          <thead>
            <tr>
              {/* Row number gutter */}
              <th className="w-8 border-r border-b border-gray-300 bg-gray-100" style={{ minWidth: '2rem' }} />
              {columns.map((col, i) => (
                <th
                  key={col.letter}
                  onClick={() => onColClick(i)}
                  className={`border-r border-b border-gray-300 text-center py-0.5 cursor-pointer transition-colors ${col.width}`}
                  style={{
                    backgroundColor: activeCol === i ? '#BFDBFE' : i % 2 === 0 ? '#F3F4F6' : '#F9FAFB',
                    color: '#374151',
                    fontWeight: 600,
                  }}
                >
                  {col.letter}
                </th>
              ))}
            </tr>

            {/* Header row */}
            <tr>
              <td className="border-r border-b border-gray-300 bg-gray-100 text-center text-gray-500 py-1.5 px-1" style={{ fontSize: '10px' }}>1</td>
              {columns.map((col, i) => (
                <td
                  key={col.letter}
                  onClick={() => { onColClick(i); setActiveCell({ row: -1, col: i }); }}
                  className={`border-r border-b px-2 py-1.5 font-bold cursor-pointer transition-colors ${col.width}`}
                  style={{
                    backgroundColor: activeCol === i ? '#93C5FD' : EXCEL_GREEN,
                    color: 'white',
                    borderColor: activeCol === i ? '#3B82F6' : '#166534',
                    outline: activeCell?.row === -1 && activeCell?.col === i ? `2px solid #1D4ED8` : 'none',
                    outlineOffset: '-2px',
                  }}
                >
                  {col.name}
                </td>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? 'white' : '#F9FAFB' }}>
                <td className="border-r border-b border-gray-200 bg-gray-100 text-center text-gray-500 py-1.5" style={{ fontSize: '10px' }}>{ri + 2}</td>
                {[row.datum, row.desc, row.belopp, row.moms].map((val, ci) => (
                  <td
                    key={ci}
                    onClick={() => { onColClick(ci); setActiveCell({ row: ri, col: ci }); }}
                    className={`border-r border-b border-gray-200 px-2 py-1.5 cursor-pointer transition-colors font-mono whitespace-nowrap`}
                    style={{
                      backgroundColor: activeCol === ci
                        ? '#DBEAFE'
                        : activeCell?.row === ri && activeCell?.col === ci
                          ? '#EFF6FF'
                          : ri % 2 === 0 ? 'white' : '#F9FAFB',
                      color: ci === 2
                        ? (row.income ? '#16A34A' : '#DC2626')
                        : '#374151',
                      outline: activeCell?.row === ri && activeCell?.col === ci ? '2px solid #3B82F6' : 'none',
                      outlineOffset: '-2px',
                      fontWeight: ci === 2 ? 600 : 400,
                    }}
                  >
                    {val}
                  </td>
                ))}
              </tr>
            ))}

            {/* Empty row */}
            <tr>
              <td className="border-r border-b border-gray-200 bg-gray-100 text-center text-gray-400 py-1.5" style={{ fontSize: '10px' }}>{rows.length + 2}</td>
              {columns.map((_, ci) => (
                <td key={ci} className="border-r border-b border-gray-200 px-2 py-1.5"
                  style={{ backgroundColor: activeCol === ci ? '#DBEAFE' : 'white' }}
                />
              ))}
            </tr>
          </tbody>
        </table>

        {/* Sheet tab */}
        <div className="flex items-center border-t border-gray-300 bg-gray-100 px-2 py-1 gap-1">
          <div className="px-3 py-0.5 text-xs rounded-t border border-b-0 border-gray-300 bg-white font-medium" style={{ color: EXCEL_GREEN }}>
            Mars 2025
          </div>
          <div className="px-3 py-0.5 text-xs text-gray-400 cursor-pointer hover:bg-gray-200 rounded-t">April 2025</div>
          <div className="w-5 h-5 flex items-center justify-center text-gray-400 text-base cursor-pointer hover:bg-gray-200 rounded">+</div>
        </div>
      </div>
    </div>
  );
}

export default function SaSkickarDuInPage() {
  const [activeCol, setActiveCol] = useState<number | null>(null);

  const handleColClick = (i: number) => {
    setActiveCol(prev => prev === i ? null : i);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>

      {/* Hero */}
      <div className="py-16 sm:py-20 text-center px-4" style={{ backgroundColor: NAV_BG }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: CORAL }}>
          Löpande bokföring
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
          Så skickar du in dina transaktioner
        </h1>
        <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
          Allt sker i ett delat kalkylark — enkelt, strukturerat och exakt det vi behöver för att sköta din bokföring löpande.
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">

        {/* Intro */}
        <div className="bg-white rounded-2xl p-8 sm:p-10 border border-gray-100 shadow-sm">
          <h2 className="text-xl font-extrabold mb-4" style={{ color: NAV_BG }}>Kalkylarket — din månatliga rapport</h2>
          <p className="text-slate-500 leading-relaxed mb-4">
            När du börjar som kund skickar vi dig en mall — ett Excel- eller Google Kalkylark med rätt kolumner och format. Varje månad (eller kvartal) fyller du i dina transaktioner och delar filen med oss.
          </p>
          <p className="text-slate-500 leading-relaxed">
            Det är så vi kan erbjuda ett riktigt bra pris: vi förväntar oss att datan kommer in strukturerad och komplett, precis som vi visar dig. Då kan vi bokföra snabbt och korrekt utan onödig fram-och-back.
          </p>
        </div>

        {/* Excel mockup + column info */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm">
          <h2 className="text-xl font-extrabold mb-2" style={{ color: NAV_BG }}>Så här ser mallen ut</h2>
          <p className="text-slate-400 text-sm mb-6">Klicka på en kolumn för att se vad den ska innehålla.</p>

          <ExcelMockup activeCol={activeCol} onColClick={handleColClick} />

          {/* Column descriptions */}
          <div className="mt-6 space-y-2">
            {columns.map((col, i) => (
              <button
                key={col.letter}
                onClick={() => handleColClick(i)}
                className="w-full text-left flex items-start gap-4 px-4 py-3 rounded-xl transition-all duration-150"
                style={{
                  backgroundColor: activeCol === i ? '#EFF6FF' : '#F8FAFC',
                  borderLeft: `3px solid ${activeCol === i ? '#3B82F6' : 'transparent'}`,
                }}
              >
                <span
                  className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-extrabold text-white flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: activeCol === i ? '#3B82F6' : EXCEL_GREEN }}
                >
                  {col.letter}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-0.5" style={{ color: activeCol === i ? '#1D4ED8' : NAV_BG }}>
                    {col.name}
                  </p>
                  <p className="text-sm text-slate-500 leading-relaxed">{col.desc}</p>
                  {activeCol === i && (
                    <p className="text-xs font-semibold mt-1.5" style={{ color: CORAL }}>→ {col.tip}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Why structured data = low price */}
        <div className="rounded-2xl p-8 sm:p-10" style={{ backgroundColor: NAV_BG }}>
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5" style={{ backgroundColor: `${CORAL}30` }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-2">Därför kan vi hålla priset på 299 kr/mån</h3>
              <p className="text-white/60 text-sm leading-relaxed mb-4">
                Många redovisningsbyråer tar betalt per timme delvis för att de lägger tid på att tolka röriga underlag. Hos oss är strukturen given från start — du fyller i mallen vi ger dig, och vi kan jobba effektivt. Den besparingen delar vi med dig.
              </p>
              <div className="flex items-start gap-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold mb-0.5">Inget bokföringsprogram behövs</p>
                  <p className="text-white/55 text-sm leading-relaxed">
                    Du behöver inte köpa eller lära dig något bokföringsprogram. Vi använder ett delat Excel- eller Google Kalkylark — det är gratis, du kan det redan, och det räcker gott.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intro call note */}
        <div
          className="rounded-2xl p-7 flex gap-4 items-start"
          style={{ backgroundColor: `${CORAL}10`, border: `1px solid ${CORAL}30` }}
        >
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-bold text-sm mb-1" style={{ color: CORAL }}>Vi går igenom allt i introsamtalet</p>
            <p className="text-slate-600 text-sm leading-relaxed">
              Innan du börjar skicka in transaktioner håller vi ett kort introduktionssamtal. Då visar vi dig mallen, går igenom ett par exempelrader tillsammans och svarar på alla frågor. Du behöver inte ha koll på allt på förhand.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-2 pb-6">
          <Link
            href="/flow/komplett/qualification"
            className="inline-flex items-center gap-2 px-8 py-4 font-bold rounded-xl text-white text-sm transition-all duration-200 hover:scale-[1.02]"
            style={{ backgroundColor: NAV_BG, boxShadow: `0 8px 24px ${NAV_BG}30` }}
          >
            Kom igång →
          </Link>
          <p className="text-slate-400 text-xs mt-3">Introsamtal ingår — vi hör av oss inom 24h.</p>
        </div>

      </div>
    </div>
  );
}
