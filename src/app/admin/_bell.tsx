'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { AdminNotice } from '@/lib/admin-types';
import { relativeTime } from './_pipeline';

/**
 * Notisklockan uppe i hörnet.
 *
 * Siffran räknar bara det som hänt sedan förra gången panelen var öppen, och
 * "förra gången" ligger i localStorage — servern har ingen aning om vad Erik
 * hunnit titta på, och behöver inte ha det. Byter han webbläsare får han se
 * veckan en gång till, vilket är ett billigare pris än en läst-tabell.
 *
 * Röd prick så fort något misslyckats bland de olästa. Ett utskick som inte
 * gick fram är det enda i panelen som kräver handling, så det ska synas utan
 * att man öppnar något.
 */

const SEEN_KEY = 'admin_notiser_sedda';
const POLL_MS = 60_000;

const DOT: Record<AdminNotice['level'], string> = {
  ok: 'bg-green-400',
  fail: 'bg-red-400',
  info: 'bg-blue-400',
};

export default function NotificationBell() {
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<string>('');
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch('/api/admin/notifications')
      .then((r) => r.json())
      .then((data) => setNotices(data.notices ?? []))
      .catch(() => { /* klockan får aldrig vara det som kraschar panelen */ });
  }, []);

  useEffect(() => {
    setSeenAt(localStorage.getItem(SEEN_KEY) ?? '');
    load();

    const timer = setInterval(load, POLL_MS);
    // Kommer man tillbaka till fliken vill man se läget nu, inte om en minut
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);

  // Klick utanför stänger. Utan det ligger panelen kvar över listan.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Tidpunkter jämförs som tid, aldrig som text: `+00:00` och `Z` är samma
  // ögonblick men sorterar olika som strängar.
  const seenMs = seenAt ? new Date(seenAt).getTime() : 0;
  const unseen = notices.filter((n) => new Date(n.at).getTime() > seenMs);
  const hasFailure = unseen.some((n) => n.level === 'fail');

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && notices.length) {
      // Nyaste notisens tidpunkt, inte klockan nu: allt äldre är läst, och
      // något som landar i samma sekund ska inte tystas av att panelen öppnades.
      const newest = notices[0].at;
      localStorage.setItem(SEEN_KEY, newest);
      setSeenAt(newest);
    }
  };

  return (
    <div className="relative" ref={panel}>
      <button
        onClick={toggle}
        aria-label={unseen.length ? `${unseen.length} nya notiser` : 'Notiser'}
        className="relative p-2 text-warm-400 hover:text-white transition"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
        </svg>
        {unseen.length > 0 && (
          <span className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold grid place-items-center ${
            hasFailure ? 'bg-red-500 text-white' : 'bg-gold-500 text-navy-900'
          }`}>
            {unseen.length > 9 ? '9+' : unseen.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-navy-900 border border-navy-600 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700">
            <p className="text-xs font-semibold text-warm-400 uppercase tracking-widest">Senaste händelserna</p>
            <Link
              href="/admin/status"
              onClick={() => setOpen(false)}
              className="text-[11px] text-gold-500 hover:text-gold-400 transition"
            >
              Systemstatus
            </Link>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {notices.length === 0 && (
              <p className="px-4 py-6 text-sm text-warm-500 text-center">Inget har hänt den senaste veckan.</p>
            )}

            {notices.map((n) => {
              const row = (
                <div className="flex items-start gap-3 px-4 py-3 hover:bg-navy-800 transition">
                  <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${DOT[n.level]}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm break-words ${n.level === 'fail' ? 'text-red-400' : 'text-white'}`}>
                      {n.title}
                    </p>
                    {n.detail && <p className="text-xs text-warm-500 mt-0.5 break-words">{n.detail}</p>}
                    <p className="text-[11px] text-warm-600 mt-1">{relativeTime(n.at)}</p>
                  </div>
                </div>
              );

              return (
                <div key={n.id} className="border-b border-navy-800 last:border-0">
                  {n.personKey ? (
                    <Link href={`/admin/person/${encodeURIComponent(n.personKey)}`} onClick={() => setOpen(false)}>
                      {row}
                    </Link>
                  ) : row}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
