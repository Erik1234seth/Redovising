'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { SmsDraft } from '@/lib/admin-types';
import { relativeTime, fullDate } from '../_pipeline';
import { formatPhone } from '@/lib/sms/phone';

/**
 * AI-svaren som väntar på godkännande.
 *
 * Sidan finns för att SMS-svaren inte längre går ut av sig själva. Någon har
 * messat oss och står utan svar tills en knapp här trycks, så ordningen är
 * äldst först och åldern står utskriven — det är den enda siffran som säger
 * hur bråttom det är.
 *
 * Texten går att ändra innan den skickas. Ändringen sparas mot samma rad, så
 * det som står i rutan är också det som hamnar i personens tidslinje efteråt.
 */

/** Twilio delar långa SMS i segment som debiteras var för sig. */
const GSM_SEGMENT = 160;
const UNICODE_SEGMENT = 70;

/**
 * Ungefär hur många SMS texten blir. Ett tecken utanför Latin-1 — en emoji, ett
 * tankstreck klistrat från Word — tvingar Twilio till UCS-2, och då ryms 70
 * tecken per segment istället för 160. Räknaren finns för att den skillnaden
 * ska synas innan man trycker skicka, inte på fakturan.
 */
function segments(text: string): number {
  if (!text) return 0;
  const unicode = [...text].some((c) => (c.codePointAt(0) ?? 0) > 0xff);
  return Math.ceil(text.length / (unicode ? UNICODE_SEGMENT : GSM_SEGMENT));
}

export default function SmsDraftsPage() {
  const [drafts, setDrafts] = useState<SmsDraft[]>([]);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/admin/sms-drafts')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          const list: SmsDraft[] = data.drafts ?? [];
          setDrafts(list);
          // Behåll det som redan står i en ruta någon håller på att skriva i —
          // sidan laddar om var 30:e sekund och får inte äta upp ändringen.
          setBodies((prev) => {
            const next: Record<string, string> = {};
            for (const d of list) next[d.id] = prev[d.id] ?? d.body;
            return next;
          });
        }
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta utkasten'); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);

  const act = async (id: string, method: 'POST' | 'PATCH' | 'DELETE') => {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      const res = await fetch('/api/admin/sms-drafts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method === 'DELETE' ? { id } : { id, body: bodies[id] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Det gick inte');
        // 409 betyder att raden hunnit bli något annat — hämta om så att
        // sidan visar verkligheten istället för ett utkast som inte finns.
        if (res.status === 409) load();
      } else if (method === 'PATCH') {
        setDrafts((list) => list.map((d) => (d.id === id ? { ...d, body: data.body } : d)));
      } else {
        setDrafts((list) => list.filter((d) => d.id !== id));
      }
    } catch {
      setError('Det gick inte att nå servern');
    }
    setBusy(null);
  };

  if (loading) return <div className="text-center py-20 text-warm-400">Laddar...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">SMS-utkast</h1>
        <p className="text-warm-400 text-sm mt-1.5">
          AI:n har skrivit svaren nedan men inget går ut förrän du trycker Skicka. Ändra
          texten om du vill. Personen väntar under tiden.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {drafts.length === 0 ? (
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl text-center py-16">
          <p className="text-warm-300">Inga utkast väntar</p>
          <p className="text-warm-600 text-xs mt-1.5">
            Nästa gång någon messar oss dyker AI:ns svar upp här.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((d) => {
            const text = bodies[d.id] ?? d.body;
            const edited = text.trim() !== d.body.trim();
            const empty = !text.trim();
            const working = busy === d.id;
            const count = segments(text);

            return (
              <div key={d.id} className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
                <div className="flex items-baseline justify-between gap-3 flex-wrap px-5 pt-4">
                  <Link
                    href={`/admin/person/${encodeURIComponent(`p:${d.phone}`)}`}
                    className="text-white text-sm font-medium hover:text-gold-500 transition"
                  >
                    {formatPhone(d.phone)}
                  </Link>
                  <span className="text-warm-600 text-[11px]" title={fullDate(d.at)}>
                    utkast skrivet {relativeTime(d.at)}
                  </span>
                </div>

                {d.optedOut && (
                  <p className="mx-5 mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-xs">
                    Numret har avregistrerat sig från SMS. Utkastet går inte att skicka — släng det.
                  </p>
                )}

                {d.question && (
                  <div className="px-5 pt-3">
                    <p className="text-warm-500 text-[11px] mb-1">
                      Personen skrev {d.questionAt ? relativeTime(d.questionAt) : ''}
                    </p>
                    <p className="bg-navy-600/60 text-warm-100 text-sm rounded-lg px-3 py-2 whitespace-pre-wrap break-words">
                      {d.question}
                    </p>
                  </div>
                )}

                <div className="px-5 pt-3">
                  <p className="text-warm-500 text-[11px] mb-1">AI:ns förslag</p>
                  <textarea
                    value={text}
                    onChange={(e) => setBodies((b) => ({ ...b, [d.id]: e.target.value }))}
                    rows={Math.min(10, Math.max(3, text.split('\n').length + 1))}
                    className="w-full bg-navy-800 border border-navy-600 text-warm-100 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition resize-y"
                  />
                  <p className="text-warm-600 text-[11px] mt-1.5">
                    {text.length} tecken · {count} SMS{count > 1 ? ' (delas upp och debiteras styckvis)' : ''}
                    {edited && <span className="text-gold-500"> · ändrad</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap px-5 py-4">
                  <button
                    onClick={() => act(d.id, 'POST')}
                    disabled={working || empty || d.optedOut}
                    className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {working ? 'Skickar...' : 'Skicka'}
                  </button>
                  <button
                    onClick={() => act(d.id, 'PATCH')}
                    disabled={working || empty || !edited}
                    className="px-3 py-2 text-sm text-warm-300 hover:text-white bg-navy-600/60 hover:bg-navy-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Spara utan att skicka
                  </button>
                  <button
                    onClick={() => act(d.id, 'DELETE')}
                    disabled={working}
                    className="px-3 py-2 text-sm bg-red-500/15 hover:bg-red-500/30 text-red-400 rounded-lg transition disabled:opacity-40 ml-auto"
                  >
                    Släng
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-warm-600 text-xs">
        Välkomst-SMS till nya leads går fortfarande ut direkt — de är en fast mall och
        hamnar aldrig här.
      </p>
    </div>
  );
}
