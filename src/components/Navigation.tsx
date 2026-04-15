'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

const navLinks = [
  { href: '/', label: 'Hem' },
  { href: '/artiklar', label: 'Artiklar' },
  { href: '/om-oss', label: 'Om oss' },
];

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function Navigation() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-50 shadow-lg" style={{ backgroundColor: NAV_BG }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            {/* Icon */}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
              style={{ backgroundColor: CORAL }}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {/* Wordmark */}
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
                className="relative text-[15px] font-medium transition-colors duration-150 group/link"
                style={{ color: isActive(href) ? '#fff' : 'rgba(255,255,255,0.72)' }}
              >
                {label}
                <span
                  className="absolute -bottom-0.5 left-0 h-[2px] rounded-full transition-all duration-200"
                  style={{
                    backgroundColor: CORAL,
                    width: isActive(href) ? '100%' : '0%',
                  }}
                />
              </Link>
            ))}
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

      {/* ── Mobile dropdown ── */}
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
