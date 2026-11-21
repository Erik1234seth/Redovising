'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import { BankradLista, type Bankrad, kortIban } from '@/components/Bankrader';

const NAV_BG = '#173b57';

/**
 * Ett bankkonto med alla dess transaktioner, nyast först — även de som inte
 * är kopplade till något underlag. Filtret visar alla, kopplade eller de som
 * saknar underlag; sökrutan letar i text, motpart och belopp.
 */

interface Konto {
  kontoHash: string;
  namn: string | null;
  iban: string | null;
  bank: string | null;
  status: 'aktiv' | 'utgangen' | 'borttagen';
  senastHamtad: string | null;
}

type Filter = 'alla' | 'kopplade' | 'saknar';

async function api(path: string, init: RequestInit = {}) {
  const { data } = await createClient().auth.getSession();
  return fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
}

const VISA_PER_SIDA = 100;

export default function BankkontoPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ konto: string }>();
  const hash = decodeURIComponent(params.konto);

  const [konto, setKonto] = useState<Konto | null>(null);
  const [rader, setRader] = useState<Bankrad[] | null>(null);
  const [fel, setFel] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('alla');
  const [sok, setSok] = useState('');
  const [antalVisade, setAntalVisade] = useState(VISA_PER_SIDA);
  const [hamtar, setHamtar] = useState(false);
  const [meddelande, setMeddelande] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  const ladda = useCallback(async () => {
    const res = await api(`/api/bank/konto?hash=${encodeURIComponent(hash)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setFel(data.error ?? 'Kunde inte hämta kontot.'); return; }
    setKonto(data.konto);
    setRader(data.rader);
  }, [hash]);

  useEffect(() => { if (user) ladda(); }, [user, ladda]);

  async function hamtaNu() {
    setHamtar(true);
    setMeddelande(null);
    const res = await api('/api/bank', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setHamtar(false);
    if (!res.ok || data.fel?.length) { setMeddelande(data.error ?? data.fel?.join(' ') ?? 'Hämtningen misslyckades.'); return; }
    setMeddelande(data.nya ? `${data.nya} nya transaktioner.` : 'Inga nya transaktioner.');
    ladda();
  }

  const antal = useMemo(() => ({
    alla: rader?.length ?? 0,
    kopplade: rader?.filter((r) => r.koppling).length ?? 0,
    saknar: rader?.filter((r) => !r.koppling).length ?? 0,
  }), [rader]);

  const filtrerade = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return (rader ?? []).filter((r) => {
      if (filter === 'kopplade' && !r.koppling) return false;
      if (filter === 'saknar' && r.koppling) return false;
      if (!q) return true;
      const belopp = String(Math.abs(r.beloppOre / 100));
      return [r.text, r.motpart, r.koppling?.text, belopp].some((x) => x?.toLowerCase().includes(q));
    });
  }, [rader, filter, sok]);

  useEffect(() => setAntalVisade(VISA_PER_SIDA), [filter, sok]);

  if (loading || !user) return null;

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="px-4 sm:px-8 pt-8 pb-12 max-w-5xl w-full">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Översikt
        </Link>

        {fel ? (
          <p className="text-sm text-rose-600 mt-6">{fel}</p>
        ) : !konto || !rader ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mt-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">{konto.namn || 'Bankkonto'}</h1>
                <p className="text-sm text-slate-400 mt-1">{[konto.bank, kortIban(konto.iban)].filter(Boolean).join(' · ')}</p>
              </div>
              {konto.status === 'aktiv' && (
                <button
                  onClick={hamtaNu}
                  disabled={hamtar}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
                  style={{ backgroundColor: NAV_BG }}
                >
                  {hamtar ? 'Hämtar…' : 'Hämta nu'}
                </button>
              )}
            </div>
            {konto.status === 'utgangen' && (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3 flex-wrap">
                Bankens medgivande har gått ut, så nya transaktioner hämtas inte.
                <Link href="/integrationer" className="font-semibold underline">Koppla om</Link>
              </div>
            )}
            {konto.status === 'borttagen' && (
              <p className="mt-4 text-sm text-slate-500">Kontot är inte kopplat längre. Transaktionerna som redan hämtats finns kvar här.</p>
            )}
            {meddelande && <p className="mt-3 text-sm text-slate-600">{meddelande}</p>}

            <section className="bg-white rounded-2xl border border-slate-200 p-6 mt-6">
              <div className="flex items-center gap-2 flex-wrap">
                {([['alla', 'Alla'], ['kopplade', 'Kopplade'], ['saknar', 'Saknar underlag']] as [Filter, string][]).map(([id, namn]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${filter === id ? 'text-white border-transparent' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    style={filter === id ? { backgroundColor: NAV_BG } : undefined}
                  >
                    {namn} <span className="opacity-70 tabular-nums">{antal[id].toLocaleString('sv-SE')}</span>
                  </button>
                ))}
                <input
                  value={sok}
                  onChange={(e) => setSok(e.target.value)}
                  placeholder="Sök text eller belopp"
                  className="ml-auto w-full sm:w-56 text-sm px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
                />
              </div>

              {filtrerade.length === 0 ? (
                <p className="text-sm text-slate-400 mt-6">Inga transaktioner här.</p>
              ) : (
                <>
                  <BankradLista rader={filtrerade.slice(0, antalVisade)} visaDetaljer />
                  {filtrerade.length > antalVisade && (
                    <button
                      onClick={() => setAntalVisade((n) => n + VISA_PER_SIDA * 5)}
                      className="mt-4 w-full text-sm font-semibold py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Visa fler ({(filtrerade.length - antalVisade).toLocaleString('sv-SE')} kvar)
                    </button>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
