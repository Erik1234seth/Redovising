'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { Person, TimelineEvent } from '@/lib/admin-types';
import { STAGES, EVENT_STYLE, fullDate } from '../../_pipeline';
import DeletePerson from '../../_delete-person';
import SmsComposer from '../../_sms-composer';
import { formatPhone } from '@/lib/sms/phone';

export default function PersonPage() {
  const params = useParams<{ key: string }>();
  const router = useRouter();
  const rawKey = Array.isArray(params.key) ? params.key[0] : params.key;

  const [person, setPerson] = useState<Person | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [other, setOther] = useState<{ emails: string[]; phones: string[] }>({ emails: [], phones: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingStage, setSavingStage] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [messaging, setMessaging] = useState(false);

  // Ligger i en useCallback för att kunna köras om efter ett manuellt SMS —
  // det ska synas i historiken direkt, utan att sidan laddas om.
  const load = useCallback(() => {
    if (!rawKey) return;
    fetch(`/api/admin/people?key=${encodeURIComponent(decodeURIComponent(rawKey))}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setPerson(data.person);
          setEvents(data.events ?? []);
          setOther(data.other ?? { emails: [], phones: [] });
        }
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta personen'); setLoading(false); });
  }, [rawKey]);

  useEffect(load, [load]);

  const setStage = async (stage: number) => {
    if (!person?.contactId || savingStage) return;
    const previous = person.stage;
    setPerson({ ...person, stage });
    setSavingStage(true);
    const res = await fetch('/api/admin/people', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: person.contactId, stage }),
    });
    setSavingStage(false);
    // Rulla tillbaka om det inte gick — annars visar panelen ett steg
    // som databasen inte känner till
    if (!res.ok) {
      setPerson((p) => (p ? { ...p, stage: previous } : p));
      setError('Steget kunde inte sparas');
    }
  };

  if (loading) return <div className="text-center py-20 text-warm-400">Laddar...</div>;

  if (error || !person) {
    return (
      <div className="space-y-4">
        <Link href="/admin" className="text-gold-500 hover:text-gold-400 text-sm transition">← Alla personer</Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error || 'Hittade ingen sådan person'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-gold-500 hover:text-gold-400 text-sm transition">← Alla personer</Link>

        <div className="flex items-start justify-between gap-4 mt-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white truncate">
                {person.name || person.email || (person.phone ? formatPhone(person.phone) : '—')}
              </h1>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                person.isCustomer ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
              }`}>
                {person.isCustomer ? 'Kund' : 'Prospekt'}
              </span>
              {person.optedOut && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/20 text-red-400">
                  Avregistrerad från SMS
                </span>
              )}
            </div>
            <p className="text-warm-400 text-sm mt-1.5">
              {[
                person.email,
                person.phone && formatPhone(person.phone),
                person.company,
                person.source && `via ${person.source}`,
              ].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="text-warm-600 text-xs mt-1">
              {person.emailCount} mejl · {person.smsCount} SMS · först sedd {fullDate(person.firstSeen)}
            </p>

            {(other.emails.length > 0 || other.phones.length > 0) && (
              <p className="text-warm-600 text-xs mt-2">
                Även:{' '}
                {[...other.emails, ...other.phones.map(formatPhone)].join(' · ')}
                <span className="block mt-0.5 text-warm-700">
                  Raderna slogs ihop för att de delar mejl eller telefonnummer.
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {person.phone && (
              <button
                onClick={() => setMessaging(true)}
                disabled={person.optedOut}
                title={person.optedOut ? 'Numret har avregistrerat sig från SMS' : undefined}
                className="px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + SMS
              </button>
            )}
            <button
              onClick={() => setDeleting(true)}
              className="px-3 py-1.5 text-xs bg-red-500/15 hover:bg-red-500/30 text-red-400 rounded-lg transition"
            >
              Ta bort
            </button>
          </div>
        </div>
      </div>

      {/* Var i flödet personen står */}
      <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6">
        <h2 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-5">Flöde</h2>
        {person.contactId ? (
          <div className="flex items-start">
            {STAGES.map((s, i) => {
              const current = person.stage ?? 1;
              const done = current > s.step;
              const active = current === s.step;
              return (
                <div key={s.step} className="flex items-center flex-1 min-w-0">
                  <button
                    onClick={() => setStage(s.step)}
                    disabled={savingStage}
                    className="flex flex-col items-center gap-1.5 group shrink-0 disabled:opacity-60"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      done ? 'bg-gold-500 border-gold-500 text-navy-900'
                        : active ? 'bg-gold-500/20 border-gold-500 text-gold-400 ring-4 ring-gold-500/20'
                        : 'bg-navy-700 border-navy-500 text-warm-500 group-hover:border-warm-400'
                    }`}>
                      {done ? '✓' : s.step}
                    </div>
                    <span className={`text-xs max-w-[68px] text-center leading-tight ${
                      active ? 'text-gold-400' : done ? 'text-gold-500/70' : 'text-warm-500'
                    }`}>
                      {s.label}
                    </span>
                  </button>
                  {i < STAGES.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-5 ${done ? 'bg-gold-500' : 'bg-navy-600'}`} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-warm-500 text-sm">
            Ingen kontaktförfrågan kopplad, så det finns inget steg att flytta. Personen syns här
            för att vi har mejlat eller messat numret.
          </p>
        )}
      </div>

      {/* Allt som hänt */}
      <div>
        <h2 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-4">
          Historik <span className="text-warm-600 font-normal normal-case tracking-normal">({events.length})</span>
        </h2>

        {events.length === 0 ? (
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl text-center py-12 text-warm-400">
            Inget registrerat ännu
          </div>
        ) : (
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6">
            <div className="space-y-0">
              {events.map((e, i) => {
                const style = EVENT_STYLE[e.type];
                const last = i === events.length - 1;
                return (
                  <div key={`${e.at}-${i}`} className="flex gap-4">
                    {/* Tidslinjens streck */}
                    <div className="flex flex-col items-center shrink-0 pt-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
                      {!last && <span className="w-px flex-1 bg-navy-600 my-1" />}
                    </div>

                    <div className={`min-w-0 flex-1 ${last ? '' : 'pb-5'}`}>
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <span className="text-white text-sm font-medium">{e.title}</span>
                        <span className="text-warm-600 text-[11px] shrink-0">{fullDate(e.at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-warm-500 text-[11px]">{style.label}</span>
                        {e.meta && (
                          <span className={`text-[11px] ${e.bad ? 'text-red-400' : 'text-warm-600'}`}>· {e.meta}</span>
                        )}
                      </div>
                      {e.detail && (
                        <p className={`mt-2 text-sm whitespace-pre-wrap break-words rounded-lg px-3 py-2 ${
                          e.type === 'sms_in'
                            ? 'bg-navy-600/60 text-warm-100'
                            : 'bg-navy-800/60 text-warm-300'
                        }`}>
                          {e.detail}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-warm-600 text-xs mt-4">
          Mejl loggas sedan 20 aug 2026. Äldre utskick finns inte registrerade.
        </p>
      </div>

      {messaging && person.phone && (
        <SmsComposer
          to={{ phone: person.phone, name: person.name, optedOut: person.optedOut }}
          onClose={() => setMessaging(false)}
          onSent={load}
        />
      )}

      {deleting && (
        <DeletePerson
          people={[person]}
          onClose={() => setDeleting(false)}
          onDeleted={() => router.push('/admin')}
        />
      )}
    </div>
  );
}
