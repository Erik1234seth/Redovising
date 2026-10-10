'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { AdminUnderlag } from '@/lib/admin-types';
import { relativeTime, fullDate } from '../_pipeline';
import { isSieFile } from '@/lib/sie/parse';
import { Varningar } from '../_varningar';

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
  inkommet: 'bg-blue-50 text-blue-700 border-blue-200',
  granskas: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  bokfort: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
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
  // Radera kräver två klick: första visar "Säker?", andra raderar på riktigt
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  const remove = async (id: string) => {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      const res = await fetch('/api/admin/underlag', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || 'Det gick inte att radera underlaget');
      else setUnderlag((list) => list.filter((u) => u.id !== id));
    } catch {
      setError('Det gick inte att nå servern');
    }
    setConfirmDelete(null);
    setBusy(null);
  };

  if (loading) return <div className="text-center py-20 text-slate-600">Laddar...</div>;

  const waiting = underlag.filter((u) => u.status !== 'bokfort');
  const done = underlag.filter((u) => u.status === 'bokfort');
  const visible = showDone ? done : waiting;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inkomna underlag</h1>
        <p className="text-slate-600 text-sm mt-1.5">
          Filerna kunderna laddat upp i bokföringsfliken eller mejlat in som bilagor. Bokföringen
          behöver läggas in innan de ser något.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDone(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            showDone ? 'text-slate-500 hover:text-slate-700' : 'bg-slate-50 text-slate-900 border border-slate-200'
          }`}
        >
          Att göra ({waiting.length})
        </button>
        <button
          onClick={() => setShowDone(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            showDone ? 'bg-slate-50 text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Bokförda ({done.length})
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl text-center py-16">
          <p className="text-slate-700">{showDone ? 'Inget är bokfört än' : 'Inga underlag väntar'}</p>
          <p className="text-slate-400 text-xs mt-1.5">
            {showDone
              ? 'Underlag du klarmarkerar hamnar här.'
              : 'Nästa gång någon laddar upp ett underlag dyker det upp här.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((u) => (
            <div key={u.id} className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${STATUS_STYLES[u.status] ?? STATUS_STYLES.inkommet}`}>
                      {STATUS_LABELS[u.status] ?? u.status}
                    </span>
                    <p className="text-slate-900 font-semibold truncate">{u.fileName}</p>
                    {u.fileSize !== null && (
                      <span className="text-slate-400 text-xs">{fileSize(u.fileSize)}</span>
                    )}
                    {u.source === 'mejl' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-blue-500/10 text-blue-700 border-blue-500/30">
                        ✉ via mejl
                      </span>
                    )}
                    {u.source === 'admin' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                        👤 uppladdat av oss
                      </span>
                    )}
                    {u.verifikationer && (
                      <span
                        title={u.verifikationer.fel ?? undefined}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          u.verifikationer.fel && !u.verifikationer.inlagda
                            ? 'bg-red-500/10 text-red-600 border-red-500/30'
                            : u.verifikationer.fel
                            ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                        }`}
                      >
                        {u.verifikationer.fel && !u.verifikationer.inlagda
                          ? '⚠ verifikationerna kunde inte läggas in'
                          : `${u.verifikationer.fel ? '⚠' : '✓'} ${u.verifikationer.inlagda} verifikationer inlagda${u.verifikationer.fel ? ' · alla gick inte ihop' : ''}`}
                      </span>
                    )}
                  </div>

                  <p className="text-slate-600 text-sm mt-1.5">
                    {u.personKey ? (
                      <Link
                        href={`/admin/person/${encodeURIComponent(u.personKey)}`}
                        className="hover:text-blue-700 transition"
                      >
                        {u.personName || u.personEmail}
                      </Link>
                    ) : (
                      <span className="text-slate-400">Okänd avsändare</span>
                    )}
                    {u.company && <span className="text-slate-400"> · {u.company}</span>}
                  </p>

                  <p className="text-slate-400 text-xs mt-1" title={fullDate(u.at)}>
                    {relativeTime(u.at)}
                  </p>
                  <Varningar
                    className="mt-1"
                    varningar={[
                      ...(u.verifikationer?.fel ? [u.verifikationer.fel] : []),
                      ...u.varningar,
                    ]}
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* SIE tolkas med kod, så verifikationerna går att läsa direkt */}
                  {isSieFile(u.fileName) && (
                    <Link
                      href={`/admin/underlag/${u.id}`}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-sm font-medium transition"
                    >
                      Verifikationer
                    </Link>
                  )}
                  {u.url ? (
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 rounded-xl text-sm font-medium transition"
                    >
                      Öppna filen
                    </a>
                  ) : null}
                  {u.url ? (
                    <a
                      href={`/api/admin/underlag/${u.id}/ladda-ner`}
                      className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 rounded-xl text-sm font-medium transition"
                    >
                      Ladda ner
                    </a>
                  ) : (
                    <span className="text-red-600 text-xs">Filen saknas i lagringen</span>
                  )}

                  {(NEXT_STATUS[u.status] ?? []).map((step) => (
                    <button
                      key={step.to}
                      onClick={() => setStatus(u.id, step.to)}
                      disabled={busy === u.id}
                      className={`px-4 py-2 rounded-xl text-sm transition disabled:opacity-50 ${
                        step.primary
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-700 text-white font-bold'
                          : 'text-slate-500 hover:text-slate-700 font-medium'
                      }`}
                    >
                      {step.label}
                    </button>
                  ))}

                  {confirmDelete === u.id ? (
                    <>
                      <button
                        onClick={() => remove(u.id)}
                        disabled={busy === u.id}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition disabled:opacity-50"
                      >
                        {busy === u.id ? 'Raderar...' : 'Ja, radera'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        disabled={busy === u.id}
                        className="px-3 py-2 text-slate-500 hover:text-slate-700 rounded-xl text-sm font-medium transition disabled:opacity-50"
                      >
                        Avbryt
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(u.id)}
                      disabled={busy === u.id}
                      className="px-3 py-2 text-red-600 hover:text-red-600 rounded-xl text-sm font-medium transition disabled:opacity-50"
                    >
                      Radera
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
