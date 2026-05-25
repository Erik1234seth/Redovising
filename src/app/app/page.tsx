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
    href: '/rapporter',
    title: 'Rapporter & Bokslut',
    description: 'Sammanställning av ditt företag för skatten och myndigheterna.',
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
    title: 'Skapa faktura',
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
    href: '/kunder-produkter',
    title: 'Kunder & produkter',
    description: 'Hantera dina kunder och produkter på ett ställe.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
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

function getDateString() {
  return new Date().toLocaleDateString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export default function HomePage() {
  const { user, loading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/auth/login'); return; }
    if (profile && !profile.onboarding_done) router.push('/onboarding');
  }, [user, loading, profile, router]);

  if (loading || !user || (profile && !profile.onboarding_done)) {
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
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3">{getDateString()}</p>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
          {getGreeting()}{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-slate-400 text-sm mt-1.5">Vad vill du göra idag?</p>
      </div>

      {/* Kort-grid */}
      <div className="px-8 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 max-w-4xl lg:max-w-5xl">
        {actions.map(action => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex lg:flex-col items-center lg:items-start gap-4 bg-white rounded-2xl border border-slate-200 p-5 lg:p-7 hover:border-slate-300 hover:shadow-lg transition-all duration-150"
          >
            <div
              className="w-11 h-11 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: action.bg, color: action.color }}
            >
              {action.icon}
            </div>
            <div className="min-w-0 flex-1 lg:flex-none">
              <p className="font-bold text-slate-800 text-[15px] lg:text-[17px] leading-snug lg:mt-4">{action.title}</p>
              <p className="text-xs lg:text-sm text-slate-400 mt-0.5 leading-snug line-clamp-2">{action.description}</p>
            </div>
            <svg
              className="w-4 h-4 text-slate-300 flex-shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150 lg:hidden"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>

    </div>
  );
}
