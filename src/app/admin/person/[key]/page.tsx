'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { AdminMailMessage, Person, PersonUnderlag, Redovisningsmetod, TimelineEvent } from '@/lib/admin-types';
import { STAGES, EVENT_STYLE, REDOVISNINGSMETODER, fullDate } from '../../_pipeline';
import DeletePerson from '../../_delete-person';
import SmsComposer from '../../_sms-composer';
import { formatPhone } from '@/lib/sms/phone';
import { isSieFile } from '@/lib/sie/parse';

/**
 * Flikarna i personkortet. Kundkontext, bokföringsmetod och adresser läses
 * sällan men tog tre kort i höjd innan tidslinjen ens började — som flikar
 * kostar de en rad, och det man faktiskt kommer hit för syns direkt.
 */
const TABS = [
  { id: 'historik', label: 'Historik' },
  { id: 'konversationer', label: 'Mejl' },
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
  const [underlag, setUnderlag] = useState<PersonUnderlag[]>([]);
  const [verifikationerCount, setVerifikationerCount] = useState(0);
  const [mail, setMail] = useState<AdminMailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingStage, setSavingStage] = useState(false);
  const [savingMetod, setSavingMetod] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [tab, setTab] = useState<Tab>('historik');
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
          setUnderlag(data.underlag ?? []);
          setMail(data.mail ?? []);
          setVerifikationerCount(data.verifikationerCount ?? 0);
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

  /** Markerar fel som hanterade, eller ångrar. Laddar om så att listan och tidslinjen följer med. */
  const [savingIssue, setSavingIssue] = useState(false);
  const setDismissed = async (items: { channel: 'mejl' | 'sms'; id: string }[], dismissed: boolean) => {
    if (savingIssue || !items.length) return;
    setSavingIssue(true);
    const res = await fetch('/api/admin/people/issues', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, dismissed }),
    }).catch(() => null);
    setSavingIssue(false);
    if (!res?.ok) { setError('Markeringen kunde inte sparas'); return; }
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

  /**
   * Laddar upp underlag åt personen. Filen går direkt till lagringen med en
   * engångslänk, så storleken begränsas inte av Vercel. En fil i taget, och
   * första felet stoppar resten — då syns det vilken som inte kom fram.
   */
  const uploadFiles = async (files: File[]) => {
    if (!person || uploading || !files.length) return;
    const owner = { profileId: person.profileId, email: person.email };
    setError('');
    try {
      for (const [i, file] of files.entries()) {
        setUploading(files.length > 1 ? `${file.name} (${i + 1}/${files.length})` : file.name);
        const meta = { ...owner, fileName: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' };
        const post = async (action: 'prepare' | 'confirm', extra: object = {}) => {
          const res = await fetch('/api/admin/underlag/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...meta, ...extra }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `${file.name} kunde inte laddas upp`);
          return data;
        };

        const { path, signedUrl } = await post('prepare');
        const put = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': meta.mimeType }, body: file });
        if (!put.ok) throw new Error(`${file.name} kom inte fram till lagringen (${put.status})`);
        await post('confirm', { path });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uppladdningen misslyckades');
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
      load();
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

  // Utan konto och utan adress finns det inget att koppla filen till
  const canUpload = !!(person.profileId || person.email);

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

      {/* Utskick som inte gick fram. Ligger överst så att det inte går att
          missa — längst ner i tidslinjen hann det se ut som att allt gått bra. */}
      {person.issues.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-red-400 font-bold text-sm flex items-center gap-2">
              ⚠ {person.issues.length === 1
                ? 'Ett utskick gick inte som det skulle'
                : `${person.issues.length} utskick gick inte som de skulle`}
            </h2>
            {person.issues.length > 1 && (
              <button
                onClick={() => setDismissed(person.issues.map((x) => ({ channel: x.channel, id: x.id })), true)}
                disabled={savingIssue}
                className="px-3 py-1 text-xs font-medium bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white rounded-lg transition disabled:opacity-50"
              >
                ✓ Markera alla som hanterade
              </button>
            )}
          </div>
          <ul className="mt-3 space-y-2.5">
            {person.issues.map((x) => (
              <li key={x.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-white font-medium">
                    {x.channel === 'mejl' ? '✉' : '💬'} {x.what}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-warm-500 text-[11px]">{fullDate(x.at)}</span>
                    <button
                      onClick={() => setDismissed([{ channel: x.channel, id: x.id }], true)}
                      disabled={savingIssue}
                      className="px-2 py-0.5 text-[11px] font-medium text-warm-300 hover:text-white bg-navy-700/80 hover:bg-navy-600 rounded-md transition disabled:opacity-50"
                    >
                      ✓ Hanterat
                    </button>
                  </span>
                </div>
                <p className="text-red-300/90 mt-0.5">{x.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                {t.id === 'historik' && (
                  <span className={`px-1.5 rounded text-[10px] font-bold shrink-0 normal-case tracking-normal ${
                    person.issues.length > 0 ? 'bg-red-500 text-white' : 'bg-navy-600 text-warm-300'
                  }`}>
                    {events.length}
                  </span>
                )}
                {t.id === 'konversationer' && mail.length > 0 && (
                  <span className="px-1.5 rounded text-[10px] font-bold bg-navy-600 text-warm-300 shrink-0 normal-case tracking-normal">
                    {mail.length}
                  </span>
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
          {/* Allt som hänt */}
          {tab === 'historik' && (
            events.length === 0 ? (
              <p className="text-warm-500 text-sm">Inget registrerat ännu.</p>
            ) : (
              <>
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

                        <div className={`min-w-0 flex-1 ${last ? '' : 'pb-5'} ${
                          e.bad ? 'border-l-2 border-red-500 -ml-2 pl-2' : ''
                        }`}>
                          <div className="flex items-baseline justify-between gap-3 flex-wrap">
                            <span className={`text-sm font-medium ${e.bad ? 'text-red-400' : 'text-white'}`}>
                              {e.bad && '⚠ '}{e.title}
                            </span>
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
                              e.bad
                                ? 'bg-red-500/10 text-red-200'
                                : e.type === 'sms_in'
                                ? 'bg-navy-600/60 text-warm-100'
                                : 'bg-navy-800/60 text-warm-300'
                            }`}>
                              {e.detail}
                            </p>
                          )}
                          {e.issue && (
                            <button
                              onClick={() => setDismissed([{ channel: e.issue!.channel, id: e.issue!.id }], !e.issue!.dismissed)}
                              disabled={savingIssue}
                              className="mt-1.5 mr-3 text-[11px] text-warm-500 hover:text-white transition disabled:opacity-50"
                            >
                              {e.issue.dismissed ? '↺ Markera som fel igen' : '✓ Markera som hanterat'}
                            </button>
                          )}
                          {e.technical && (
                            <details className="mt-1.5">
                              <summary className="text-warm-600 text-[11px] cursor-pointer hover:text-warm-400">
                                Visa tekniskt fel
                              </summary>
                              <pre className="mt-1 text-[11px] text-warm-500 bg-navy-800/60 rounded-lg px-3 py-2 whitespace-pre-wrap break-all">
                                {e.technical}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-warm-600 text-xs mt-5">
                  Mejl loggas sedan 20 aug 2026. Äldre utskick finns inte registrerade.
                </p>
              </>
            )
          )}

          {/* Hela mejlväxlingen med personen, tråd för tråd */}
          {tab === 'konversationer' && <MailThreads mail={mail} />}

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

      {/* Filerna personen skickat, så det syns att de hamnat på rätt person */}
      {/* Kundens bokförda verifikationer — egen sida, listan kan bli lång */}
      <Link
        href={`/admin/person/${encodeURIComponent(person.key)}/verifikationer`}
        className="flex items-center justify-between gap-3 bg-navy-700/50 hover:bg-navy-700 border border-navy-600 rounded-xl px-6 py-4 transition group"
      >
        <div>
          <h2 className="text-xs font-semibold text-warm-400 uppercase tracking-widest">
            Verifikationer{' '}
            <span className="text-warm-600 font-normal normal-case tracking-normal">({verifikationerCount.toLocaleString('sv-SE')})</span>
          </h2>
          <p className="text-warm-600 text-xs mt-1">
            {verifikationerCount > 0
              ? 'Allt som lagts in från kundens SIE-filer.'
              : 'Inga än. SIE-filer som kommer in läggs in här automatiskt.'}
          </p>
        </div>
        <span className="text-gold-500 group-hover:text-gold-400 text-sm shrink-0 transition">Öppna →</span>
      </Link>

      {/* Går också att släppa filer på kortet för att ladda upp dem åt personen */}
      <div
        onDragOver={(e) => { if (canUpload) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (canUpload) uploadFiles([...e.dataTransfer.files]);
        }}
        className={`bg-navy-700/50 border rounded-xl p-6 transition ${
          dragging ? 'border-gold-500 ring-2 ring-gold-500/30' : 'border-navy-600'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-xs font-semibold text-warm-400 uppercase tracking-widest">
            Underlag <span className="text-warm-600 font-normal normal-case tracking-normal">({underlag.length})</span>
          </h2>
          <div className="flex items-center gap-3">
            {underlag.length > 0 && (
              <Link href="/admin/underlag" className="text-gold-500 hover:text-gold-400 text-xs transition">
                Öppna underlagen →
              </Link>
            )}
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => uploadFiles([...(e.target.files ?? [])])}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={!canUpload || !!uploading}
              title={canUpload ? 'Eller dra och släpp filer på kortet' : 'Personen har varken konto eller mejladress'}
              className="px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Ladda upp
            </button>
          </div>
        </div>

        {uploading && (
          <p className="text-gold-400 text-xs mb-3">Laddar upp {uploading}…</p>
        )}

        {underlag.length === 0 ? (
          <p className="text-warm-500 text-sm">
            Inga filer mejlade eller uppladdade än.{canUpload && ' Dra hit filer eller klicka på Ladda upp.'}
          </p>
        ) : (
          <ul className="divide-y divide-navy-600/60">
            {underlag.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="text-warm-100 text-sm truncate min-w-0 flex-1" title={f.fileName}>
                  {f.fileName}
                </span>
                {isSieFile(f.fileName) && (
                  <Link
                    href={`/admin/underlag/${f.id}`}
                    title={f.verifikationer?.fel ?? 'Visa verifikationerna i filen'}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 transition ${
                      f.verifikationer?.fel
                        ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                        : f.verifikationer
                        ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                        : 'bg-gold-500/15 text-gold-400 hover:bg-gold-500/25'
                    }`}
                  >
                    {f.verifikationer?.fel
                      ? '⚠ SIE kunde inte läggas in'
                      : f.verifikationer
                      ? `✓ ${f.verifikationer.inlagda} ver. inlagda${f.verifikationer.dubbletter ? ` · ${f.verifikationer.dubbletter} fanns redan` : ''}`
                      : 'SIE · verifikationer →'}
                  </Link>
                )}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                  f.source === 'mejl' ? 'bg-blue-500/15 text-blue-300'
                    : f.source === 'admin' ? 'bg-gold-500/15 text-gold-400'
                    : 'bg-navy-600 text-warm-300'
                }`}>
                  {f.source === 'mejl' ? '✉ mejl' : f.source === 'admin' ? '👤 admin' : '⬆ app'}
                </span>
                <span className={`text-[11px] shrink-0 w-16 text-right ${
                  f.status === 'bokfort' ? 'text-emerald-400' : f.status === 'granskas' ? 'text-blue-300' : 'text-gold-400'
                }`}>
                  {f.status === 'bokfort' ? 'Bokfört' : f.status === 'granskas' ? 'Granskas' : 'Inkommet'}
                </span>
                <span className="text-warm-600 text-[11px] shrink-0 hidden sm:inline">{fullDate(f.at)}</span>
              </li>
            ))}
          </ul>
        )}
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

/**
 * Mejlarkivet, grupperat per Gmail-tråd med den senast aktiva tråden först.
 * Den översta tråden står öppen, resten fälls ut vid klick.
 */
function MailThreads({ mail }: { mail: AdminMailMessage[] }) {
  const threads = [...mail.reduce((acc, m) => {
    const list = acc.get(m.threadId) ?? [];
    list.push(m);
    return acc.set(m.threadId, list);
  }, new Map<string, AdminMailMessage[]>()).values()]
    .sort((a, b) => b[b.length - 1].at.localeCompare(a[a.length - 1].at));

  if (threads.length === 0) {
    return (
      <p className="text-warm-500 text-sm">
        Inga mejl sparade än. Mejlen synkas från Gmail en gång i timmen.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {threads.map((messages, i) => {
        const last = messages[messages.length - 1];
        const subject = messages.find((m) => m.subject)?.subject || '(inget ämne)';
        return (
          <details key={last.threadId} open={i === 0} className="group bg-navy-800/40 border border-navy-600 rounded-lg">
            <summary className="flex items-baseline justify-between gap-3 px-4 py-3 cursor-pointer list-none">
              <span className="text-white text-sm font-medium truncate min-w-0">
                <span className="text-warm-500 mr-1.5 inline-block transition group-open:rotate-90">›</span>
                {subject}
              </span>
              <span className="text-warm-600 text-[11px] shrink-0">
                {messages.length} mejl · {fullDate(last.at)}
              </span>
            </summary>

            <div className="px-4 pb-4 space-y-3">
              {messages.map((m) => {
                const fromUs = m.direction === 'out';
                const text = m.body.trim() || m.raw.trim();
                return (
                  <div key={m.id} className={`flex ${fromUs ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] min-w-0 rounded-lg px-3 py-2 ${
                      fromUs ? 'bg-gold-500/10 border border-gold-500/20' : 'bg-navy-600/60'
                    }`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={`text-[11px] font-semibold ${fromUs ? 'text-gold-400' : 'text-warm-300'}`}>
                          {fromUs ? 'Vi' : m.from || 'Kunden'}
                        </span>
                        <span className="text-warm-600 text-[11px] shrink-0">{fullDate(m.at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-warm-100 whitespace-pre-wrap break-words">
                        {text || <span className="text-warm-500 italic">(ingen text)</span>}
                      </p>
                      {m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {m.attachments.map((name, j) => (
                            <span key={j} className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-semibold break-all">
                              📎 {name}
                            </span>
                          ))}
                        </div>
                      )}
                      {m.body.trim() && m.raw.trim() !== m.body.trim() && (
                        <details className="mt-1.5">
                          <summary className="text-warm-600 text-[11px] cursor-pointer hover:text-warm-400">
                            Visa hela mejlet
                          </summary>
                          <p className="mt-1 text-xs text-warm-400 whitespace-pre-wrap break-words">{m.raw}</p>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
