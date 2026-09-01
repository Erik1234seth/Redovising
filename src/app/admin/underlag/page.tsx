'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { AdminUnderlag } from '@/lib/admin-types';
import { relativeTime, fullDate } from '../_pipeline';

/**
 * Underlagen kunderna laddat upp, i väntan på genomgång.
 *
 * Uppladdningen tolkar inte längre filen — kunden får kvitto på att den kommit
 * fram och beskedet att bokföringen dyker upp senare. Det löftet infrias här,
 * så ordningen är nyast först och de som ingen tittat på ligger överst i sin
 * egen grupp.
 *
 * Nedladdningslänken är signerad och skapas om varje gång sidan hämtas. Den
 * lever en timme, så en flik som stått öppen sedan i går behöver laddas om
 * innan filen går att öppna.
 */

const STATUS_LABELS: Record<string, string> = {
  inkommet: 'Inkommet',
  granskas: 'Granskas',
  bokfort: 'Bokfört',
};

const STATUS_STYLES: Record<string, string> = {
  inkommet: 'bg-gold-500/15 text-gold-400 border-gold-500/30',
  granskas: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  bokfort: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

const NEXT_STATUS: Record<string, { to: string; label: string; primary?: boolean }[]> = {
  inkommet: [{ to: 'granskas', label: 'Börja granska', primary: true }],
  granskas: [{ to: 'bokfort', label: 'Klarmarkera', primary: true }, { to: 'inkommet', label: 'Lägg tillbaka' }],
  bokfort: [{ to: 'granskas', label: 'Öppna igen' }],
};

function fileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UnderlagPage() {
  const [underlag, setUnderlag] = useState<AdminUnderlag[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/underlag')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setUnderlag(data.underlag ?? []);
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta underlagen'); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      const res = await fetch('/api/admin/underlag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || 'Det gick inte att ändra status');
      else setUnderlag((list) => list.map((u) => (u.id === id ? { ...u, status } : u)));
    } catch {
      setError('Det gick inte att nå servern');
    }
    setBusy(null);
  };

  if (loading) return <div className="text-center py-20 text-warm-400">Laddar...</div>;

  const waiting = underlag.filter((u) => u.status !== 'bokfort');
  const done = underlag.filter((u) => u.status === 'bokfort');
  const visible = showDone ? done : waiting;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Inkomna underlag</h1>
        <p className="text-warm-400 text-sm mt-1.5">
          Filerna kunderna laddat upp i bokföringsfliken. De har fått besked om att vi går
          igenom dem, så bokföringen behöver läggas in innan de ser något.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDone(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            showDone ? 'text-warm-500 hover:text-warm-300' : 'bg-navy-700 text-white border border-navy-600'
          }`}
        >
          Att göra ({waiting.length})
        </button>
        <button
          onClick={() => setShowDone(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            showDone ? 'bg-navy-700 text-white border border-navy-600' : 'text-warm-500 hover:text-warm-300'
          }`}
        >
          Bokförda ({done.length})
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl text-center py-16">
          <p className="text-warm-300">{showDone ? 'Inget är bokfört än' : 'Inga underlag väntar'}</p>
          <p className="text-warm-600 text-xs mt-1.5">
            {showDone
              ? 'Underlag du klarmarkerar hamnar här.'
              : 'Nästa gång någon laddar upp ett underlag dyker det upp här.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((u) => (
            <div key={u.id} className="bg-navy-700/50 border border-navy-600 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${STATUS_STYLES[u.status] ?? STATUS_STYLES.inkommet}`}>
                      {STATUS_LABELS[u.status] ?? u.status}
                    </span>
                    <p className="text-white font-semibold truncate">{u.fileName}</p>
                    {u.fileSize !== null && (
                      <span className="text-warm-600 text-xs">{fileSize(u.fileSize)}</span>
                    )}
                  </div>

                  <p className="text-warm-400 text-sm mt-1.5">
                    {u.personKey ? (
                      <Link
                        href={`/admin/person/${encodeURIComponent(u.personKey)}`}
                        className="hover:text-gold-500 transition"
                      >
                        {u.personName || u.personEmail}
                      </Link>
                    ) : (
                      <span className="text-warm-600">Okänd avsändare</span>
                    )}
                    {u.company && <span className="text-warm-600"> · {u.company}</span>}
                  </p>

                  <p className="text-warm-600 text-xs mt-1" title={fullDate(u.at)}>
                    {relativeTime(u.at)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {u.url ? (
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white rounded-xl text-sm font-medium transition"
                    >
                      Öppna filen
                    </a>
                  ) : (
                    <span className="text-red-400 text-xs">Filen saknas i lagringen</span>
                  )}

                  {(NEXT_STATUS[u.status] ?? []).map((step) => (
                    <button
                      key={step.to}
                      onClick={() => setStatus(u.id, step.to)}
                      disabled={busy === u.id}
                      className={`px-4 py-2 rounded-xl text-sm transition disabled:opacity-50 ${
                        step.primary
                          ? 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold'
                          : 'text-warm-500 hover:text-warm-300 font-medium'
                      }`}
                    >
                      {step.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
