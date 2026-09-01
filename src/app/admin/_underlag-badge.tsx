'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Länken till inkomna underlag, med antalet bredvid.
 *
 * Samma tanke som SMS-utkasten: siffran är det enda som säger att någon väntar.
 * Kunden har fått besked om att vi går igenom filen, och tills någon gör det
 * står löftet oinfriat — så räknaren visar bara det som ingen tagit i än.
 */

const POLL_MS = 60_000;

export default function UnderlagBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = () => {
      fetch('/api/admin/underlag')
        .then((r) => r.json())
        .then((data) => setCount(data.count ?? 0))
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
      href="/admin/underlag"
      className={`text-sm hover:text-gold-500 transition flex items-center gap-1.5 ${
        count > 0 ? 'text-gold-400' : 'text-warm-400'
      }`}
    >
      Underlag
      {count > 0 && (
        <span className="bg-gold-500 text-navy-900 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
          {count}
        </span>
      )}
    </Link>
  );
}
