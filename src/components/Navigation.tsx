'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';

const navLinks = [
  { href: '/', label: 'Hem' },
  { href: '/om-oss', label: 'Om oss' },
];

const guides = [
  {
    href: '/sa-skickar-du-in',
    label: 'Skicka in dina underlag',
    desc: 'Hur du fyller i kalkylarket och skickar in transaktioner varje månad.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
  },
  {
    href: '/tutorial',
    label: 'Steg-för-steg instruktioner',
    desc: 'Genomgång av hela processen från start till färdig NE-bilaga.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    ),
  },
  {
    href: '/ombud',
    label: 'Registrera oss som ombud',
    desc: 'Så ger du oss behörighet att lämna in din deklaration hos Skatteverket.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    ),
  },
];

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function Navigation() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [mobileGuidesOpen, setMobileGuidesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => pathname === path;
  const isGuidesActive = guides.some(g => pathname === g.href);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setGuidesOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

            {/* Guider dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setGuidesOpen(o => !o)}
                className="flex items-center gap-1.5 text-[15px] font-medium transition-colors duration-150"
                style={{ color: isGuidesActive || guidesOpen ? '#fff' : 'rgba(255,255,255,0.72)' }}
              >
                Guider
                <svg
                  className="w-3.5 h-3.5 transition-transform duration-200"
                  style={{ transform: guidesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
                <span
                  className="absolute -bottom-0.5 left-0 h-[2px] rounded-full transition-all duration-200"
                  style={{ backgroundColor: CORAL, width: isGuidesActive ? '100%' : '0%' }}
                />
              </button>

              {guidesOpen && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 rounded-2xl overflow-hidden shadow-2xl"
                  style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                >
                  <div className="p-2">
                    {guides.map((guide) => (
                      <Link
                        key={guide.href}
                        href={guide.href}
                        onClick={() => setGuidesOpen(false)}
                        className="flex gap-3 items-start p-3 rounded-xl transition-colors hover:bg-slate-50 group"
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                          style={{ backgroundColor: `${NAV_BG}10` }}
                        >
                          <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: NAV_BG }}>
                            {guide.icon}
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold mb-0.5" style={{ color: NAV_BG }}>{guide.label}</p>
                          <p className="text-xs leading-relaxed text-slate-400">{guide.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: utility + CTA (desktop) ── */}
          <div className="hidden md:flex items-center gap-5">
            <Link
              href="/valja-paket"
              className="text-[14px] font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.72)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.72)')}
            >
              Priser
            </Link>
            <Link
              href="/kontakt"
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
            onClick={() => setMobileOpen(!mobileOpen)}
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
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 rounded-xl text-[15px] font-medium transition-colors"
              style={{
                color: isActive(href) ? '#fff' : 'rgba(255,255,255,0.75)',
                backgroundColor: isActive(href) ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              {label}
            </Link>
          ))}

          {/* Guider (mobile) */}
          <button
            onClick={() => setMobileGuidesOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-[15px] font-medium transition-colors"
            style={{
              color: isGuidesActive || mobileGuidesOpen ? '#fff' : 'rgba(255,255,255,0.75)',
              backgroundColor: isGuidesActive || mobileGuidesOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
            }}
          >
            Guider
            <svg
              className="w-4 h-4 transition-transform duration-200"
              style={{ transform: mobileGuidesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {mobileGuidesOpen && (
            <div className="pl-4 space-y-1">
              {guides.map((guide) => (
                <Link
                  key={guide.href}
                  href={guide.href}
                  onClick={() => { setMobileOpen(false); setMobileGuidesOpen(false); }}
                  className="block px-4 py-2.5 rounded-xl text-[14px] transition-colors"
                  style={{ color: isActive(guide.href) ? '#fff' : 'rgba(255,255,255,0.6)' }}
                >
                  {guide.label}
                </Link>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-white/10 space-y-2">
            <Link
              href="/valja-paket"
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 text-[15px] font-medium rounded-xl transition-colors"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              Priser
            </Link>
            <Link
              href="/kontakt"
              onClick={() => setMobileOpen(false)}
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
