'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';
const ACCENT = '#2563EB';

function getInitials(fullName: string | null | undefined, email: string) {
  if (fullName) {
    const parts = fullName.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return email[0].toUpperCase();
}

const rapporterChildren = [
  { label: 'NE-bilaga', href: '/rapporter/ne-bilaga' },
  { label: 'Momsrapport', href: '/rapporter/moms' },
  { label: 'Preliminär skatt', href: '/rapporter/preliminar-skatt' },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [rapporterOpen, setRapporterOpen] = useState(
    rapporterChildren.some(c => pathname === c.href)
  );

  const isActive = (href: string) => pathname === href;
  const isRapporterActive = rapporterChildren.some(c => pathname === c.href);

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };

  const navItemBase = 'flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 text-sm font-medium transition-all duration-150 cursor-pointer';
  const navItemActive = 'bg-white/10 text-white';
  const navItemInactive = 'text-white/55 hover:text-white/85 hover:bg-white/5';

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 overflow-x-hidden"
      style={{ width: '240px', backgroundColor: NAV_BG }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 flex-shrink-0 border-b" style={{ borderBottomColor: 'rgba(255,255,255,0.07)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CORAL }}>
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-[15px] leading-none tracking-tight select-none">
          <span className="text-white/55 font-medium">Enkla </span>
          <span className="text-white font-extrabold">Bokslut</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">

        {/* Bokföring */}
        <Link
          href="/"
          className={`${navItemBase} ${isActive('/') ? navItemActive : navItemInactive}`}
        >
          <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
          Bokföring
        </Link>

        {/* Rapporter */}
        <div>
          <button
            onClick={() => setRapporterOpen(o => !o)}
            className={`w-full ${navItemBase} justify-between ${isRapporterActive ? navItemActive : navItemInactive}`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Rapporter
            </div>
            <svg
              className="w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0"
              style={{ transform: rapporterOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {rapporterOpen && (
            <div className="mt-0.5 space-y-0.5">
              {rapporterChildren.map(child => (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`flex items-center gap-2 pl-11 pr-4 py-2 mx-2 rounded-lg text-sm transition-all duration-150 ${
                    isActive(child.href)
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                  {child.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Lager & Tillgångar */}
        <Link
          href="/lager"
          className={`${navItemBase} ${isActive('/lager') ? navItemActive : navItemInactive}`}
        >
          <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Lager & Tillgångar
        </Link>

        {/* Fakturor */}
        <Link
          href="/fakturor"
          className={`${navItemBase} ${isActive('/fakturor') ? navItemActive : navItemInactive}`}
        >
          <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Fakturor
        </Link>
      </nav>

      {/* Användare */}
      <div className="flex-shrink-0 px-3 py-4 border-t" style={{ borderTopColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3 px-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: CORAL }}
          >
            {getInitials(profile?.full_name, user?.email ?? '?')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate leading-tight">
              {profile?.full_name ?? user?.email?.split('@')[0]}
            </p>
            <p className="text-white/40 text-xs truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Logga ut"
            className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
