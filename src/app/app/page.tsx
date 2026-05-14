'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const ACCENT = '#E95C63';
const ACCENT_LIGHT = '#FDEAEA';

export default function BokforingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [chatMessage, setChatMessage] = useState('');
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* Sidhuvud */}
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Bokföring</h1>
          <p className="text-sm text-slate-400 mt-0.5">Räkenskapsår {selectedYear}</p>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Innehåll */}
      <div className="flex gap-5 flex-1 p-6 overflow-hidden min-h-0">

        {/* Transaktionslista */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden min-w-0">

          {/* Filter-rad */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 flex-shrink-0">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Sök transaktion..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-colors"
              />
            </div>
            <select className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:outline-none cursor-pointer">
              <option>Alla månader</option>
              <option>Januari</option>
              <option>Februari</option>
              <option>Mars</option>
            </select>
            <select className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:outline-none cursor-pointer">
              <option>Alla konton</option>
            </select>
          </div>

          {/* Kolumnhuvud */}
          <div
            className="grid px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100 flex-shrink-0"
            style={{ gridTemplateColumns: '100px 1fr 110px 150px 80px 40px' }}
          >
            <span>Datum</span>
            <span>Beskrivning</span>
            <span className="text-right">Belopp</span>
            <span>Konto (BAS)</span>
            <span>Moms</span>
            <span />
          </div>

          {/* Tom vy */}
          <div className="flex-1 flex flex-col items-center justify-center py-16">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ backgroundColor: ACCENT_LIGHT }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: ACCENT }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-700 mb-1">Inga transaktioner ännu</p>
            <p className="text-sm text-slate-400 text-center max-w-xs mb-5">
              Lägg till transaktioner manuellt eller ladda upp en kontoutdragsfil
            </p>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Ladda upp fil
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-colors"
                style={{ backgroundColor: '#3a5870' }}
              >
                Lägg till manuellt
              </button>
            </div>
          </div>
        </div>

        {/* AI-chatt */}
        <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">

          <div className="px-4 py-3.5 border-b border-slate-100 flex-shrink-0" style={{ backgroundColor: '#3a5870' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">AI-assistent</p>
                <p className="text-xs text-white/60">Konteringshjälp</p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 py-4 overflow-y-auto space-y-3">
            <div className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: ACCENT }}>
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-slate-600 leading-relaxed" style={{ backgroundColor: ACCENT_LIGHT }}>
                Hej! Välj en transaktion så hjälper jag dig hitta rätt BAS-konto och momskod.
              </div>
            </div>
          </div>

          <div className="px-3 py-3 border-t border-slate-100 flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                placeholder="Skriv ett meddelande..."
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-colors"
              />
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity"
                style={{ backgroundColor: ACCENT, opacity: chatMessage.trim() ? 1 : 0.4 }}
                disabled={!chatMessage.trim()}
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
