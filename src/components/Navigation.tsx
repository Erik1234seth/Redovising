'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export default function Navigation() {
  const pathname = usePathname();
  const { user, profile, signOut, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-navy-900/95 backdrop-blur-md border-b border-navy-700 sticky top-0 z-50 shadow-lg shadow-navy-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link href="/" className="flex items-center group">
              <span className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600 group-hover:from-gold-300 group-hover:to-gold-500 transition-all duration-300">
                Enkla bokslut
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <Link
              href="/"
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                isActive('/')
                  ? 'bg-gold-500/10 text-gold-500'
                  : 'text-warm-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Hem
            </Link>
            <Link
              href="/tutorial"
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                isActive('/tutorial')
                  ? 'bg-gold-500/10 text-gold-500'
                  : 'text-warm-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Guider
            </Link>
            <Link
              href="/viktigt"
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                isActive('/viktigt')
                  ? 'bg-gold-500/10 text-gold-500'
                  : 'text-warm-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Viktigt
            </Link>
            <Link
              href="/om-oss"
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                isActive('/om-oss')
                  ? 'bg-gold-500/10 text-gold-500'
                  : 'text-warm-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Om oss
            </Link>
            <Link
              href="/kontakt"
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                isActive('/kontakt')
                  ? 'bg-gold-500/10 text-gold-500'
                  : 'text-warm-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Kontakt
            </Link>


            {!loading && (
              <>
                {user ? (
                  <Link
                    href="/account"
                    className={`ml-4 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      isActive('/account')
                        ? 'bg-gold-500/10 text-gold-500'
                        : 'text-warm-300 hover:text-white hover:bg-navy-800'
                    }`}
                  >
                    Min profil
                  </Link>
                ) : (
                  <div className="flex items-center space-x-2 ml-4">
                    <Link
                      href="/auth/login"
                      className="px-4 py-2 text-sm font-semibold text-warm-300 hover:text-white hover:bg-navy-800 rounded-lg transition-all duration-200"
                    >
                      Logga in
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="px-6 py-2 text-sm font-bold bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-lg shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 transition-all duration-200"
                    >
                      Skapa konto
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-warm-300 hover:text-white hover:bg-navy-800 transition-all duration-200"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-navy-900/98 backdrop-blur-md border-t border-navy-700">
          <div className="px-4 py-4 space-y-2">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                isActive('/')
                  ? 'bg-gold-500/10 text-gold-500'
                  : 'text-warm-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Hem
            </Link>
            <Link
              href="/tutorial"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                isActive('/tutorial')
                  ? 'bg-gold-500/10 text-gold-500'
                  : 'text-warm-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Guider
            </Link>
            <Link
              href="/viktigt"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                isActive('/viktigt')
                  ? 'bg-gold-500/10 text-gold-500'
                  : 'text-warm-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Viktigt
            </Link>
            <Link
              href="/om-oss"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                isActive('/om-oss')
                  ? 'bg-gold-500/10 text-gold-500'
                  : 'text-warm-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Om oss
            </Link>
            <Link
              href="/kontakt"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                isActive('/kontakt')
                  ? 'bg-gold-500/10 text-gold-500'
                  : 'text-warm-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Kontakt
            </Link>


            {!loading && (
              <>
                {user ? (
                  <Link
                    href="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                      isActive('/account')
                        ? 'bg-gold-500/10 text-gold-500'
                        : 'text-warm-300 hover:text-white hover:bg-navy-800'
                    }`}
                  >
                    Min profil
                  </Link>
                ) : (
                  <div className="space-y-2 pt-2">
                    <Link
                      href="/auth/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 text-base font-semibold text-warm-300 hover:text-white hover:bg-navy-800 rounded-lg transition-all duration-200"
                    >
                      Logga in
                    </Link>
                    <Link
                      href="/auth/signup"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 text-base font-bold bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-lg shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 transition-all duration-200 text-center"
                    >
                      Skapa konto
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
