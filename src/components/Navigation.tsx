'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-navy-900/95 backdrop-blur-md border-b border-navy-700 sticky top-0 z-50 shadow-lg shadow-navy-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link href="/" className="flex items-center group">
              <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600 group-hover:from-gold-300 group-hover:to-gold-500 transition-all duration-300">
                Enkla bokslut
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-1">
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
              className={`ml-2 px-6 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                isActive('/kontakt')
                  ? 'bg-gradient-to-r from-gold-600 to-gold-700 text-navy-900 shadow-lg shadow-gold-500/20'
                  : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40'
              }`}
            >
              Kontakt
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
