'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Länken till SMS-utkasten, med antalet bredvid.
 *
 * Siffran är hela poängen. Sedan AI-svaren blev utkast står någon och väntar på
 * svar så länge ett utkast ligger kvar, och den enda anledningen att öppna
 * sidan är att veta att det finns något där. Därför en egen räknare istället
 * för en rad till i notisklockan — klockan visar vad som hänt, den här visar
 * vad som återstår.
 *
 * Guldfärg när det finns något, dämpad text när det är tomt.
 */

const POLL_MS = 60_000;

export default function DraftBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = () => {
      fetch('/api/admin/sms-drafts')
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
      href="/admin/sms"
      className={`text-sm hover:text-gold-500 transition flex items-center gap-1.5 ${
        count > 0 ? 'text-gold-400' : 'text-warm-400'
      }`}
    >
      SMS-utkast
      {count > 0 && (
        <span className="bg-gold-500 text-navy-900 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
          {count}
        </span>
      )}
    </Link>
  );
}
