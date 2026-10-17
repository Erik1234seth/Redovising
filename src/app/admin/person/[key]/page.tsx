'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AdminMailMessage, AdminTransaktion, AdminVerifikation, BokslutData, MomsPeriod, Person, PersonUnderlag, Redovisningsmetod, TimelineEvent } from '@/lib/admin-types';
import { EVENT_STYLE, REDOVISNINGSMETODER, MOMSPERIODER, fullDate } from '../../_pipeline';
import SmsComposer from '../../_sms-composer';
import { formatPhone } from '@/lib/sms/phone';
import { isSieFile } from '@/lib/sie/parse';
import { VerifikationLista } from '../../_verifikationer';
import { TransaktionsLista } from '../../_transaktioner';
import { kanLasasAvAi } from '@/lib/underlag/filtyp';
import { BokslutChecklista, bokslutPunkter, type UppladdningsPunkt } from '../../_bokslut';
import { KonteringsVy } from '../../_kontering';
import { MomsFil } from '../../_momsfil';
import { Varningar } from '../../_varningar';
import { NeBilaga } from '../../_ne';

/**
 * Flikarna i personkortet — en per fråga man kommer hit med.
 *
 * Kundkontext samlar allt om personen: verksamheten, bokföringsmetoden och
 * tidslinjen. Metoden och verksamheten läses sällan och tog var sitt kort i
 * höjd innan tidslinjen ens började; som rubriker i samma flik kostar de
 * ingenting. Adresserna bor under Mejl, där mejlen de hör till finns, och
 * filerna under Underlag — dit går det också att dra och släppa nya. Filer
 * som inte ska bokföras (NE-bilagor, avtal, våra egna) ligger under Övriga filer.
 * Bokslut är checklistan över vad som finns och vad som saknas inför bokslutet.
 *
 * Vald flik läggs i adressen som #flik, så att en länk hit kan peka på en
 * bestämd flik och en omladdning landar på samma ställe.
 */
const TABS = [
  { id: 'kontext', label: 'Kundkontext' },
  { id: 'bokslut', label: 'Bokslut' },
  { id: 'konversationer', label: 'Mejl' },
  { id: 'filer', label: 'Övriga filer' },
  { id: 'underlag', label: 'Underlag' },
  { id: 'transaktioner', label: 'Transaktioner' },
  { id: 'kontering', label: 'Kontering' },
  { id: 'verifikationer', label: 'Verifikationer' },
] as const;

type Tab = (typeof TABS)[number]['id'];

/** Flikarna som ligger i Bokföring-menyn i stället för på raden. */
const BOKFORING: Tab[] = ['underlag', 'transaktioner', 'kontering', 'verifikationer'];

export default function PersonPage() {
  const params = useParams<{ key: string }>();
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
  const [bokslut, setBokslut] = useState<BokslutData | null>(null);
  // Perioden som valts i momsfilen — verifikationslistan under visar samma
  const [verPeriod, setVerPeriod] = useState<{ fran: string; tom: string } | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingMetod, setSavingMetod] = useState(false);
  const [savingMoms, setSavingMoms] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [tab, setTab] = useState<Tab>('kontext');
  const [menyOppen, setMenyOppen] = useState(false);
  const bokforingMeny = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Radera kräver två klick: första visar "Ja, radera", andra raderar på riktigt
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [raderar, setRaderar] = useState<string | null>(null);
  // Att flytta en utläst fil till övrigt tar bort transaktionerna — då krävs två klick
  const [flyttar, setFlyttar] = useState<string | null>(null);
  const [bekraftaFlytt, setBekraftaFlytt] = useState<string | null>(null);
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
          // Servern skickar äldst först; nyast överst läses lättare.
          setEvents([...(data.events ?? [])].reverse());
          setOther(data.other ?? { emails: [], phones: [] });
          setUnderlag(data.underlag ?? []);
          setMail(data.mail ?? []);
          setBokslut(data.bokslut ?? null);
          setVerifikationerCount(data.verifikationerCount ?? 0);
          setTransaktionerCount(data.transaktionerCount ?? 0);
        }
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta personen'); setLoading(false); });
  }, [rawKey]);

  useEffect(load, [load]);

  // Bokföring-menyn stängs när man klickar någon annanstans
  useEffect(() => {
    if (!menyOppen) return;
    const stang = (e: MouseEvent) => {
      if (!bokforingMeny.current?.contains(e.target as Node)) setMenyOppen(false);
    };
    document.addEventListener('mousedown', stang);
    return () => document.removeEventListener('mousedown', stang);
  }, [menyOppen]);

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
    // Bokslutet behöver dem också — NE-bilagan räknas ur verifikationerna
    if ((tab !== 'verifikationer' && tab !== 'bokslut') || verifikationer || verifikationerError || !rawKey) return;
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
    // Konteringen bokför verifikationer — de ska hämtas om nästa gång fliken öppnas
    if (tab === 'kontering') setVerifikationer(null);
    setTab(next);
    history.replaceState(null, '', next === 'kontext' ? window.location.pathname : `#${next}`);
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

  /** Företagskonto eller privatkonto — avgör betalkontot när vi konterar. */
  const [savingBetalsatt, setSavingBetalsatt] = useState(false);
  const setBetalsatt = async (value: 'foretagskonto' | 'privatkonto') => {
    if (!person?.profileId || savingBetalsatt || person.betalsatt === value) return;
    const previous = person.betalsatt;
    setPerson({ ...person, betalsatt: value });
    setSavingBetalsatt(true);
    const res = await fetch('/api/admin/people', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: person.profileId, betalsatt: value }),
    });
    setSavingBetalsatt(false);
    if (!res.ok) {
      setPerson((p) => (p ? { ...p, betalsatt: previous } : p));
      setError('Betalsättet kunde inte sparas');
    }
  };

  /** Startåret sparas när fältet lämnas, och bara om det ändrats. */
  const [startArText, setStartArText] = useState<string | null>(null);
  const sparaStartAr = async () => {
    if (!person?.profileId || startArText === null) return;
    const ar = startArText.trim() ? Number(startArText) : null;
    setStartArText(null);
    if (ar === person.startAr) return;
    const previous = person.startAr;
    setPerson({ ...person, startAr: ar });
    const res = await fetch('/api/admin/people', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: person.profileId, startAr: ar }),
    });
    if (!res.ok) {
      setPerson((p) => (p ? { ...p, startAr: previous } : p));
      setError((await res.json().catch(() => null))?.error ?? 'Startåret kunde inte sparas');
    }
  };

  const [savingPeriodisk, setSavingPeriodisk] = useState(false);
  const setPeriodisk = async (value: boolean) => {
    if (!person?.profileId || savingPeriodisk) return;
    setPerson({ ...person, periodiskSammanfattning: value });
    setSavingPeriodisk(true);
    const res = await fetch('/api/admin/people', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: person.profileId, periodiskSammanfattning: value }),
    });
    setSavingPeriodisk(false);
    if (!res.ok) {
      setPerson((p) => (p ? { ...p, periodiskSammanfattning: !value } : p));
      setError('Periodisk sammanfattning kunde inte sparas');
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
   *
   * `efter` får id:na på filerna som kom fram och körs innan personen laddas
   * om, så att det den sparar finns med i omladdningen.
   */
  const uploadFiles = async (files: File[], efter?: (ids: string[]) => Promise<void>) => {
    if (!person || uploading || !files.length) return;
    const owner = { profileId: person.profileId, email: person.email };
    const ids: string[] = [];
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
        const { id } = await post('confirm', { path });
        ids.push(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uppladdningen misslyckades');
    } finally {
      if (efter && ids.length) await efter(ids).catch(() => setError('Filen laddades upp men kunde inte kopplas'));
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
      // En uppladdad SIE-fil lägger in verifikationer, så listan hämtas om
      setVerifikationer(null);
      setVerifikationerError('');
      load();
    }
  };

  /**
   * Uppladdning från bokslutsfliken. NE-bilagan och lagerlistan får sin sort
   * först i filnamnet, så att de går att känna igen bland underlagen, och
   * kopplas till sin punkt i checklistan när personen har konto.
   */
  const laddaUppBokslut = (punkt: UppladdningsPunkt, files: File[]) => {
    const prefix = { ne: 'NE-bilaga', lager: 'Lager-inventarielista', underlag: null }[punkt];
    const namngivna = prefix
      ? files.map((f) => (f.name.toLowerCase().startsWith(prefix.toLowerCase())
        ? f
        : new File([f], `${prefix} - ${f.name}`, { type: f.type })))
      : files;
    const koppla = prefix && person?.profileId
      ? async ([id]: string[]) => {
        const res = await fetch('/api/admin/people/bokslut', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId: person.profileId, punkt, underlagId: id }),
        });
        if (!res.ok) throw new Error();
      }
      : undefined;
    return uploadFiles(namngivna, koppla);
  };

  /**
   * Läser av de ikryssade filerna med AI, en i taget. AI:n avgör per fil om
   * det blir transaktioner eller — för ett redan bokfört underlag —
   * verifikationer, så båda listorna hämtas om efteråt.
   *
   * Ett kontoutdrag på tjugo sidor tar en stund, och en fil som fallerar ska
   * inte ta med sig de andra — därför ett anrop per fil, och felet skrivs på
   * filen i stället för att stoppa körningen.
   */
  const lasUtTransaktioner = async () => {
    if (laser || valda.length === 0) return;
    setError('');
    // Markerade filer som inte går att läsa (SIE, Excel) är markerade för att raderas
    const filer = underlag.filter((f) => valda.includes(f.id) && kanLasasAvAi(f.fileName, f.mimeType));
    if (filer.length === 0) return;
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
    setVerifikationer(null);
    setVerifikationerError('');
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

  /**
   * Raderar ett underlag — filen i lagringen och raden. Verifikationerna och
   * transaktionerna som lästs ur filen följer med, så de flikarna hämtas om.
   */
  const raderaUnderlag = async (id: string) => {
    if (raderar) return;
    setRaderar(id);
    setError('');
    const res = await fetch('/api/admin/underlag', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setRaderar(null);
    setConfirmDelete(null);
    if (!res?.ok) { setError(data?.error || 'Underlaget kunde inte raderas'); return; }
    setUnderlag((list) => list.filter((f) => f.id !== id));
    setValda((list) => list.filter((v) => v !== id));
    setVerifikationer(null);
    setVerifikationerError('');
    setTransaktioner(null);
    setTransaktionerError('');
    load();
  };

  /** Raderar alla markerade underlag på en gång, med samma två klick som för en fil. */
  const raderaValda = async () => {
    if (raderar || valda.length === 0) return;
    const ids = valda;
    setRaderar('valda');
    setError('');
    const res = await fetch('/api/admin/underlag', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setRaderar(null);
    setConfirmDelete(null);
    if (!res?.ok) { setError(data?.error || 'Underlagen kunde inte raderas'); return; }
    setUnderlag((list) => list.filter((f) => !ids.includes(f.id)));
    setValda([]);
    setVerifikationer(null);
    setVerifikationerError('');
    setTransaktioner(null);
    setTransaktionerError('');
    load();
  };

  /**
   * Flyttar en fil mellan underlagen och övriga filer. Till övrigt tas det som
   * lästs ut ur den bort, så transaktionerna och verifikationerna hämtas om.
   */
  const flyttaFil = async (id: string, sortering: 'underlag' | 'ovrigt') => {
    if (flyttar) return;
    setFlyttar(id);
    setError('');
    const res = await fetch('/api/admin/underlag', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, sortering }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setFlyttar(null);
    setBekraftaFlytt(null);
    if (!res?.ok) { setError(data?.error || 'Filen kunde inte flyttas'); return; }
    setValda((list) => list.filter((v) => v !== id));
    setVerifikationer(null);
    setVerifikationerError('');
    setTransaktioner(null);
    setTransaktionerError('');
    load();
  };

  if (loading) return <div className="text-center py-20 text-slate-600">Laddar...</div>;

  if (error || !person) {
    return (
      <div className="space-y-4">
        <Link href="/admin/personer" className="text-blue-700 hover:text-blue-700 text-sm transition">← Alla personer</Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-600 text-sm">
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

  // Underlagsfliken visar bara det som ska bokföras. Det som sorterats som
  // övrigt — NE-bilagor, avtal, filer vi själva skickat — har en egen flik.
  // Osorterade filer står bland underlagen tills avläsningen sorterat dem.
  const bokforingsfiler = underlag.filter((f) => f.sortering !== 'ovrigt');
  const ovrigaFiler = underlag.filter((f) => f.sortering === 'ovrigt');

  // SIE-filer läses med kod och hör hemma bland verifikationerna. De går att
  // markera för att raderas, men AI-avläsningen hoppar över dem.
  const lasbara = bokforingsfiler.filter((f) => kanLasasAvAi(f.fileName, f.mimeType));
  const valdaLasbara = lasbara.filter((f) => valda.includes(f.id)).length;

  /** Radera med två klick — samma i underlagen och bland övriga filer. */
  const raderaKnapp = (id: string, disabled: boolean) => (confirmDelete === id ? (
    <span className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => raderaUnderlag(id)}
        disabled={!!raderar}
        className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded text-[11px] transition disabled:opacity-50"
      >
        {raderar === id ? 'Raderar…' : 'Ja, radera'}
      </button>
      <button
        onClick={() => setConfirmDelete(null)}
        disabled={!!raderar}
        className="text-slate-500 hover:text-slate-700 text-[11px] transition disabled:opacity-50"
      >
        Avbryt
      </button>
    </span>
  ) : (
    <button
      onClick={() => setConfirmDelete(id)}
      disabled={!!raderar || disabled}
      title="Radera filen och allt som lästs ur den"
      className="text-red-600 hover:text-red-600 text-[11px] shrink-0 transition disabled:opacity-40"
    >
      Radera
    </button>
  ));

  const punkter = bokslutPunkter(person, bokslut, underlag, verifikationerCount, transaktionerCount);
  const saknas = punkter.filter((p) => p.status === 'saknas').length;
  const kolla = punkter.filter((p) => p.status === 'kolla').length;

  /** Små märken på fliknamnen: antal, och om något saknas eller behöver kollas. */
  const markenFor = (id: Tab) => {
    return (
      <>
        {id === 'kontext' && !person.redovisningsmetod && (
          <span title="Bokföringsmetoden är inte ifylld än" className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
        )}
        {id === 'kontext' && (
          <span className={`px-1.5 rounded text-[10px] font-bold shrink-0 normal-case tracking-normal ${
            person.issues.length > 0 ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {events.length}
          </span>
        )}
        {/* Rött med antalet som saknas, gult när bara saker att kolla
            är kvar, grön bock när allt finns */}
        {id === 'bokslut' && (
          <span
            title={saknas ? `${saknas} saknas inför bokslutet` : kolla ? `${kolla} att kolla` : 'Allt finns'}
            className={`px-1.5 rounded text-[10px] font-bold shrink-0 normal-case tracking-normal ${
              saknas ? 'bg-red-500 text-white' : kolla ? 'bg-amber-400 text-white' : 'bg-emerald-500 text-white'
            }`}
          >
            {saknas || kolla || '✓'}
          </span>
        )}
        {id === 'konversationer' && mail.length > 0 && (
          <span className="px-1.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0 normal-case tracking-normal">
            {mail.length}
          </span>
        )}
        {id === 'underlag' && bokforingsfiler.length > 0 && (
          <span className="px-1.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0 normal-case tracking-normal">
            {bokforingsfiler.length}
          </span>
        )}
        {id === 'filer' && ovrigaFiler.length > 0 && (
          <span className="px-1.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0 normal-case tracking-normal">
            {ovrigaFiler.length}
          </span>
        )}
        {id === 'transaktioner' && transaktionerCount > 0 && (
          <span className="px-1.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0 normal-case tracking-normal">
            {transaktionerCount.toLocaleString('sv-SE')}
          </span>
        )}
        {id === 'verifikationer' && verifikationerCount > 0 && (
          <span className="px-1.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0 normal-case tracking-normal">
            {verifikationerCount.toLocaleString('sv-SE')}
          </span>
        )}
      </>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/personer" className="text-blue-700 hover:text-blue-700 text-sm transition">← Alla personer</Link>

        <div className="flex items-start justify-between gap-4 mt-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 truncate">
                {person.name || person.email || (person.phone ? formatPhone(person.phone) : '—')}
              </h1>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                person.isCustomer ? 'bg-green-500/20 text-green-600' : 'bg-purple-500/20 text-purple-400'
              }`}>
                {person.isCustomer ? 'Kund' : 'Prospekt'}
              </span>
              {person.optedOut && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/20 text-red-600">
                  Avregistrerad från SMS
                </span>
              )}
            </div>
            <p className="text-slate-600 text-sm mt-1.5">
              {[
                person.email,
                person.phone && formatPhone(person.phone),
                person.company,
                person.source && `via ${person.source}`,
              ].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {person.emailCount} mejl · {person.smsCount} SMS · först sedd {fullDate(person.firstSeen)}
            </p>

            {(other.emails.length > 0 || other.phones.length > 0) && (
              <p className="text-slate-400 text-xs mt-2">
                Även:{' '}
                {[...other.emails, ...other.phones.map(formatPhone)].join(' · ')}
                <span className="block mt-0.5 text-slate-400">
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
                className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + SMS
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Utskick som inte gick fram. Ligger överst så att det inte går att
          missa — längst ner i tidslinjen hann det se ut som att allt gått bra. */}
      {person.issues.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-red-600 font-bold text-sm flex items-center gap-2">
              ⚠ {person.issues.length === 1
                ? 'Ett utskick gick inte som det skulle'
                : `${person.issues.length} utskick gick inte som de skulle`}
            </h2>
            {person.issues.length > 1 && (
              <button
                onClick={() => setDismissed(person.issues.map((x) => ({ channel: x.channel, id: x.id })), true)}
                disabled={savingIssue}
                className="px-3 py-1 text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 rounded-lg transition disabled:opacity-50"
              >
                ✓ Markera alla som hanterade
              </button>
            )}
          </div>
          <ul className="mt-3 space-y-2.5">
            {person.issues.map((x) => (
              <li key={x.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-slate-900 font-medium">
                    {x.channel === 'mejl' ? '✉' : '💬'} {x.what}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-slate-500 text-[11px]">{fullDate(x.at)}</span>
                    <button
                      onClick={() => setDismissed([{ channel: x.channel, id: x.id }], true)}
                      disabled={savingIssue}
                      className="px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-md transition disabled:opacity-50"
                    >
                      ✓ Hanterat
                    </button>
                  </span>
                </div>
                <p className="text-red-700 mt-0.5">{x.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-xl">
        {/* Fliknamnen bär små märken så att en tom bokföringsmetod eller en
            handpåkopplad adress syns utan att man öppnar fliken först. */}
        <div className="flex flex-wrap border-b border-slate-200">
          {TABS.filter((t) => !BOKFORING.includes(t.id)).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => selectTab(t.id)}
                aria-current={active ? 'true' : undefined}
                className={`flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap border-b-2 -mb-px transition ${
                  active
                    ? 'border-blue-500 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
                {markenFor(t.id)}
              </button>
            );
          })}

          {/* Bokföringens fyra steg i en meny — som egna flikar tog de upp hela raden */}
          <div className="relative" ref={bokforingMeny}>
            <button
              onClick={() => setMenyOppen((o) => !o)}
              aria-expanded={menyOppen}
              aria-current={BOKFORING.includes(tab) ? 'true' : undefined}
              className={`flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs font-semibold uppercase tracking-widest whitespace-nowrap border-b-2 -mb-px transition ${
                BOKFORING.includes(tab)
                  ? 'border-blue-500 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {BOKFORING.includes(tab) ? TABS.find((t) => t.id === tab)?.label : 'Bokföring'}
              {BOKFORING.includes(tab) && markenFor(tab)}
              <span className={`text-[9px] transition ${menyOppen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {menyOppen && (
              <div className="absolute left-0 top-full mt-1 z-20 min-w-[200px] bg-white border border-slate-200 rounded-lg shadow-xl py-1">
                {TABS.filter((t) => BOKFORING.includes(t.id)).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { selectTab(t.id); setMenyOppen(false); }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-left transition ${
                      tab === t.id ? 'text-blue-700 bg-slate-50' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                    <span className="flex items-center gap-1.5">{markenFor(t.id)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Allt om kunden på ett ställe: vad personen sagt om sin verksamhet
              (samma text AI:n får med sig), hur affärshändelserna bokförs, och
              allt som hänt med personen i tidsordning. */}
          {tab === 'kontext' && (
            <div className="space-y-8">
              <section>
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4">Verksamhet</h3>
                {person.verksamhet ? (
                  <p className="text-slate-900 text-sm whitespace-pre-wrap break-words">{person.verksamhet}</p>
                ) : (
                  <p className="text-slate-500 text-sm">
                    Ingen verksamhetsbeskrivning ifylld{person.isCustomer ? '' : ' — personen har inget konto än'}.
                  </p>
                )}
              </section>

              {/* Kontantmetoden eller faktureringsmetoden. Är inget valt står
                  korten tomma tills någon klickar i ett — vi gissar inte åt kunden. */}
              <section className="pt-6 border-t border-slate-200">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4">Bokföringsmetod</h3>
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
                                ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500/30'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                chosen ? 'bg-blue-600 border-blue-500' : 'border-slate-300'
                              }`}>
                                {chosen && <span className="text-slate-900 text-[9px] font-bold leading-none">✓</span>}
                              </span>
                              <span className={`text-sm font-semibold ${chosen ? 'text-blue-700' : 'text-slate-800'}`}>
                                {m.label}
                              </span>
                            </div>
                            <p className="text-slate-500 text-xs mt-2 leading-relaxed">{m.hint}</p>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-slate-400 text-xs mt-3">
                      {person.profileId
                        ? 'Sparas på kundens konto.'
                        : 'Personen har inget konto än — valet sparas på kontaktförfrågan och följer med när kontot skapas.'}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 text-sm">
                    Varken konto eller kontaktförfrågan är kopplad, så det finns ingen rad att spara metoden
                    på. Personen syns här för att vi har mejlat eller messat numret.
                  </p>
                )}
              </section>

              <section className="pt-6 border-t border-slate-200">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4">Startår</h3>
                {person.profileId ? (
                  <>
                    <input
                      value={startArText ?? (person.startAr ? String(person.startAr) : '')}
                      onChange={(e) => setStartArText(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      onBlur={sparaStartAr}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      placeholder="ÅÅÅÅ"
                      inputMode="numeric"
                      className="w-28 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-slate-400 text-xs mt-3">
                      {person.startAr && person.redovisningsmetod
                        ? 'Startår och bokföringsmetod finns — kunden ligger under Kunder i inkorgen.'
                        : 'Med startår och bokföringsmetod flyttas kunden från Saknar uppgifter till Kunder i inkorgen.'}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 text-sm">Personen har inget konto än.</p>
                )}
              </section>

              <section className="pt-6 border-t border-slate-200">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4">Momsperiod</h3>
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
                                ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500/30'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                              chosen ? 'bg-blue-600 border-blue-500' : 'border-slate-300'
                            }`}>
                              {chosen && <span className="text-slate-900 text-[9px] font-bold leading-none">✓</span>}
                            </span>
                            <span className={`text-sm font-semibold ${chosen ? 'text-blue-700' : 'text-slate-800'}`}>
                              {m.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-slate-400 text-xs mt-3">
                      {person.momsPeriod === 'ingen-moms'
                        ? 'Kunden angav att de inte redovisar moms. Välj en period ovan om det var fel.'
                        : person.momsPeriod
                          ? 'Sparas på kundens konto.'
                          : 'Kunden har inte valt någon momsperiod än.'}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 text-sm">
                    Personen har inget konto än — momsperioden väljs i onboardingen.
                  </p>
                )}
              </section>

              {/* Vilket konto kunden betalar från. Konteringen bokför mot 1930
                  vid företagskonto, och mot 2017/2013 vid privatkonto. */}
              <section className="pt-6 border-t border-slate-200">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4">Betalar via</h3>
                {person.profileId ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      {([
                        { value: 'foretagskonto', label: 'Företagskonto' },
                        { value: 'privatkonto', label: 'Privatkonto' },
                      ] as const).map((m) => {
                        const chosen = person.betalsatt === m.value;
                        return (
                          <button
                            key={m.value}
                            onClick={() => setBetalsatt(m.value)}
                            disabled={savingBetalsatt}
                            aria-pressed={chosen}
                            className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition disabled:opacity-60 ${
                              chosen
                                ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500/30'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                              chosen ? 'bg-blue-600 border-blue-500' : 'border-slate-300'
                            }`}>
                              {chosen && <span className="text-slate-900 text-[9px] font-bold leading-none">✓</span>}
                            </span>
                            <span className={`text-sm font-semibold ${chosen ? 'text-blue-700' : 'text-slate-800'}`}>
                              {m.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-slate-400 text-xs mt-3">
                      {person.betalsatt === 'bada'
                        ? 'Kunden angav att de betalar från både företags- och privatkonto — betalkontot väljs per rad i konteringen. Välj ett ovan om det ska gälla alla.'
                        : person.betalsatt
                          ? 'Sparas på kundens konto och styr betalkontot i konteringen.'
                          : 'Inte valt än — konteringen kan inte köras förrän det är valt.'}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 text-sm">Personen har inget konto än — det väljs i onboardingen.</p>
                )}
              </section>

              {/* Försäljning till företag i andra EU-länder ska redovisas i en periodisk sammanfattning */}
              <section className="pt-6 border-t border-slate-200">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4">Periodisk sammanfattning</h3>
                {person.profileId ? (
                  <label className="inline-flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                    <input type="checkbox" checked={person.periodiskSammanfattning} disabled={savingPeriodisk}
                      onChange={(e) => setPeriodisk(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    Ska ha periodisk sammanfattning
                  </label>
                ) : (
                  <p className="text-slate-500 text-sm">Personen har inget konto än.</p>
                )}
              </section>

              <section className="pt-6 border-t border-slate-200">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4">Historik</h3>
                {events.length === 0 ? (
                  <p className="text-slate-500 text-sm">Inget registrerat ännu.</p>
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
                              {!last && <span className="w-px flex-1 bg-slate-100 my-1" />}
                            </div>

                            <div className={`min-w-0 flex-1 ${last ? '' : 'pb-5'} ${
                              e.bad ? 'border-l-2 border-red-500 -ml-2 pl-2' : ''
                            }`}>
                              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                                <span className={`text-sm font-medium ${e.bad ? 'text-red-600' : 'text-slate-900'}`}>
                                  {e.bad && '⚠ '}{e.title}
                                </span>
                                <span className="text-slate-400 text-[11px] shrink-0">{fullDate(e.at)}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-slate-500 text-[11px]">{style.label}</span>
                                {e.meta && (
                                  <span className={`text-[11px] ${e.bad ? 'text-red-600' : 'text-slate-400'}`}>· {e.meta}</span>
                                )}
                              </div>
                              {e.detail && (
                                <p className={`mt-2 text-sm whitespace-pre-wrap break-words rounded-lg px-3 py-2 ${
                                  e.bad
                                    ? 'bg-red-500/10 text-red-800'
                                    : e.type === 'sms_in'
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'bg-white text-slate-700'
                                }`}>
                                  {e.detail}
                                </p>
                              )}
                              {e.issue && (
                                <button
                                  onClick={() => setDismissed([{ channel: e.issue!.channel, id: e.issue!.id }], !e.issue!.dismissed)}
                                  disabled={savingIssue}
                                  className="mt-1.5 mr-3 text-[11px] text-slate-500 hover:text-slate-900 transition disabled:opacity-50"
                                >
                                  {e.issue.dismissed ? '↺ Markera som fel igen' : '✓ Markera som hanterat'}
                                </button>
                              )}
                              {e.technical && (
                                <details className="mt-1.5">
                                  <summary className="text-slate-400 text-[11px] cursor-pointer hover:text-slate-600">
                                    Visa tekniskt fel
                                  </summary>
                                  <pre className="mt-1 text-[11px] text-slate-500 bg-white rounded-lg px-3 py-2 whitespace-pre-wrap break-all">
                                    {e.technical}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-slate-400 text-xs mt-5">
                      Mejl loggas sedan 20 aug 2026. Äldre utskick finns inte registrerade.
                    </p>
                  </>
                )}
              </section>
            </div>
          )}

          {tab === 'bokslut' && (
            <BokslutChecklista
              person={person}
              data={bokslut}
              punkter={punkter}
              onData={setBokslut}
              onVerksamhet={(verksamhet) => setPerson({ ...person, verksamhet })}
              onMetod={setMetod}
              onMoms={setMoms}
              onError={setError}
              onUpload={laddaUppBokslut}
              uploading={uploading}
              canUpload={canUpload}
            />
          )}
          {tab === 'bokslut' && (
            verifikationerError
              ? <p className="text-red-600 text-sm mt-8">{verifikationerError}</p>
              : <NeBilaga verifikationer={verifikationer} person={person} data={bokslut} onData={setBokslut} onError={setError} />
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
              <div className="mt-8 pt-6 border-t border-slate-200">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-4">
                  Mejladresser
                </h3>

                <div className="space-y-2">
                  {/* Huvudadressen är den vi hörde av senast, och det kan mycket väl
                      vara den handpåkopplade. Då är det samma adress som raden nedan
                      och ska inte stå två gånger. */}
                  {!person.manualEmails.some((m) => m.email === person.email) && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-900 break-all">{person.email || '—'}</span>
                      <span className="text-slate-400 text-[11px] shrink-0">huvudadress</span>
                    </div>
                  )}

                  {person.manualEmails.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm">
                      <span className="text-slate-900 break-all">{m.email}</span>
                      <span className="text-slate-400 text-[11px] shrink-0">
                        {m.email === person.email ? 'huvudadress · tillagd för hand' : 'tillagd för hand'}
                      </span>
                      <button
                        onClick={() => removeEmail(m.id)}
                        disabled={savingEmail}
                        title="Ta bort kopplingen"
                        className="ml-auto shrink-0 px-2 py-0.5 text-[11px] text-slate-400 hover:text-red-600 rounded transition disabled:opacity-40"
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
                    className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition"
                  />
                  <button
                    onClick={addEmail}
                    disabled={savingEmail || !newEmail.trim()}
                    className="shrink-0 px-4 py-2 text-sm bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Koppla
                  </button>
                </div>

                <p className="text-slate-400 text-xs mt-3 leading-relaxed">
                  Allt som redan kommit in på adressen flyttas hit när du kopplar den, och personen
                  försvinner ur listan som en egen rad.{' '}
                  {person.profileId
                    ? 'Mail-AI:n känner igen adressen som kundens och svarar med kontots uppgifter.'
                    : 'Personen har inget konto, så mail-AI:n har inga kontouppgifter att känna igen adressen med.'}
                </p>
              </div>
            </>
          )}

          {/* Filer som är bra att ha men inte ska bokföras: NE-bilagor, avtal,
              brev, filer vi själva skickat. Sorteras bort innan något läses ut
              ur dem, så att de aldrig hamnar i konteringen. */}
          {tab === 'filer' && (
            ovrigaFiler.length === 0 ? (
              <p className="text-slate-500 text-sm leading-relaxed">
                Inga övriga filer. Hit sorteras filer som inte är underlag för bokföringen — till exempel en
                NE-bilaga, ett avtal eller ett brev från Skatteverket — när de läses av, eller när du flyttar dem
                från Underlag.
              </p>
            ) : (
              <>
                <p className="text-slate-400 text-xs mb-4">
                  Bra att ha, men konteras inte. Ligger en fil fel, flytta den till Underlag — där läses den av med AI.
                </p>
                <ul className="divide-y divide-slate-200">
                  {ovrigaFiler.map((f) => (
                    <li key={f.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                      <span className="min-w-0 flex-1">
                        <span className="text-slate-900 text-sm block truncate" title={f.fileName}>{f.fileName}</span>
                        {f.sorteringOrsak && <span className="text-slate-400 text-[11px] block">{f.sorteringOrsak}</span>}
                      </span>
                      <span className="text-slate-400 text-[11px] shrink-0 hidden sm:inline">{fullDate(f.at)}</span>
                      <a
                        href={`/api/admin/underlag/${f.id}/ladda-ner`}
                        title={`Ladda ner ${f.fileName}`}
                        className="text-blue-700 hover:text-blue-700 text-[11px] shrink-0 transition"
                      >
                        Ladda ner
                      </a>
                      {/* Våra egna filer är kopior av kundens underlag och läses aldrig ut */}
                      {f.sorteringOrsak !== 'Skickad av oss' && kanLasasAvAi(f.fileName, f.mimeType) && (
                        <button
                          onClick={() => flyttaFil(f.id, 'underlag')}
                          disabled={!!flyttar}
                          title="Är ett underlag för bokföringen — flytta till Underlag och läs av den där"
                          className="text-slate-500 hover:text-slate-800 text-[11px] shrink-0 transition disabled:opacity-40"
                        >
                          {flyttar === f.id ? 'Flyttar…' : 'Till underlag'}
                        </button>
                      )}
                      {raderaKnapp(f.id, false)}
                    </li>
                  ))}
                </ul>
              </>
            )
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
                dragging ? 'border-blue-500 bg-blue-50' : 'border-transparent'
              }`}
            >
              <div className="flex items-center justify-end gap-3 mb-4 flex-wrap">
                {bokforingsfiler.length > 0 && (
                  <button
                    onClick={() => setValda(valda.length === bokforingsfiler.length ? [] : bokforingsfiler.map((f) => f.id))}
                    disabled={!!laser || !!raderar}
                    className="text-slate-500 hover:text-slate-700 text-xs transition disabled:opacity-40"
                  >
                    {valda.length === bokforingsfiler.length ? 'Avmarkera alla' : 'Markera alla'}
                  </button>
                )}
                {valda.length > 0 && (confirmDelete === 'valda' ? (
                  <span className="flex items-center gap-2">
                    <button
                      onClick={raderaValda}
                      disabled={!!raderar}
                      className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition disabled:opacity-50"
                    >
                      {raderar === 'valda' ? 'Raderar…' : `Ja, radera ${valda.length}`}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      disabled={!!raderar}
                      className="text-slate-500 hover:text-slate-700 text-xs transition disabled:opacity-50"
                    >
                      Avbryt
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDelete('valda')}
                    disabled={!!raderar || !!laser}
                    title="Radera de markerade filerna och allt som lästs ur dem"
                    className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg transition disabled:opacity-40"
                  >
                    Radera markerade ({valda.length})
                  </button>
                ))}
                {lasbara.length > 0 && (
                  <button
                    onClick={lasUtTransaktioner}
                    disabled={valdaLasbara === 0 || !!laser || !!raderar}
                    title="Låter en AI läsa filerna. Kvitton och kontoutdrag blir transaktioner. Redan bokförda underlag med konton blir verifikationer."
                    className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {laser ? 'Läser…' : `Läs av med AI${valdaLasbara ? ` (${valdaLasbara})` : ''}`}
                  </button>
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
                  className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Ladda upp
                </button>
              </div>

              {uploading && (
                <p className="text-blue-700 text-xs mb-3">Laddar upp {uploading}…</p>
              )}

              {laser && (
                <p className="text-blue-700 text-xs mb-3">
                  AI:n läser {laser}… Ett stort kontoutdrag kan ta ett par minuter.
                </p>
              )}

              {bokforingsfiler.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  Inga underlag mejlade eller uppladdade än.{canUpload && ' Dra hit filer eller klicka på Ladda upp.'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {bokforingsfiler.map((f) => (
                    <li key={f.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                      <input
                        type="checkbox"
                        checked={valda.includes(f.id)}
                        disabled={!!laser || !!raderar}
                        onChange={(e) => setValda((list) =>
                          e.target.checked ? [...list, f.id] : list.filter((id) => id !== f.id))}
                        title={kanLasasAvAi(f.fileName, f.mimeType)
                          ? 'Markera för att läsa av eller radera filen'
                          : 'Markera för att radera filen — den här filtypen läser vi inte av med AI'}
                        className="shrink-0 mt-1 accent-blue-600 disabled:opacity-30"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-slate-900 text-sm block truncate" title={f.fileName}>
                          {f.fileName}
                        </span>
                        {/* Koden i sandlådan skrivs om varje körning — noteringen
                            visar att den läste rätt ställe */}
                        {(f.transaktioner?.notering || f.verifikationer?.notering) && (
                          <span className="text-slate-400 text-[11px] block">
                            {f.transaktioner?.notering || f.verifikationer?.notering}
                          </span>
                        )}
                        {/* Felet på verifikationerna stod förut bara i en tooltip.
                            Lades några in ändå är det en varning, inte ett stopp. */}
                        <Varningar varningar={[
                          ...(f.verifikationer?.fel && f.verifikationer.inlagda ? [f.verifikationer.fel] : []),
                          ...f.varningar,
                        ]} />
                        {f.verifikationer?.fel && !f.verifikationer.inlagda && (
                          <span className="block text-red-600 text-[11px]">{f.verifikationer.fel}</span>
                        )}
                        {f.transaktioner?.fel && (
                          <span className="block text-red-600 text-[11px]">{f.transaktioner.fel}</span>
                        )}
                        {/* Underlagskontrollen: det vi väntar på svar från kunden om */}
                        {f.kontroll?.status === 'saknar' && f.kontroll.saknas.length > 0 && (
                          <span className="block text-amber-700 text-[11px]">
                            Väntar på kunden: {f.kontroll.saknas.map((s) => `${s.rad} (${s.vad})`).join(' · ')}
                          </span>
                        )}
                      </span>
                      {f.kontroll && (
                        <span title={`Kontrollerad ${fullDate(f.kontroll.at)}`}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                            f.kontroll.status === 'komplett' ? 'bg-emerald-50 text-emerald-700'
                              : f.kontroll.status === 'fel' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                          {f.kontroll.status === 'komplett' ? 'Komplett' : f.kontroll.status === 'fel' ? 'Oläslig' : 'Saknar info'}
                        </span>
                      )}
                      {f.transaktioner && (
                        <span
                          title={f.transaktioner.fel ?? `Utläst ${fullDate(f.transaktioner.at)}`}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                            f.transaktioner.fel
                              ? 'bg-red-500/15 text-red-600'
                              : 'bg-blue-500/15 text-blue-700'
                          }`}
                        >
                          {f.transaktioner.fel
                            ? '⚠ AI kunde inte läsa filen'
                            : `${f.transaktioner.antal} transaktioner utlästa`}
                        </span>
                      )}
                      {!isSieFile(f.fileName) && f.verifikationer && (
                        <button
                          onClick={() => selectTab('verifikationer')}
                          title={f.verifikationer.fel ?? 'Bokfört underlag — AI:n läste ut verifikationerna med kontona i filen'}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 transition ${
                            f.verifikationer.fel && !f.verifikationer.inlagda
                              ? 'bg-red-500/15 text-red-600 hover:bg-red-500/25'
                              : f.verifikationer.fel
                              ? 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25'
                              : 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25'
                          }`}
                        >
                          {f.verifikationer.fel && !f.verifikationer.inlagda
                            ? '⚠ Inga verifikationer inlagda'
                            : `${f.verifikationer.fel ? '⚠' : '✓'} ${f.verifikationer.inlagda} ver. inlagda${f.verifikationer.dubbletter ? ` · ${f.verifikationer.dubbletter} fanns redan` : ''}${f.verifikationer.fel ? ' · alla gick inte ihop' : ''}`}
                        </button>
                      )}
                      {isSieFile(f.fileName) && (
                        <Link
                          href={`/admin/underlag/${f.id}`}
                          title={f.verifikationer?.fel ?? 'Visa verifikationerna i filen'}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 transition ${
                            f.verifikationer?.fel
                              ? 'bg-red-500/15 text-red-600 hover:bg-red-500/25'
                              : f.verifikationer
                              ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {f.verifikationer?.fel
                            ? '⚠ SIE kunde inte läggas in'
                            : f.verifikationer
                            ? `✓ ${f.verifikationer.inlagda} ver. inlagda${f.verifikationer.dubbletter ? ` · ${f.verifikationer.dubbletter} fanns redan` : ''}`
                            : 'SIE · verifikationer →'}
                        </Link>
                      )}
                      <span className="text-slate-400 text-[11px] shrink-0 hidden sm:inline">{fullDate(f.at)}</span>
                      <a
                        href={`/api/admin/underlag/${f.id}/ladda-ner`}
                        title={`Ladda ner ${f.fileName}`}
                        className="text-blue-700 hover:text-blue-700 text-[11px] shrink-0 transition"
                      >
                        Ladda ner
                      </a>
                      {/* SIE-filer är alltid bokföring och flyttas inte */}
                      {!isSieFile(f.fileName) && (bekraftaFlytt === f.id ? (
                        <span className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => flyttaFil(f.id, 'ovrigt')}
                            disabled={!!flyttar}
                            className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded text-[11px] transition disabled:opacity-50"
                          >
                            {flyttar === f.id ? 'Flyttar…' : 'Ja, flytta'}
                          </button>
                          <button
                            onClick={() => setBekraftaFlytt(null)}
                            disabled={!!flyttar}
                            className="text-slate-500 hover:text-slate-700 text-[11px] transition disabled:opacity-50"
                          >
                            Avbryt
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => (f.transaktioner?.antal || f.verifikationer?.inlagda
                            ? setBekraftaFlytt(f.id)
                            : flyttaFil(f.id, 'ovrigt'))}
                          disabled={!!flyttar || !!laser}
                          title="Inget underlag för bokföringen — flytta till Övriga filer. Det som lästs ut ur filen, och konteringen av det, tas bort."
                          className="text-slate-500 hover:text-slate-800 text-[11px] shrink-0 transition disabled:opacity-40"
                        >
                          Till övriga
                        </button>
                      ))}
                      {raderaKnapp(f.id, !!laser)}
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
              <p className="text-red-600 text-sm">{transaktionerError}</p>
            ) : !transaktioner ? (
              <p className="text-slate-500 text-sm">Hämtar transaktionerna…</p>
            ) : transaktioner.length === 0 ? (
              <p className="text-slate-500 text-sm leading-relaxed">
                Inga transaktioner utlästa än. Kryssa i filerna under Underlag och klicka på
                &quot;Läs av med AI&quot; — AI:n läser av kvitton, fakturor, kontoutdrag
                och Excel-listor.
              </p>
            ) : (
              <>
                <p className="text-slate-400 text-xs mb-4">
                  Utläst ur underlagen med AI och inte konterat än — konteringen blir en
                  verifikation i nästa steg.
                </p>
                <TransaktionsLista transaktioner={transaktioner} onDelete={raderaTransaktioner} />
              </>
            )
          )}

          {/* Konteringen enligt K1: båda modellernas förslag per transaktion,
              och det som bokförts. Kräver ett konto — kundkontexten och
              betalsättet ligger på profilen. */}
          {tab === 'kontering' && (
            person.profileId ? (
              <KonteringsVy userId={person.profileId} betalsatt={person.betalsatt} />
            ) : (
              <p className="text-slate-500 text-sm">Personen har inget konto än, så det finns inget att kontera.</p>
            )
          )}

          {/* Allt kunden har bokfört hos oss. SIE-filer tolkas med kod när de
              kommer in, och redan bokförda PDF:er och kalkylblad läses av med AI
              — det syns på varje verifikation var den kom ifrån. */}
          {tab === 'verifikationer' && (
            verifikationerError ? (
              <p className="text-red-600 text-sm">{verifikationerError}</p>
            ) : !verifikationer ? (
              <p className="text-slate-500 text-sm">Hämtar verifikationerna…</p>
            ) : verifikationer.length === 0 ? (
              <p className="text-slate-500 text-sm leading-relaxed">
                Inga verifikationer än. När kunden mejlar in eller du laddar upp en SIE-fil läggs
                verifikationerna in här automatiskt. En bokförd PDF eller Excel-export — verifikationslista,
                grundbok, huvudbok — läses in med &quot;Läs av med AI&quot; under Underlag.
              </p>
            ) : (
              <>
                <p className="text-slate-400 text-xs mb-4">
                  {verifikationer.length.toLocaleString('sv-SE')} verifikationer från {verFiler}{' '}
                  {verFiler === 1 ? 'fil' : 'filer'}.
                </p>
                <MomsFil verifikationer={verifikationer} orgNr={bokslut?.orgNr ?? null} momsPeriod={person.momsPeriod} onPeriod={setVerPeriod} />
                <VerifikationLista verifikationer={verifikationer} showSource period={verPeriod} />
              </>
            )
          )}

        </div>
      </div>

      {messaging && person.phone && (
        <SmsComposer
          to={{ phone: person.phone, name: person.name, optedOut: person.optedOut }}
          onClose={() => setMessaging(false)}
          onSent={load}
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
      <p className="text-slate-500 text-sm">
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
          <details key={last.threadId} open={i === 0} className="group bg-white border border-slate-200 rounded-lg">
            <summary className="flex items-baseline justify-between gap-3 px-4 py-3 cursor-pointer list-none">
              <span className="text-slate-900 text-sm font-medium truncate min-w-0">
                <span className="text-slate-500 mr-1.5 inline-block transition group-open:rotate-90">›</span>
                {subject}
              </span>
              <span className="text-slate-400 text-[11px] shrink-0">
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
                      fromUs ? 'bg-blue-50 border border-blue-200' : 'bg-slate-100'
                    }`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={`text-[11px] font-semibold ${fromUs ? 'text-blue-700' : 'text-slate-700'}`}>
                          {fromUs ? 'Vi' : m.from || 'Kunden'}
                        </span>
                        <span className="text-slate-400 text-[11px] shrink-0">{fullDate(m.at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-900 whitespace-pre-wrap break-words">
                        {text || <span className="text-slate-500 italic">(ingen text)</span>}
                      </p>
                      {m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {m.attachments.map((name, j) => (
                            <span key={j} className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 text-[10px] font-semibold break-all">
                              📎 {name}
                            </span>
                          ))}
                        </div>
                      )}
                      {m.body.trim() && m.raw.trim() !== m.body.trim() && (
                        <details className="mt-1.5">
                          <summary className="text-slate-400 text-[11px] cursor-pointer hover:text-slate-600">
                            Visa hela mejlet
                          </summary>
                          <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap break-words">{m.raw}</p>
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
