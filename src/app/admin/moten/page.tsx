'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { AdminMeeting } from '@/lib/admin-types';
import { fullDate, relativeTime } from '../_pipeline';
import { formatPhone } from '@/lib/sms/phone';
import { formatMeetingDate } from '@/lib/meetingSlots';

/**
 * Alla bokade tider, oavsett var de bokades.
 *
 * Dagens samtal ligger överst och är det enda som behöver läsas på morgonen —
 * resten är till för att se vad som är på väg. Tidigare möten ligger bakom en
 * egen flik: de är historik, inte att göra.
 */

const SOURCE_LABELS: Record<AdminMeeting['source'], string> = {
  'boka-mote': 'Boka möte',
  popup: 'Popupen',
  flodet: 'Kontaktflödet',
  facebook: 'Facebook',
  okand: 'Okänd väg',
};

/** Rubriken en bokning hamnar under. Dagens möten förtjänar en egen. */
function groupOf(meeting: AdminMeeting, today: string): string {
  return meeting.date === today ? 'I dag' : formatMeetingDate(meeting.date);
}

function Reminder({ meeting }: { meeting: AdminMeeting }) {
  if (meeting.reminder === 'sent') {
    return <span className="text-emerald-300/80 text-xs">Påminnelse skickad</span>;
  }
  if (meeting.reminder === 'failed') {
    return <span className="text-red-400 text-xs font-semibold">Påminnelsen gick inte fram</span>;
  }
  if (meeting.past) return null;
  if (!meeting.phone) {
    return <span className="text-warm-600 text-xs">Inget nummer — ingen påminnelse</span>;
  }
  return <span className="text-warm-600 text-xs">Påminnelse går ut på morgonen</span>;
}

export default function MotenPage() {
  const [meetings, setMeetings] = useState<AdminMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [confirming, setConfirming] = useState<AdminMeeting | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/moten')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else { setMeetings(data.meetings ?? []); setError(''); }
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta mötena'); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // Svensk tid explicit: en webbläsare som står i en annan tidszon ska gruppera
  // listan likadant som servern räknade ut `past`.
  const today = useMemo(
    () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }),
    [],
  );

  const cancel = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/moten', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirming.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || 'Det gick inte att avboka');
      else setMeetings((list) => list.filter((m) => m.id !== confirming.id));
    } catch {
      setError('Det gick inte att nå servern');
    }
    setBusy(false);
    setConfirming(null);
  };

  if (loading) return <div className="text-center py-20 text-warm-400">Laddar...</div>;

  const upcoming = meetings.filter((m) => !m.past);
  const past = meetings.filter((m) => m.past);
  // Kommande visas i tur och ordning; historiken med det senaste först.
  const visible = showPast ? past : [...upcoming].reverse();
  const todayCount = upcoming.filter((m) => m.date === today).length;

  let lastGroup = '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bokade tider</h1>
        <p className="text-warm-400 text-sm mt-1.5">
          Allt som bokats via sajten, popupen och Facebooks snabbformulär. Påminnelse-SMS går
          ut på morgonen samma dag — kolumnen till höger säger om det gick fram.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {todayCount > 0 && !showPast && (
        <div className="bg-gold-500/10 border border-gold-500/30 rounded-xl px-4 py-3 text-gold-300 text-sm">
          {todayCount === 1 ? 'Ett samtal i dag.' : `${todayCount} samtal i dag.`} Kunden väntar
          sig att vi ringer från 072-519 16 16.
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowPast(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            showPast ? 'text-warm-500 hover:text-warm-300' : 'bg-navy-700 text-white border border-navy-600'
          }`}
        >
          Kommande ({upcoming.length})
        </button>
        <button
          onClick={() => setShowPast(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            showPast ? 'bg-navy-700 text-white border border-navy-600' : 'text-warm-500 hover:text-warm-300'
          }`}
        >
          Tidigare ({past.length})
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl text-center py-16">
          <p className="text-warm-300">{showPast ? 'Inga möten har varit än' : 'Inga bokade tider'}</p>
          <p className="text-warm-600 text-xs mt-1.5">
            {showPast
              ? 'Möten som passerat hamnar här.'
              : 'Nästa gång någon bokar en tid dyker den upp här.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((m) => {
            const group = groupOf(m, today);
            const heading = group !== lastGroup ? group : null;
            lastGroup = group;

            return (
              <div key={m.id}>
                {heading && (
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 mt-6 first:mt-0 ${
                    heading === 'I dag' ? 'text-gold-400' : 'text-warm-600'
                  }`}>
                    {heading}
                  </p>
                )}

                <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-white font-bold text-lg tabular-nums">{m.time}</span>
                        {m.personKey ? (
                          <Link
                            href={`/admin/person/${encodeURIComponent(m.personKey)}`}
                            className="text-white font-semibold hover:text-gold-500 transition truncate"
                          >
                            {m.name || m.email}
                          </Link>
                        ) : (
                          <span className="text-white font-semibold truncate">{m.name || 'Utan namn'}</span>
                        )}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-navy-600 text-warm-400">
                          {SOURCE_LABELS[m.source]}
                        </span>
                      </div>

                      <p className="text-warm-400 text-sm mt-1.5">
                        {m.phone ? (
                          <a href={`tel:${m.phone}`} className="hover:text-gold-500 transition">
                            {formatPhone(m.phone)}
                          </a>
                        ) : (
                          <span className="text-red-400/80">Inget telefonnummer</span>
                        )}
                        {m.email && (
                          <>
                            <span className="text-warm-600"> · </span>
                            <a href={`mailto:${m.email}`} className="hover:text-gold-500 transition">
                              {m.email}
                            </a>
                          </>
                        )}
                      </p>

                      {m.message && (
                        <p className="text-warm-300 text-sm mt-2 bg-navy-800/60 border border-navy-600 rounded-lg px-3 py-2">
                          {m.message}
                        </p>
                      )}

                      <p className="text-warm-600 text-xs mt-2" title={fullDate(m.bookedAt)}>
                        Bokades {relativeTime(m.bookedAt)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Reminder meeting={m} />
                      {!m.past && (
                        <button
                          onClick={() => setConfirming(m)}
                          className="px-4 py-2 rounded-xl text-sm font-medium text-warm-500 hover:text-red-400 transition"
                        >
                          Avboka
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-navy-800 border border-navy-600 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-white font-bold text-lg">Avboka tiden?</h2>
            <p className="text-warm-400 text-sm mt-2">
              {formatMeetingDate(confirming.date)} kl. {confirming.time} med{' '}
              {confirming.name || confirming.email || 'okänd'}. Tiden blir ledig igen på sajten,
              och kunden får inget besked härifrån — säg till hen själv först.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={cancel}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-red-500/90 hover:bg-red-500 text-white font-bold text-sm transition disabled:opacity-50"
              >
                {busy ? 'Avbokar...' : 'Avboka'}
              </button>
              <button
                onClick={() => setConfirming(null)}
                className="flex-1 py-2.5 rounded-xl border border-navy-600 text-warm-300 hover:text-white text-sm font-medium transition"
              >
                Behåll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
