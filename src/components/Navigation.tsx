'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { trackEvent, slugify } from '@/lib/track';

const navLinks = [
  { href: '/', label: 'Hem' },
  { href: '/#packages', label: 'Priser' },
  { href: '/om-oss', label: 'Om oss' },
];


const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function Navigation() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const matchNavHref = () => {
    const current = pathname + (typeof window !== 'undefined' ? window.location.hash : '');
    const exact = navLinks.find(l => l.href === current);
    if (exact) return exact.href;
    const pathOnly = navLinks.find(l => l.href === pathname);
    return pathOnly ? pathOnly.href : pathname;
  };

  const [activeHref, setActiveHref] = useState(pathname);

  useEffect(() => {
    setActiveHref(matchNavHref());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const onHashChange = () => setActiveHref(matchNavHref());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isActive = (href: string) => activeHref === href;

  // Loggar att hamburgaren öppnades, och vad besökaren klickar på därefter.
  // Händelserna delar session_id och är tidsstämplade, så ordningen — och
  // därmed "öppnade menyn men klickade aldrig vidare" — går att läsa ut.
  const trackMenuOpen = () => trackEvent('nav_meny_oppnad');
  const trackNavClick = (label: string, source: 'mobil' | 'desktop') =>
    trackEvent(`nav_klick_${source}_${slugify(label)}`);

  return (
    <nav className="sticky top-0 z-50 shadow-lg" style={{ backgroundColor: NAV_BG }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
              style={{ backgroundColor: CORAL }}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[23px] leading-none tracking-tight select-none">
              <span className="text-white/60 font-medium">Enkla </span>
              <span className="text-white font-extrabold">Bokslut</span>
            </span>
          </Link>

          {/* ── Center nav (desktop) ── */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => { trackNavClick(label, 'desktop'); setActiveHref(href); }}
                className="relative text-[15px] font-medium transition-colors duration-150"
                style={{ color: isActive(href) ? '#fff' : 'rgba(255,255,255,0.72)' }}
              >
                {label}
                <span
                  className="absolute -bottom-0.5 left-0 h-[2px] rounded-full transition-all duration-200"
                  style={{ backgroundColor: CORAL, width: isActive(href) ? '100%' : '0%' }}
                />
              </Link>
            ))}

          </div>

          {/* ── Right: utility + CTA (desktop) ── */}
          <div className="hidden md:flex items-center gap-3">
            {!loading && (
              <Link
                href={user ? 'https://app.enklabokslut.se' : 'https://app.enklabokslut.se/auth/login'}
                onClick={() => trackNavClick(user ? 'Mitt konto' : 'Logga in', 'desktop')}
                className="px-5 py-[9px] text-[14px] font-semibold rounded-full border-2 transition-all duration-200 hover:scale-[1.03]"
                style={{ borderColor: 'rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.85)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#fff'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
              >
                {user ? 'Mitt konto' : 'Logga in'}
              </Link>
            )}
            <Link
              href="/kontakt"
              onClick={() => trackNavClick('Kontakta oss', 'desktop')}
              className="px-5 py-[9px] text-[14px] font-semibold text-white rounded-full transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.03]"
              style={{ backgroundColor: CORAL }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#d04a52')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = CORAL)}
            >
              Kontakta oss
            </Link>
          </div>

          {/* ── Hamburger (mobile) ── */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.8)' }}
            onClick={() => {
              if (!mobileOpen) trackMenuOpen();
              setMobileOpen(!mobileOpen);
            }}
            aria-label="Öppna meny"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 py-4 space-y-1" style={{ backgroundColor: NAV_BG }}>
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => { trackNavClick(label, 'mobil'); setActiveHref(href); setMobileOpen(false); }}
              className="block px-4 py-3 rounded-xl text-[15px] font-medium transition-colors"
              style={{
                color: isActive(href) ? '#fff' : 'rgba(255,255,255,0.75)',
                backgroundColor: isActive(href) ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              {label}
            </Link>
          ))}

          <div className="pt-3 border-t border-white/10 space-y-2">
            {!loading && (
              <Link
                href={user ? 'https://app.enklabokslut.se' : 'https://app.enklabokslut.se/auth/login'}
                onClick={() => { trackNavClick(user ? 'Mitt konto' : 'Logga in', 'mobil'); setMobileOpen(false); }}
                className="block px-4 py-3 text-[15px] font-semibold rounded-full text-center border-2"
                style={{ borderColor: 'rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.85)' }}
              >
                {user ? 'Mitt konto' : 'Logga in'}
              </Link>
            )}
            <Link
              href="/kontakt"
              onClick={() => { trackNavClick('Kontakta oss', 'mobil'); setMobileOpen(false); }}
              className="block px-4 py-3 text-[15px] font-semibold text-white rounded-full text-center"
              style={{ backgroundColor: CORAL }}
            >
              Kontakta oss
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
