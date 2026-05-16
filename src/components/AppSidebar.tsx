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

const ovrigtChildren = [
  { label: 'Hjälp', href: '/hjalp' },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [rapporterOpen, setRapporterOpen] = useState(
    rapporterChildren.some(c => pathname === c.href)
  );
  const [ovrigtOpen, setOvrigtOpen] = useState(
    ovrigtChildren.some(c => pathname === c.href)
  );

  const isActive = (href: string) => pathname === href;
  const isRapporterActive = rapporterChildren.some(c => pathname === c.href);
  const isOvrigtActive = ovrigtChildren.some(c => pathname === c.href);

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

        {/* Hem */}
        <Link
          href="/"
          className={`${navItemBase} ${isActive('/') ? navItemActive : navItemInactive}`}
        >
          <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Hem
        </Link>

        {/* Bokföring */}
        <Link
          href="/bokforing"
          className={`${navItemBase} ${isActive('/bokforing') ? navItemActive : navItemInactive}`}
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

        {/* Kunder & produkter */}
        <Link
          href="/kunder-produkter"
          className={`${navItemBase} ${pathname.startsWith('/kunder-produkter') ? navItemActive : navItemInactive}`}
        >
          <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          Kunder & produkter
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

        {/* Övrigt */}
        <div>
          <button
            onClick={() => setOvrigtOpen(o => !o)}
            className={`w-full ${navItemBase} justify-between ${isOvrigtActive ? navItemActive : navItemInactive}`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              Övrigt
            </div>
            <svg
              className="w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0"
              style={{ transform: ovrigtOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {ovrigtOpen && (
            <div className="mt-0.5 space-y-0.5">
              {ovrigtChildren.map(child => (
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
      </nav>

      {/* Användare */}
      <div className="flex-shrink-0 px-3 py-4 border-t" style={{ borderTopColor: 'rgba(255,255,255,0.07)' }}>
        <Link
          href="/konto"
          className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
        >
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
          <svg className="w-4 h-4 text-white/30 group-hover:text-white/60 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}
