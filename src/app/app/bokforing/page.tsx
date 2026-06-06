'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

interface Transaktion {
  id: string;
  datum: string;
  beskrivning: string;
  belopp: number;
  moms: number;
  haendelse_typ: string;
  ai_kategori: string | null;
  ai_debit_konto: string | null;
  ai_kredit_konto: string | null;
}

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const eventTypes = [
  {
    id: 'kund-betalat',
    label: 'Jag fick betalt av en kund',
    description: 'En kund har betalat för en tjänst eller vara',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    id: 'kopt-nagot',
    label: 'Jag köpte något till företaget',
    description: 'Verktyg, material, prenumeration eller annat du betalat för',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    id: 'privata-pengar',
    label: 'Privata pengar in eller ut',
    description: 'Du satte in egna pengar i företaget, eller tog ut för privat bruk',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  {
    id: 'ladda-upp',
    label: 'Ladda upp transaktionslista',
    description: 'Din egen eller från exempelvis Zettle, PayPal, Stripe eller din bank.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    color: '#0891B2',
    bg: '#ECFEFF',
  },
  {
    id: 'skatt-moms',
    label: 'Jag betalade skatt eller moms',
    description: 'Du betalade in skatt eller moms till Skatteverket',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
    color: '#DB2777',
    bg: '#FDF2F8',
  },
  {
    id: 'lan-bidrag',
    label: 'Övrigt',
    description: 'Något som inte passar in i de andra kategorierna',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: '#0891B2',
    bg: '#ECFEFF',
  },
];

export default function BokforingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const [transaktioner, setTransaktioner] = useState<Transaktion[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  // AI-chatt — dold tills vidare
  const [chatMessage, setChatMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('bokforing_transaktioner')
      .select('id, datum, beskrivning, belopp, moms, haendelse_typ, ai_kategori, ai_debit_konto, ai_kredit_konto')
      .eq('user_id', user.id)
      .gte('datum', `${selectedYear}-01-01`)
      .lte('datum', `${selectedYear}-12-31`)
      .order('datum', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTransaktioner(data ?? []);
        setLoadingData(false);
      });
  }, [user, selectedYear]);

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Rubrik */}
      <div className="px-8 pt-12 pb-2">
        <p className="text-sm font-medium text-slate-400 mb-1">Bokföring</p>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Vad har hänt?</h1>
        <p className="text-slate-400 text-sm mt-2">Välj det som stämmer bäst — vi sköter resten.</p>
      </div>

      {/* 6 alternativ */}
      <div className="px-8 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
        {eventTypes.map(ev => {
          const cardContent = (
            <>
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-105"
                style={{ backgroundColor: ev.bg, color: ev.color }}
              >
                {ev.icon}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-[15px] leading-snug">{ev.label}</p>
                <p className="text-sm text-slate-400 mt-0.5 leading-snug">{ev.description}</p>
              </div>
              <svg className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          );

          const hrefs: Record<string, string> = {
            'kund-betalat': '/bokforing/kund-betalat',
            'kopt-nagot': '/bokforing/kopt-nagot',
            'privata-pengar': '/bokforing/privat-pengar',
            'ladda-upp': '/bokforing/ladda-upp',
            'skatt-moms': '/bokforing/skatteverket',
            'lan-bidrag': '/bokforing/ovrigt',
          };

          const href = hrefs[ev.id];
          if (href) {
            return (
              <Link
                key={ev.id}
                href={href}
                className="group flex items-start gap-4 text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-md transition-all duration-150"
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <button
              key={ev.id}
              className="group flex items-start gap-4 text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-md transition-all duration-150"
            >
              {cardContent}
            </button>
          );
        })}
      </div>

      {/* Transaktionstabell */}
      <div className="px-8 pb-12 max-w-4xl w-full">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bokförda händelser</p>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer hover:bg-slate-50 transition-colors"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loadingData ? (
            <div className="flex items-center justify-center py-14">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
            </div>
          ) : transaktioner.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-8 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F1F5F9' }}>
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="font-semibold text-slate-600 mb-1">Inget bokfört för {selectedYear} ännu</p>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                När du väljer ett alternativ ovan och fyller i uppgifterna dyker det upp här.
              </p>
            </div>
          ) : (
            <>
              <div className="grid px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100" style={{ gridTemplateColumns: '110px 1fr 120px' }}>
                <span>Datum</span>
                <span>Beskrivning</span>
                <span className="text-right">Belopp</span>
              </div>
              {transaktioner.map(t => (
                <div key={t.id} className="grid px-5 py-4 text-sm border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors items-center" style={{ gridTemplateColumns: '110px 1fr 120px' }}>
                  <span className="text-slate-400">{new Date(t.datum).toLocaleDateString('sv-SE')}</span>
                  <span className="text-slate-700 truncate pr-4">{t.beskrivning}</span>
                  {(() => {
                    const utgift = ['kopt-nagot', 'skatteverket'].includes(t.haendelse_typ);
                    return (
                      <span className={`text-right font-medium ${utgift ? 'text-red-500' : 'text-emerald-600'}`}>
                        {utgift ? '−' : '+'}{Number(t.belopp).toLocaleString('sv-SE')} kr
                      </span>
                    );
                  })()}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* AI-chatt — dold tills vidare, aktiveras senare */}
      {false && <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100 flex-shrink-0" style={{ backgroundColor: NAV_BG }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Assistent</p>
              <p className="text-xs text-white/60">Här för att hjälpa dig</p>
            </div>
          </div>
        </div>
        <div className="flex-1 px-4 py-4 overflow-y-auto space-y-3">
          <div className="flex gap-2 items-start">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: CORAL }}>
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-slate-600 leading-relaxed" style={{ backgroundColor: '#FDEAEA' }}>
              Hej! Välj ett alternativ ovan så hjälper jag dig bokföra rätt.
            </div>
          </div>
        </div>
        <div className="px-3 py-3 border-t border-slate-100 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              placeholder="Skriv en fråga..."
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-colors"
            />
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity"
              style={{ backgroundColor: CORAL, opacity: chatMessage.trim() ? 1 : 0.4 }}
              disabled={!chatMessage.trim()}
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}
