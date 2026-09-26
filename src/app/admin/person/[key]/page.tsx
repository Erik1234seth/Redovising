'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { AdminMailMessage, AdminTransaktion, AdminVerifikation, MomsPeriod, Person, PersonUnderlag, Redovisningsmetod, TimelineEvent } from '@/lib/admin-types';
import { STAGES, EVENT_STYLE, REDOVISNINGSMETODER, MOMSPERIODER, fullDate } from '../../_pipeline';
import DeletePerson from '../../_delete-person';
import SmsComposer from '../../_sms-composer';
import { formatPhone } from '@/lib/sms/phone';
import { isSieFile } from '@/lib/sie/parse';
import { VerifikationLista } from '../../_verifikationer';
import { TransaktionsLista } from '../../_transaktioner';
import { kanLasasAvAi } from '@/lib/underlag/filtyp';

/**
 * Flikarna i personkortet — en per fråga man kommer hit med.
 *
 * Kundkontext samlar allt om personen: verksamheten, bokföringsmetoden och
 * tidslinjen. Metoden och verksamheten läses sällan och tog var sitt kort i
 * höjd innan tidslinjen ens började; som rubriker i samma flik kostar de
 * ingenting. Adresserna bor under Mejl, där mejlen de hör till finns, och
 * filerna under Underlag — dit går det också att dra och släppa nya.
 *
 * Vald flik läggs i adressen som #flik, så att en länk hit kan peka på en
 * bestämd flik och en omladdning landar på samma ställe.
 */
const TABS = [
  { id: 'kontext', label: 'Kundkontext' },
  { id: 'konversationer', label: 'Mejl' },
  { id: 'underlag', label: 'Underlag' },
  { id: 'transaktioner', label: 'Transaktioner' },
  { id: 'verifikationer', label: 'Verifikationer' },
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
  const [verifikationer, setVerifikationer] = useState<AdminVerifikation[] | null>(null);
  const [verifikationerError, setVerifikationerError] = useState('');
  const [transaktionerCount, setTransaktionerCount] = useState(0);
  const [transaktioner, setTransaktioner] = useState<AdminTransaktion[] | null>(null);
  const [transaktionerError, setTransaktionerError] = useState('');
  // Filerna som är ikryssade för AI-avläsning, och vilken som läses just nu
  const [valda, setValda] = useState<string[]>([]);
  const [laser, setLaser] = useState<string | null>(null);
  const [mail, setMail] = useState<AdminMailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingStage, setSavingStage] = useState(false);
  const [savingMetod, setSavingMetod] = useState(false);
  const [savingMoms, setSavingMoms] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [tab, setTab] = useState<Tab>('kontext');
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
          setTransaktionerCount(data.transaktionerCount ?? 0);
        }
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta personen'); setLoading(false); });
  }, [rawKey]);

  useEffect(load, [load]);

  // Länkar utifrån pekar ut en flik med #verifikationer
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (TABS.some((t) => t.id === hash)) setTab(hash as Tab);
  }, []);

  /**
   * Verifikationerna hämtas först när fliken öppnas. De är tusentals rader hos
   * en kund som skickat ett helt år, och personkortet ska öppnas snabbt.
   */
  useEffect(() => {
    if (tab !== 'verifikationer' || verifikationer || verifikationerError || !rawKey) return;
    fetch(`/api/admin/people?key=${encodeURIComponent(decodeURIComponent(rawKey))}&view=verifikationer`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setVerifikationerError(data.error);
        else setVerifikationer(data.verifikationer ?? []);
      })
      .catch(() => setVerifikationerError('Kunde inte hämta verifikationerna'));
  }, [tab, verifikationer, verifikationerError, rawKey]);

  /** Transaktionerna hämtas på samma sätt: först när fliken öppnas. */
  useEffect(() => {
    if (tab !== 'transaktioner' || transaktioner || transaktionerError || !rawKey) return;
    fetch(`/api/admin/people?key=${encodeURIComponent(decodeURIComponent(rawKey))}&view=transaktioner`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setTransaktionerError(data.error);
        else setTransaktioner(data.transaktioner ?? []);
      })
      .catch(() => setTransaktionerError('Kunde inte hämta transaktionerna'));
  }, [tab, transaktioner, transaktionerError, rawKey]);

  const selectTab = (next: Tab) => {
    setTab(next);
    history.replaceState(null, '', next === 'kontext' ? window.location.pathname : `#${next}`);
  };

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
   * Byter momsperiod, t.ex. när kunden valt fel i onboardingen. Till skillnad
   * från metoden går valet inte att ta bort — kunden har alltid svarat något.
   */
  const setMoms = async (value: MomsPeriod) => {
    if (!person?.profileId || savingMoms || person.momsPeriod === value) return;
    const previous = person.momsPeriod;
    setPerson({ ...person, momsPeriod: value });
    setSavingMoms(true);
    const res = await fetch('/api/admin/people', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: person.profileId, momsPeriod: value }),
    });
    setSavingMoms(false);
    if (!res.ok) {
      setPerson((p) => (p ? { ...p, momsPeriod: previous } : p));
      setError('Momsperioden kunde inte sparas');
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
      // En uppladdad SIE-fil lägger in verifikationer, så listan hämtas om
      setVerifikationer(null);
      setVerifikationerError('');
      load();
    }
  };

  /**
   * Läser ut transaktionerna ur de ikryssade filerna, en i taget.
   *
   * Ett kontoutdrag på tjugo sidor tar en stund, och en fil som fallerar ska
   * inte ta med sig de andra — därför ett anrop per fil, och felet skrivs på
   * filen i stället för att stoppa körningen.
   */
  const lasUtTransaktioner = async () => {
    if (laser || valda.length === 0) return;
    setError('');
    const filer = underlag.filter((f) => valda.includes(f.id));
    for (const [i, f] of filer.entries()) {
      setLaser(filer.length > 1 ? `${f.fileName} (${i + 1}/${filer.length})` : f.fileName);
      try {
        const res = await fetch(`/api/admin/underlag/${f.id}/transaktioner`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `${f.fileName} kunde inte läsas`);
      } catch (err) {
        setError(err instanceof Error ? err.message : `${f.fileName} kunde inte läsas`);
      }
    }
    setLaser(null);
    setValda([]);
    setTransaktioner(null);
    setTransaktionerError('');
    load();
  };

  /**
   * Stryker rader AI:n tagit med som inte hör hemma — en summarad, en dubblett
   * ur ett överlappande kontoutdrag. Antalet på filen räknas om i routen.
   */
  const raderaTransaktioner = async (ids: string[]) => {
    const res = await fetch('/api/admin/transaktioner', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || 'Transaktionerna kunde inte raderas'); return; }
    setError('');
    setTransaktioner((list) => (list ? list.filter((t) => !ids.includes(t.id)) : list));
    setTransaktionerCount((n) => Math.max(0, n - ids.length));
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

  // Utan konto och utan adress finns det inget att koppla filen till
  const canUpload = !!(person.profileId || person.email);

  const verFiler = verifikationer
    ? new Set(verifikationer.map((v) => v.underlagId).filter(Boolean)).size
    : 0;

  // SIE-filer läses med kod och hör hemma bland verifikationerna, så de går
  // inte att kryssa i här
  const lasbara = underlag.filter((f) => kanLasasAvAi(f.fileName, f.mimeType));

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
                onClick={() => selectTab(t.id)}
                aria-current={active ? 'true' : undefined}
                className={`flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap border-b-2 -mb-px transition ${
                  active
                    ? 'border-gold-500 text-gold-400'
                    : 'border-transparent text-warm-500 hover:text-warm-300'
                }`}
              >
                {t.label}
                {t.id === 'kontext' && !person.redovisningsmetod && (
                  <span title="Bokföringsmetoden är inte ifylld än" className="w-1.5 h-1.5 rounded-full bg-warm-600 shrink-0" />
                )}
                {t.id === 'kontext' && (
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
                {t.id === 'underlag' && underlag.length > 0 && (
                  <span className="px-1.5 rounded text-[10px] font-bold bg-navy-600 text-warm-300 shrink-0 normal-case tracking-normal">
                    {underlag.length}
                  </span>
                )}
                {t.id === 'transaktioner' && transaktionerCount > 0 && (
                  <span className="px-1.5 rounded text-[10px] font-bold bg-navy-600 text-warm-300 shrink-0 normal-case tracking-normal">
                    {transaktionerCount.toLocaleString('sv-SE')}
                  </span>
                )}
                {t.id === 'verifikationer' && verifikationerCount > 0 && (
                  <span className="px-1.5 rounded text-[10px] font-bold bg-navy-600 text-warm-300 shrink-0 normal-case tracking-normal">
                    {verifikationerCount.toLocaleString('sv-SE')}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* Allt om kunden på ett ställe: vad personen sagt om sin verksamhet
              (samma text AI:n får med sig), hur affärshändelserna bokförs, och
              allt som hänt med personen i tidsordning. */}
          {tab === 'kontext' && (
            <div className="space-y-8">
              <section>
                <h3 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-4">Verksamhet</h3>
                {person.verksamhet ? (
                  <p className="text-warm-100 text-sm whitespace-pre-wrap break-words">{person.verksamhet}</p>
                ) : (
                  <p className="text-warm-500 text-sm">
                    Ingen verksamhetsbeskrivning ifylld{person.isCustomer ? '' : ' — personen har inget konto än'}.
                  </p>
                )}
              </section>

              {/* Kontantmetoden eller faktureringsmetoden. Är inget valt står
                  korten tomma tills någon klickar i ett — vi gissar inte åt kunden. */}
              <section className="pt-6 border-t border-navy-600">
                <h3 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-4">Bokföringsmetod</h3>
                {person.profileId || person.contactId ? (
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
                )}
              </section>

              <section className="pt-6 border-t border-navy-600">
                <h3 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-4">Momsperiod</h3>
                {person.profileId ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {MOMSPERIODER.map((m) => {
                        const chosen = person.momsPeriod === m.value;
                        return (
                          <button
                            key={m.value}
                            onClick={() => setMoms(m.value)}
                            disabled={savingMoms}
                            aria-pressed={chosen}
                            className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition disabled:opacity-60 ${
                              chosen
                                ? 'bg-gold-500/15 border-gold-500 ring-1 ring-gold-500/30'
                                : 'bg-navy-800/40 border-navy-600 hover:border-warm-500'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                              chosen ? 'bg-gold-500 border-gold-500' : 'border-navy-500'
                            }`}>
                              {chosen && <span className="text-navy-900 text-[9px] font-bold leading-none">✓</span>}
                            </span>
                            <span className={`text-sm font-semibold ${chosen ? 'text-gold-400' : 'text-warm-200'}`}>
                              {m.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-warm-600 text-xs mt-3">
                      {person.momsPeriod === 'ingen-moms'
                        ? 'Kunden angav att de inte redovisar moms. Välj en period ovan om det var fel.'
                        : person.momsPeriod
                          ? 'Sparas på kundens konto.'
                          : 'Kunden har inte valt någon momsperiod än.'}
                    </p>
                  </>
                ) : (
                  <p className="text-warm-500 text-sm">
                    Personen har inget konto än — momsperioden väljs i onboardingen.
                  </p>
                )}
              </section>

              <section className="pt-6 border-t border-navy-600">
                <h3 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-4">Historik</h3>
                {events.length === 0 ? (
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
                )}
              </section>
            </div>
          )}

          {/* Hela mejlväxlingen med personen, tråd för tråd, och adresserna
              den kommer in på */}
          {tab === 'konversationer' && (
            <>
              <MailThreads mail={mail} />

              {/* Adresser som pekats ut för hand. Panelen slår ihop rader som
                  delar mejl eller telefon av sig själv — det här är för kunden som
                  svarat från en adress vi aldrig sett, där det inte finns något
                  att haka i. */}
              <div className="mt-8 pt-6 border-t border-navy-600">
                <h3 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-4">
                  Mejladresser
                </h3>

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
              </div>
            </>
          )}

          {/* Filerna personen skickat, så det syns att de hamnat på rätt person.
              Går också att släppa filer i fliken för att ladda upp dem åt personen. */}
          {tab === 'underlag' && (
            <div
              onDragOver={(e) => { if (canUpload) { e.preventDefault(); setDragging(true); } }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (canUpload) uploadFiles([...e.dataTransfer.files]);
              }}
              className={`-m-2 p-2 rounded-xl border border-dashed transition ${
                dragging ? 'border-gold-500 bg-gold-500/5' : 'border-transparent'
              }`}
            >
              <div className="flex items-center justify-end gap-3 mb-4 flex-wrap">
                {underlag.length > 0 && (
                  <Link href="/admin/underlag" className="text-gold-500 hover:text-gold-400 text-xs transition mr-auto">
                    Öppna underlagen →
                  </Link>
                )}
                {lasbara.length > 0 && (
                  <>
                    <button
                      onClick={() => setValda(valda.length === lasbara.length ? [] : lasbara.map((f) => f.id))}
                      disabled={!!laser}
                      className="text-warm-500 hover:text-warm-300 text-xs transition disabled:opacity-40"
                    >
                      {valda.length === lasbara.length ? 'Avmarkera alla' : 'Markera alla'}
                    </button>
                    <button
                      onClick={lasUtTransaktioner}
                      disabled={valda.length === 0 || !!laser}
                      title="Låter en AI skriva av transaktionerna i filerna. De konteras inte här."
                      className="px-3 py-1.5 text-xs bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/30 text-gold-400 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {laser ? 'Läser…' : `Plocka ut transaktioner${valda.length ? ` (${valda.length})` : ''}`}
                    </button>
                  </>
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
                  title={canUpload ? 'Eller dra och släpp filer i fliken' : 'Personen har varken konto eller mejladress'}
                  className="px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Ladda upp
                </button>
              </div>

              {uploading && (
                <p className="text-gold-400 text-xs mb-3">Laddar upp {uploading}…</p>
              )}

              {laser && (
                <p className="text-gold-400 text-xs mb-3">
                  AI:n läser {laser}… Ett stort kontoutdrag kan ta ett par minuter.
                </p>
              )}

              {underlag.length === 0 ? (
                <p className="text-warm-500 text-sm">
                  Inga filer mejlade eller uppladdade än.{canUpload && ' Dra hit filer eller klicka på Ladda upp.'}
                </p>
              ) : (
                <ul className="divide-y divide-navy-600/60">
                  {underlag.map((f) => (
                    <li key={f.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                      <input
                        type="checkbox"
                        checked={valda.includes(f.id)}
                        disabled={!kanLasasAvAi(f.fileName, f.mimeType) || !!laser}
                        onChange={(e) => setValda((list) =>
                          e.target.checked ? [...list, f.id] : list.filter((id) => id !== f.id))}
                        title={kanLasasAvAi(f.fileName, f.mimeType)
                          ? 'Markera för att plocka ut transaktioner'
                          : 'Den här filtypen läser vi inte av med AI'}
                        className="shrink-0 mt-1 accent-gold-500 disabled:opacity-30"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-warm-100 text-sm block truncate" title={f.fileName}>
                          {f.fileName}
                        </span>
                        {/* Koden i sandlådan skrivs om varje körning — noteringen
                            visar att den läste rätt ställe */}
                        {f.transaktioner?.notering && (
                          <span className="text-warm-600 text-[11px] block">{f.transaktioner.notering}</span>
                        )}
                      </span>
                      {f.transaktioner && (
                        <span
                          title={f.transaktioner.fel ?? `Utläst ${fullDate(f.transaktioner.at)}`}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                            f.transaktioner.fel
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-blue-500/15 text-blue-300'
                          }`}
                        >
                          {f.transaktioner.fel
                            ? '⚠ AI kunde inte läsa filen'
                            : `${f.transaktioner.antal} transaktioner utlästa`}
                        </span>
                      )}
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
          )}

          {/* Det AI:n läst ur underlagen, innan någon konterat det. Bara
              avskriften: datum, text och belopp som de stod på kvittot. */}
          {tab === 'transaktioner' && (
            transaktionerError ? (
              <p className="text-red-400 text-sm">{transaktionerError}</p>
            ) : !transaktioner ? (
              <p className="text-warm-500 text-sm">Hämtar transaktionerna…</p>
            ) : transaktioner.length === 0 ? (
              <p className="text-warm-500 text-sm leading-relaxed">
                Inga transaktioner utlästa än. Kryssa i filerna under Underlag och klicka på
                &quot;Plocka ut transaktioner&quot; — AI:n läser av kvitton, fakturor, kontoutdrag
                och Excel-listor.
              </p>
            ) : (
              <>
                <p className="text-warm-600 text-xs mb-4">
                  Utläst ur underlagen med AI och inte konterat än — konteringen blir en
                  verifikation i nästa steg.
                </p>
                <TransaktionsLista transaktioner={transaktioner} onDelete={raderaTransaktioner} />
              </>
            )
          )}

          {/* Allt kunden har bokfört hos oss. Just nu från SIE-filer, som tolkas
              med kod när de kommer in — senare även AI-tolkade kvitton och
              fakturor, och då syns det på varje verifikation var den kom ifrån. */}
          {tab === 'verifikationer' && (
            verifikationerError ? (
              <p className="text-red-400 text-sm">{verifikationerError}</p>
            ) : !verifikationer ? (
              <p className="text-warm-500 text-sm">Hämtar verifikationerna…</p>
            ) : verifikationer.length === 0 ? (
              <p className="text-warm-500 text-sm leading-relaxed">
                Inga verifikationer än. När kunden mejlar in eller du laddar upp en SIE-fil läggs
                verifikationerna in här automatiskt.
              </p>
            ) : (
              <>
                <p className="text-warm-600 text-xs mb-4">
                  {verifikationer.length.toLocaleString('sv-SE')} verifikationer från {verFiler}{' '}
                  {verFiler === 1 ? 'fil' : 'filer'}.
                </p>
                <VerifikationLista verifikationer={verifikationer} showSource />
              </>
            )
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
