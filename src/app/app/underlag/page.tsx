'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import { uploadUnderlag } from '@/lib/bokforing-underlag';

const NAV_BG = '#173b57';
const ACCEPT = '.csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg';

/**
 * Kundens underlag: allt som skickats in, via mejl eller uppladdat här, som
 * kort med förhandsbild, datum, belopp och om det är bokfört. Nya filer dras
 * in var som helst på sidan eller väljs med knappen.
 */

interface Underlag {
  id: string;
  namn: string;
  typ: string | null;
  skapad: string;
  kalla: 'mejl' | 'uppladdat';
  ovrigt: boolean;
  sidor: number;
  url: string | null;
  transaktioner: number;
  datum: string | null;
  motpart: string | null;
  beskrivning: string | null;
  belopp: number | null;
  valuta: string | null;
  bokford: boolean;
  betaldatum: string | null;
  forfallodatum: string | null;
  fakturanummer: string | null;
  ocr: string | null;
  /** Länkar till filen och dess sidor, i ordning. */
  sidlankar: string[];
  /** Bankraderna underlaget är kopplat till. */
  bank: { datum: string; belopp: number; valuta: string; text: string; konto: string | null; kontoHash: string }[];
}

type Flik = 'underlag' | 'ovrigt';

async function api(path: string, init: RequestInit = {}) {
  const { data } = await createClient().auth.getSession();
  return fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
}

const arBild = (u: Underlag) => /^image\//.test(u.typ ?? '') || /\.(jpe?g|png)$/i.test(u.namn);
const arPdf = (u: Underlag) => (u.typ ?? '').includes('pdf') || /\.pdf$/i.test(u.namn);
const filtyp = (u: Underlag) => (u.namn.split('.').pop() ?? '').toUpperCase().slice(0, 4) || 'FIL';

function kortDatum(d: string) {
  return new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function formatBelopp(b: number, valuta: string | null) {
  return b.toLocaleString('sv-SE', { style: 'currency', currency: valuta || 'SEK' });
}

function Forhandsbild({ u }: { u: Underlag }) {
  const [trasig, setTrasig] = useState(false);
  if (u.url && arBild(u) && !trasig) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={u.url} alt="" loading="lazy" onError={() => setTrasig(true)} className="w-full h-full object-cover object-top" />;
  }
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="text-[11px] font-bold tracking-wide">{arPdf(u) ? 'PDF' : filtyp(u)}</span>
    </div>
  );
}

function Kort({ u, onOppna }: { u: Underlag; onOppna: () => void }) {
  const titel = u.motpart || u.beskrivning || u.namn;
  const innehall = (
    <>
      <div className="relative h-44 border-b border-slate-100 overflow-hidden rounded-t-2xl">
        <Forhandsbild u={u} />
        {u.sidor > 1 && (
          <span className="absolute bottom-2 right-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800/75 text-white">{u.sidor} sidor</span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-semibold text-slate-500 px-2 py-0.5 rounded-md bg-slate-100 tabular-nums whitespace-nowrap">
            {u.datum ? kortDatum(u.datum) : '–'}
          </span>
          <span className="text-[15px] font-bold text-slate-800 tabular-nums text-right">
            {u.belopp !== null ? formatBelopp(u.belopp, u.valuta) : '–'}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-700 truncate" title={titel}>{titel}</p>
        {titel !== u.namn && <p className="text-xs text-slate-400 truncate" title={u.namn}>{u.namn}</p>}
        {u.bank.length > 0 && (
          <p className="text-xs text-emerald-700 truncate flex items-center gap-1" title={u.bank.map((b) => `${b.datum} ${b.text} ${formatBelopp(b.belopp, b.valuta)}`).join('\n')}>
            <BankIkon />
            Kopplad: {kortDatum(u.bank[0].datum)} · {u.bank[0].text}{u.bank.length > 1 ? ` +${u.bank.length - 1}` : ''}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 mt-auto pt-2">
          <span className="text-[11px] text-slate-400">
            {u.kalla === 'mejl' ? 'Mejlat' : 'Uppladdat'} {kortDatum(u.skapad)}
          </span>
          {!u.ovrigt && <Status u={u} />}
        </div>
      </div>
    </>
  );
  return (
    <button onClick={onOppna} className="group flex flex-col bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all text-left">
      {innehall}
    </button>
  );
}

function BankIkon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18" />
    </svg>
  );
}

function Status({ u }: { u: Underlag }) {
  return u.bokford
    ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Bokförd</span>
    : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Mottaget</span>;
}

/** Ett fält i detaljvyn. Tomt visas som ett streck, så att kunden ser att uppgiften saknas. */
function Falt({ namn, children }: { namn: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400">{namn}</p>
      <div className="text-sm text-slate-800 mt-0.5">{children || '–'}</div>
    </div>
  );
}

function Detalj({ u, onStang, onTaBort }: { u: Underlag; onStang: () => void; onTaBort: () => Promise<string | null> }) {
  const [sida, setSida] = useState(0);
  const [bekrafta, setBekrafta] = useState(false);
  const [tarBort, setTarBort] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const lank = u.sidlankar[sida] ?? u.url;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onStang(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onStang]);

  async function taBort() {
    setTarBort(true);
    setFel(await onTaBort());
    setTarBort(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={u.namn}>
      <div className="absolute inset-0 bg-slate-900/50" onClick={onStang} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-100">
          <p className="font-bold text-slate-800 truncate" title={u.namn}>{u.namn}</p>
          <button onClick={onStang} aria-label="Stäng" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Filen */}
          <div className="flex-1 min-h-[45vh] lg:min-h-0 bg-slate-100 flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center p-4">
              {!lank ? (
                <p className="text-sm text-slate-400 mt-10">Filen går inte att visa.</p>
              ) : arBild(u) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lank} alt={u.namn} className="max-w-full h-auto bg-white shadow" />
              ) : arPdf(u) ? (
                <iframe src={lank} title={u.namn} className="w-full h-full min-h-[60vh] bg-white rounded" />
              ) : (
                <div className="text-center mt-10">
                  <p className="text-sm text-slate-500">{filtyp(u)}-filer går inte att visa här.</p>
                  <a href={lank} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm font-semibold hover:underline" style={{ color: NAV_BG }}>Ladda ner filen</a>
                </div>
              )}
            </div>
            {u.sidlankar.length > 1 && (
              <div className="flex items-center justify-center gap-3 py-2 border-t border-slate-200 bg-white text-sm">
                <button onClick={() => setSida((s) => Math.max(0, s - 1))} disabled={sida === 0} className="px-3 py-1 rounded-lg disabled:opacity-30 hover:bg-slate-100">Föregående</button>
                <span className="text-slate-500 tabular-nums">Sida {sida + 1} av {u.sidlankar.length}</span>
                <button onClick={() => setSida((s) => Math.min(u.sidlankar.length - 1, s + 1))} disabled={sida === u.sidlankar.length - 1} className="px-3 py-1 rounded-lg disabled:opacity-30 hover:bg-slate-100">Nästa</button>
              </div>
            )}
          </div>

          {/* Uppgifterna */}
          <div className="w-full lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 overflow-y-auto p-5 flex flex-col gap-4">
            {!u.ovrigt && <div><Status u={u} /></div>}
            <Falt namn="Summa">
              {u.belopp !== null ? <span className="text-lg font-extrabold tabular-nums">{formatBelopp(u.belopp, u.valuta)}</span> : null}
            </Falt>
            <div className="grid grid-cols-2 gap-4">
              <Falt namn="Betaldatum">{u.betaldatum}</Falt>
              <Falt namn="Förfallodatum">{u.forfallodatum}</Falt>
            </div>
            <Falt namn="Motpart">{u.motpart}</Falt>
            <Falt namn="Beskrivning">{u.beskrivning ?? (u.transaktioner > 1 ? `${u.transaktioner} transaktioner i filen` : null)}</Falt>
            {(u.fakturanummer || u.ocr) && (
              <div className="grid grid-cols-2 gap-4">
                <Falt namn="Fakturanummer">{u.fakturanummer}</Falt>
                <Falt namn="OCR">{u.ocr}</Falt>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-slate-400">Banktransaktion</p>
              {u.bank.length === 0 ? (
                <p className="text-sm text-slate-500 mt-0.5">Inte kopplad till någon banktransaktion än.</p>
              ) : (
                <ul className="mt-1 space-y-1.5">
                  {u.bank.map((b) => (
                    <li key={`${b.kontoHash}${b.datum}${b.belopp}`}>
                      <Link href={`/bank/${encodeURIComponent(b.kontoHash)}`} className="block rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2 hover:border-emerald-300">
                        <span className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-slate-700 truncate">{b.text}</span>
                          <span className="tabular-nums text-slate-800 font-semibold whitespace-nowrap">{formatBelopp(b.belopp, b.valuta)}</span>
                        </span>
                        <span className="text-xs text-slate-500">{kortDatum(b.datum)}{b.konto ? ` · ${b.konto}` : ''}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-xs text-slate-400">{u.kalla === 'mejl' ? 'Mejlat' : 'Uppladdat'} {kortDatum(u.skapad)}{u.sidor > 1 ? ` · ${u.sidor} sidor` : ''}</p>
            {fel && <p className="text-sm text-rose-600">{fel}</p>}

            <div className="mt-auto pt-2 flex flex-col gap-2">
              {u.url && (
                <a href={u.url} target="_blank" rel="noreferrer" className="text-center text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50">
                  Öppna i ny flik
                </a>
              )}
              {u.bokford ? (
                <p className="text-xs text-slate-400">Bokförda underlag kan inte tas bort här. Hör av dig till oss om något ska ändras.</p>
              ) : !bekrafta ? (
                <button onClick={() => setBekrafta(true)} className="text-sm font-semibold px-4 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50">
                  Ta bort underlaget
                </button>
              ) : (
                <div className="rounded-xl bg-rose-50 p-3">
                  <p className="text-sm text-rose-700">Underlaget tas bort för gott, och det vi läst ur det försvinner. Det går inte att ångra.</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={taBort} disabled={tarBort} className="flex-1 text-sm font-bold px-3 py-2 rounded-lg text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60">
                      {tarBort ? 'Tar bort…' : 'Ta bort'}
                    </button>
                    <button onClick={() => setBekrafta(false)} disabled={tarBort} className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg text-slate-600 bg-white hover:bg-slate-100">
                      Avbryt
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UnderlagPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [underlag, setUnderlag] = useState<Underlag[] | null>(null);
  const [fel, setFel] = useState<string | null>(null);
  const [flik, setFlik] = useState<Flik>('underlag');
  const [sok, setSok] = useState('');
  const [drar, setDrar] = useState(false);
  const [laddarUpp, setLaddarUpp] = useState<string | null>(null);
  const [meddelande, setMeddelande] = useState<{ text: string; ok: boolean } | null>(null);
  const [valtId, setValtId] = useState<string | null>(null);
  const vald = underlag?.find((u) => u.id === valtId) ?? null;
  const stang = useCallback(() => setValtId(null), []);

  /** Tar bort det valda underlaget. Svarar med felet att visa, eller null när det gick. */
  async function taBort(id: string): Promise<string | null> {
    const res = await api(`/api/underlag?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? 'Det gick inte att ta bort underlaget.';
    setValtId(null);
    setUnderlag((lista) => lista?.filter((u) => u.id !== id) ?? null);
    setMeddelande({ text: 'Underlaget är borttaget.', ok: true });
    return null;
  }

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  const ladda = useCallback(async () => {
    const res = await api('/api/underlag');
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setUnderlag(data.underlag); setFel(null); } else setFel(data.error ?? 'Kunde inte hämta dina underlag.');
  }, []);

  useEffect(() => { if (user) ladda(); }, [user, ladda]);

  async function laddaUpp(lista: FileList | null) {
    const filer = Array.from(lista ?? []);
    if (!filer.length || laddarUpp) return;
    setMeddelande(null);
    try {
      await uploadUnderlag(filer, setLaddarUpp);
      setMeddelande({ text: filer.length === 1 ? 'Tack! Vi har tagit emot filen och går igenom den.' : `Tack! Vi har tagit emot dina ${filer.length} filer och går igenom dem.`, ok: true });
      setFlik('underlag');
      await ladda();
    } catch (err) {
      setMeddelande({ text: err instanceof Error ? err.message : 'Det gick inte att ladda upp filen. Försök igen.', ok: false });
    } finally {
      setLaddarUpp(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const antal = useMemo(() => ({
    underlag: underlag?.filter((u) => !u.ovrigt).length ?? 0,
    ovrigt: underlag?.filter((u) => u.ovrigt).length ?? 0,
  }), [underlag]);

  const visade = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return (underlag ?? []).filter((u) => (flik === 'ovrigt') === u.ovrigt).filter((u) => {
      if (!q) return true;
      return [u.namn, u.motpart, u.beskrivning, u.belopp !== null ? String(Math.abs(u.belopp)) : null].some((x) => x?.toLowerCase().includes(q));
    });
  }, [underlag, flik, sok]);

  if (loading || !user) return null;

  return (
    <div
      className="flex flex-col min-h-full bg-slate-50 relative"
      onDragOver={(e) => { e.preventDefault(); setDrar(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrar(false); }}
      onDrop={(e) => { e.preventDefault(); setDrar(false); laddaUpp(e.dataTransfer.files); }}
    >
      {drar && (
        <div className="absolute inset-3 z-20 rounded-3xl border-2 border-dashed flex items-center justify-center bg-white/80 pointer-events-none" style={{ borderColor: NAV_BG }}>
          <p className="text-lg font-bold" style={{ color: NAV_BG }}>Släpp filerna för att ladda upp</p>
        </div>
      )}

      <div className="px-4 sm:px-8 pt-8 pb-12 max-w-6xl w-full">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Underlag</h1>
            <p className="text-sm text-slate-400 mt-1.5">
              Kvitton och fakturor du skickat in via mejl eller laddat upp här.
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Vi går igenom varje underlag. När vi har gjort det syns datum, belopp och om det är kopplat till en banktransaktion.
            </p>
          </div>
          <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => laddaUpp(e.target.files)} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!!laddarUpp}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: NAV_BG }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            {laddarUpp ? 'Laddar upp…' : 'Ladda upp underlag'}
          </button>
        </div>

        {laddarUpp && <p className="mt-4 text-sm text-slate-500">Laddar upp {laddarUpp}…</p>}
        {meddelande && <p className={`mt-4 text-sm ${meddelande.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{meddelande.text}</p>}

        <div className="mt-6 flex items-center gap-2 flex-wrap border-b border-slate-200">
          {([['underlag', 'Underlag'], ['ovrigt', 'Övriga filer']] as [Flik, string][]).map(([id, namn]) => (
            <button
              key={id}
              onClick={() => setFlik(id)}
              className={`px-3 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors ${flik === id ? 'text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              style={flik === id ? { borderColor: NAV_BG } : undefined}
            >
              {namn} <span className="text-slate-400 font-medium tabular-nums">{antal[id]}</span>
            </button>
          ))}
          <input
            value={sok}
            onChange={(e) => setSok(e.target.value)}
            placeholder="Sök namn, motpart eller belopp"
            className="ml-auto mb-2 w-full sm:w-64 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
          />
        </div>

        {fel ? (
          <p className="text-sm text-rose-600 mt-6">{fel}</p>
        ) : !underlag ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visade.length === 0 ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-6 w-full rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center hover:border-slate-300"
          >
            <p className="font-bold text-slate-700">{sok ? 'Inga underlag matchar sökningen' : flik === 'ovrigt' ? 'Inga övriga filer' : 'Skicka in ditt första underlag'}</p>
            {!sok && <p className="text-sm text-slate-400 mt-1">Dra in filer hit eller klicka för att välja. PDF, bilder, Excel och CSV.</p>}
          </button>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visade.map((u) => <Kort key={u.id} u={u} onOppna={() => setValtId(u.id)} />)}
          </div>
        )}

        {flik === 'ovrigt' && antal.ovrigt > 0 && (
          <p className="text-xs text-slate-400 mt-4">
            Övriga filer är sådant som inte bokförs, till exempel kontoutdrag, avtal och brev från Skatteverket. Vi sparar dem för att kunna svara på frågor om ditt företag.
          </p>
        )}
        <p className="text-xs text-slate-400 mt-8">
          Vill du lägga in en transaktion utan underlag? <Link href="/bokforing/manuell" className="font-semibold hover:underline" style={{ color: NAV_BG }}>Lägg till manuellt</Link>
        </p>
      </div>

      {vald && <Detalj key={vald.id} u={vald} onStang={stang} onTaBort={() => taBort(vald.id)} />}
    </div>
  );
}
