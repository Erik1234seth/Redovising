'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Länken till bokade tider, med dagens samtal som siffra.
 *
 * Räknar bara det som är kvar i dag, inte allt som är bokat framåt: siffran ska
 * betyda "det här ska du göra i dag", precis som utkasten och underlagen.
 */

const POLL_MS = 60_000;

export default function MotenBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = () => {
      fetch('/api/admin/moten')
        .then((r) => r.json())
        .then((data) => setCount(data.today ?? 0))
        .catch(() => { /* räknaren får aldrig vara det som kraschar panelen */ });
    };

    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, []);

  return (
    <Link
      href="/admin/moten"
      className={`text-sm hover:text-gold-500 transition flex items-center gap-1.5 ${
        count > 0 ? 'text-gold-400' : 'text-warm-400'
      }`}
    >
      Möten
      {count > 0 && (
        <span className="bg-gold-500 text-navy-900 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
          {count}
        </span>
      )}
    </Link>
  );
}
