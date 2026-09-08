'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { Person, Redovisningsmetod, TimelineEvent } from '@/lib/admin-types';
import { STAGES, EVENT_STYLE, REDOVISNINGSMETODER, fullDate } from '../../_pipeline';
import DeletePerson from '../../_delete-person';
import SmsComposer from '../../_sms-composer';
import { formatPhone } from '@/lib/sms/phone';

/**
 * Flikarna i personkortet. Kundkontext, bokföringsmetod och adresser läses
 * sällan men tog tre kort i höjd innan tidslinjen ens började — som flikar
 * kostar de en rad, och det man faktiskt kommer hit för syns direkt.
 */
const TABS = [
  { id: 'kontext', label: 'Kundkontext' },
  { id: 'metod', label: 'Bokföringsmetod' },
  { id: 'mejl', label: 'Mejladresser' },
] as const;

type Tab = (typeof TABS)[number]['id'];

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
  const [savingMetod, setSavingMetod] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [tab, setTab] = useState<Tab>('kontext');

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

  /**
   * Klick på den redan valda metoden tar bort valet igen — annars går ett
   * felklick inte att ångra, och "vet inte" är ett ärligare svar än fel metod.
   */
  const setMetod = async (value: Redovisningsmetod) => {
    if (!person || savingMetod) return;
    const next = person.redovisningsmetod === value ? null : value;
    const previous = person.redovisningsmetod;
    setPerson({ ...person, redovisningsmetod: next });
    setSavingMetod(true);
    const res = await fetch('/api/admin/people', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: person.profileId,
        contactId: person.contactId,
        redovisningsmetod: next,
      }),
    });
    setSavingMetod(false);
    if (!res.ok) {
      setPerson((p) => (p ? { ...p, redovisningsmetod: previous } : p));
      setError('Bokföringsmetoden kunde inte sparas');
    }
  };

  /**
   * Kopplar en till adress till personen. Laddar om efteråt i stället för att
   * skriva i state: kopplingen slår ihop personen med allt som redan kommit in
   * på adressen, och då ändras både tidslinjen och kontaktuppgifterna.
   */
  const addEmail = async () => {
    if (!person || savingEmail) return;
    const email = newEmail.trim().toLowerCase();
    if (!email.includes('@')) { setError('Ange en giltig mejladress'); return; }
    setSavingEmail(true);
    const res = await fetch('/api/admin/people/alias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personKey: person.key, profileId: person.profileId, email }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingEmail(false);
    if (!res.ok) { setError(data.error || 'Adressen kunde inte kopplas'); return; }
    setError('');
    setNewEmail('');
    load();
  };

  const removeEmail = async (id: string) => {
    if (savingEmail) return;
    setSavingEmail(true);
    const res = await fetch('/api/admin/people/alias', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setSavingEmail(false);
    if (!res.ok) { setError('Kopplingen kunde inte tas bort'); return; }
    setError('');
    load();
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

      <div className="bg-navy-700/50 border border-navy-600 rounded-xl">
        {/* Fliknamnen bär små märken så att en tom bokföringsmetod eller en
            handpåkopplad adress syns utan att man öppnar fliken först. */}
        <div className="flex overflow-x-auto border-b border-navy-600">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? 'true' : undefined}
                className={`flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap border-b-2 -mb-px transition ${
                  active
                    ? 'border-gold-500 text-gold-400'
                    : 'border-transparent text-warm-500 hover:text-warm-300'
                }`}
              >
                {t.label}
                {t.id === 'metod' && !person.redovisningsmetod && (
                  <span title="Inte ifyllt än" className="w-1.5 h-1.5 rounded-full bg-warm-600 shrink-0" />
                )}
                {t.id === 'mejl' && person.manualEmails.length > 0 && (
                  <span className="px-1.5 rounded text-[10px] font-bold bg-navy-600 text-warm-300 shrink-0 normal-case tracking-normal">
                    +{person.manualEmails.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* Vad personen sagt om sin verksamhet — samma text AI:n får med sig */}
          {tab === 'kontext' && (
            person.verksamhet ? (
              <p className="text-warm-100 text-sm whitespace-pre-wrap break-words">{person.verksamhet}</p>
            ) : (
              <p className="text-warm-500 text-sm">
                Ingen verksamhetsbeskrivning ifylld{person.isCustomer ? '' : ' — personen har inget konto än'}.
              </p>
            )
          )}

          {/* Kontantmetoden eller faktureringsmetoden. Är inget valt står korten
              tomma tills någon klickar i ett — vi gissar inte åt kunden. */}
          {tab === 'metod' && (
            person.profileId || person.contactId ? (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  {REDOVISNINGSMETODER.map((m) => {
                    const chosen = person.redovisningsmetod === m.value;
                    return (
                      <button
                        key={m.value}
                        onClick={() => setMetod(m.value)}
                        disabled={savingMetod}
                        aria-pressed={chosen}
                        title={chosen ? 'Klicka igen för att ta bort valet' : undefined}
                        className={`text-left rounded-xl border p-4 transition disabled:opacity-60 ${
                          chosen
                            ? 'bg-gold-500/15 border-gold-500 ring-1 ring-gold-500/30'
                            : 'bg-navy-800/40 border-navy-600 hover:border-warm-500'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            chosen ? 'bg-gold-500 border-gold-500' : 'border-navy-500'
                          }`}>
                            {chosen && <span className="text-navy-900 text-[9px] font-bold leading-none">✓</span>}
                          </span>
                          <span className={`text-sm font-semibold ${chosen ? 'text-gold-400' : 'text-warm-200'}`}>
                            {m.label}
                          </span>
                        </div>
                        <p className="text-warm-500 text-xs mt-2 leading-relaxed">{m.hint}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-warm-600 text-xs mt-3">
                  {person.profileId
                    ? 'Sparas på kundens konto.'
                    : 'Personen har inget konto än — valet sparas på kontaktförfrågan och följer med när kontot skapas.'}
                </p>
              </>
            ) : (
              <p className="text-warm-500 text-sm">
                Varken konto eller kontaktförfrågan är kopplad, så det finns ingen rad att spara metoden
                på. Personen syns här för att vi har mejlat eller messat numret.
              </p>
            )
          )}

          {/* Adresser som pekats ut för hand. Panelen slår ihop rader som delar
              mejl eller telefon av sig själv — det här är för kunden som svarat
              från en adress vi aldrig sett, där det inte finns något att haka i. */}
          {tab === 'mejl' && (
            <>
              <div className="space-y-2">
                {/* Huvudadressen är den vi hörde av senast, och det kan mycket väl
                    vara den handpåkopplade. Då är det samma adress som raden nedan
                    och ska inte stå två gånger. */}
                {!person.manualEmails.some((m) => m.email === person.email) && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-warm-100 break-all">{person.email || '—'}</span>
                    <span className="text-warm-600 text-[11px] shrink-0">huvudadress</span>
                  </div>
                )}

                {person.manualEmails.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="text-warm-100 break-all">{m.email}</span>
                    <span className="text-warm-600 text-[11px] shrink-0">
                      {m.email === person.email ? 'huvudadress · tillagd för hand' : 'tillagd för hand'}
                    </span>
                    <button
                      onClick={() => removeEmail(m.id)}
                      disabled={savingEmail}
                      title="Ta bort kopplingen"
                      className="ml-auto shrink-0 px-2 py-0.5 text-[11px] text-warm-600 hover:text-red-400 rounded transition disabled:opacity-40"
                    >
                      Ta bort
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addEmail(); }}
                  placeholder="annan.adress@exempel.se"
                  className="flex-1 min-w-0 bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-warm-600 focus:outline-none focus:border-gold-500 transition"
                />
                <button
                  onClick={addEmail}
                  disabled={savingEmail || !newEmail.trim()}
                  className="shrink-0 px-4 py-2 text-sm bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Koppla
                </button>
              </div>

              <p className="text-warm-600 text-xs mt-3 leading-relaxed">
                Allt som redan kommit in på adressen flyttas hit när du kopplar den, och personen
                försvinner ur listan som en egen rad.{' '}
                {person.profileId
                  ? 'Mail-AI:n känner igen adressen som kundens och svarar med kontots uppgifter.'
                  : 'Personen har inget konto, så mail-AI:n har inga kontouppgifter att känna igen adressen med.'}
              </p>
            </>
          )}
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
