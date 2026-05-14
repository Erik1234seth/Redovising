'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const actions = [
  {
    href: '/bokforing',
    title: 'Bokföra',
    description: 'Har du betalat något eller fått in pengar? Lägg in det här',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    href: '/rapporter/ne-bilaga',
    title: 'Se mina rapporter',
    description: 'Se en sammanställning av hur det går för ditt företag — för skatten och myndigheterna',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    href: '/fakturor',
    title: 'Skriva en faktura',
    description: 'Ska du begära betalt av en kund? Här skapar du en faktura enkelt',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    href: '/lager',
    title: 'Kolla lagret',
    description: 'Håll koll på vad du äger i företaget — produkter, maskiner och utrustning',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  {
    href: '/rapporter/moms',
    title: 'Redovisa moms',
    description: 'Se hur mycket moms du har samlat på dig — och vad du ska redovisa till Skatteverket',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: '#DB2777',
    bg: '#FDF2F8',
  },
  {
    href: '/hjalp',
    title: 'Hjälp',
    description: 'Osäker på något? Här hittar du enkla förklaringar och guider för allt',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: '#0891B2',
    bg: '#ECFEFF',
  },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'God natt';
  if (h < 10) return 'God morgon';
  if (h < 12) return 'Förmiddagen är här';
  if (h < 17) return 'God eftermiddag';
  return 'God kväll';
}

export default function HomePage() {
  const { user, loading, profile } = useAuth();
  const router = useRouter();

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

  const firstName = profile?.full_name?.split(' ')[0] ?? null;

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Topplist */}
      <div className="px-8 pt-12 pb-2">
        <p className="text-sm font-medium text-slate-400 mb-1">{getGreeting()}{firstName ? `, ${firstName}` : ''}!</p>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
          Idag vill jag&hellip;
        </h1>
        <p className="text-slate-400 text-sm mt-2">Välj vad du vill göra så tar vi dig dit.</p>
      </div>

      {/* Kort-grid */}
      <div className="px-8 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
        {actions.map(action => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex items-start gap-4 bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-md transition-all duration-150"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-105"
              style={{ backgroundColor: action.bg, color: action.color }}
            >
              {action.icon}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-[15px] leading-snug">{action.title}</p>
              <p className="text-sm text-slate-400 mt-0.5 leading-snug">{action.description}</p>
            </div>
            <svg
              className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-150"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>

      {/* Tips-banner */}
      <div className="px-8 pb-10 max-w-4xl">
        <div
          className="rounded-2xl px-6 py-4 flex items-center gap-4"
          style={{ backgroundColor: NAV_BG }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: CORAL }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Osäker på något?</p>
            <p className="text-white/55 text-xs mt-0.5">
              Vår AI-assistent finns på varje sida och hjälper dig steg för steg.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
