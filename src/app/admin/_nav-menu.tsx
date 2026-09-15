'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Dropdownen med SMS-utkast, underlag, möten och systemstatus.
 *
 * Siffrorna var hela poängen med de gamla länkarna i menyraden, så de får inte
 * försvinna in bakom ett klick: knappen visar summan av allt som väntar, och
 * varje rad i menyn sin egen siffra. Därför hämtas räknarna här och inte i
 * varsin komponent — knappen behöver dem alla på en gång.
 */

const POLL_MS = 60_000;

type CountKey = 'sms' | 'underlag' | 'moten';

const ITEMS: { href: string; label: string; count?: CountKey }[] = [
  { href: '/admin/sms', label: 'SMS-utkast', count: 'sms' },
  { href: '/admin/underlag', label: 'Underlag', count: 'underlag' },
  { href: '/admin/moten', label: 'Möten', count: 'moten' },
  { href: '/admin/status', label: 'Systemstatus' },
];

/** Var siffran ligger i respektive svar. Möten räknar bara dagens samtal. */
const SOURCES: { key: CountKey; url: string; field: string }[] = [
  { key: 'sms', url: '/api/admin/sms-drafts', field: 'count' },
  { key: 'underlag', url: '/api/admin/underlag', field: 'count' },
  { key: 'moten', url: '/api/admin/moten', field: 'today' },
];

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<CountKey, number>>({ sms: 0, underlag: 0, moten: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const load = () => {
      for (const { key, url, field } of SOURCES) {
        fetch(url)
          .then((r) => r.json())
          .then((data) => setCounts((c) => ({ ...c, [key]: data[field] ?? 0 })))
          .catch(() => { /* räknaren får aldrig vara det som kraschar panelen */ });
      }
    };

    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, []);

  // Stäng när man klickar utanför, trycker Escape eller byter sida
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  const total = counts.sms + counts.underlag + counts.moten;
  const active = ITEMS.some((i) => pathname?.startsWith(i.href));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`text-sm hover:text-gold-500 transition flex items-center gap-1.5 ${
          total > 0 || active ? 'text-gold-400' : 'text-warm-400'
        }`}
      >
        Meny
        {total > 0 && (
          <span className="bg-gold-500 text-navy-900 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {total}
          </span>
        )}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-52 bg-navy-800 border border-navy-600 rounded-xl shadow-xl py-1.5 z-50"
        >
          {ITEMS.map((item) => {
            const n = item.count ? counts[item.count] : 0;
            const current = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={`flex items-center justify-between gap-3 px-3.5 py-2 text-sm transition hover:bg-navy-700 ${
                  current ? 'text-white font-medium' : n > 0 ? 'text-gold-400' : 'text-warm-300 hover:text-white'
                }`}
              >
                {item.label}
                {n > 0 && (
                  <span className="bg-gold-500 text-navy-900 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                    {n}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
