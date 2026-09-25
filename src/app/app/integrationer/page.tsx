'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

interface ZettleStatus {
  kopplad: boolean;
  status: 'aktiv' | 'utgangen' | null;
  kopplad_at: string | null;
  senast_synkad_at: string | null;
  senaste_fel: string | null;
}

const RESULTAT: Record<string, { text: string; ok: boolean }> = {
  kopplad: { text: 'Zettle är kopplat! Vi hämtar din försäljning nu.', ok: true },
  avbruten: { text: 'Kopplingen avbröts. Du kan försöka igen när du vill.', ok: false },
  fel: { text: 'Något gick fel när Zettle skulle kopplas. Försök igen.', ok: false },
};

function formatTid(iso: string | null) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Appens API-anrop bär sessionen, så servern vet vilken kund det gäller. */
async function api(path: string, init: RequestInit = {}) {
  const { data } = await createClient().auth.getSession();
  return fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${data.session?.access_token ?? ''}` },
  });
}

export default function IntegrationerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [zettle, setZettle] = useState<ZettleStatus | null>(null);
  const [busy, setBusy] = useState<'koppla' | 'synka' | 'koppla-bort' | null>(null);
  const [meddelande, setMeddelande] = useState<{ text: string; ok: boolean } | null>(null);
  const startadSynk = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  const laddaStatus = useCallback(async () => {
    const res = await api('/api/zettle');
    if (res.ok) setZettle(await res.json());
  }, []);

  const synka = useCallback(async () => {
    setBusy('synka');
    try {
      const res = await api('/api/zettle', { method: 'POST' });
      const data = await res.json();
      setMeddelande(res.ok
        ? { text: `Klart! ${data.kop} köp hämtade och ${data.dagar} dagar bokförda.`, ok: true }
        : { text: data.error ?? 'Hämtningen misslyckades.', ok: false });
    } catch {
      setMeddelande({ text: 'Hämtningen misslyckades.', ok: false });
    }
    setBusy(null);
    laddaStatus();
  }, [laddaStatus]);

  useEffect(() => {
    if (!user) return;
    laddaStatus();

    // Tillbaka från Zettle: visa utfallet, rensa adressraden och gör första hämtningen
    const resultat = new URLSearchParams(window.location.search).get('zettle');
    if (resultat && RESULTAT[resultat]) {
      setMeddelande(RESULTAT[resultat]);
      window.history.replaceState(null, '', window.location.pathname);
      if (resultat === 'kopplad' && !startadSynk.current) {
        startadSynk.current = true;
        synka();
      }
    }
  }, [user, laddaStatus, synka]);

  async function koppla() {
    setBusy('koppla');
    const res = await api('/api/zettle/koppla', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setMeddelande({ text: data.error ?? 'Kunde inte starta kopplingen.', ok: false });
    setBusy(null);
  }

  async function kopplaBort() {
    if (!window.confirm('Koppla bort Zettle? Det som redan är bokfört ligger kvar.')) return;
    setBusy('koppla-bort');
    await api('/api/zettle/koppla', { method: 'DELETE' });
    setMeddelande(null);
    setBusy(null);
    laddaStatus();
  }

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const utgangen = zettle?.status === 'utgangen';

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="px-8 pt-12 pb-6">
        <p className="text-sm font-medium text-slate-400 mb-1">Integrationer</p>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Koppla dina system</h1>
        <p className="text-slate-400 text-sm mt-2">Koppla ditt kassasystem så hämtar vi försäljningen automatiskt varje morgon.</p>
      </div>

      <div className="px-8 pb-12 max-w-2xl flex flex-col gap-5">
        {meddelande && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${meddelande.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {meddelande.text}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-extrabold text-lg" style={{ backgroundColor: NAV_BG }}>
              Z
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-800 text-[15px]">Zettle</p>
                {zettle?.kopplad && !utgangen && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Kopplad</span>
                )}
                {utgangen && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Behöver kopplas om</span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-0.5 leading-snug">
                Försäljning per momssats, betalsätt, avgifter och utbetalningar bokförs som en dagskassa per dag.
              </p>

              {zettle?.kopplad && (
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Kopplad</dt>
                    <dd className="text-slate-700 mt-0.5">{formatTid(zettle.kopplad_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Senast hämtad</dt>
                    <dd className="text-slate-700 mt-0.5">{formatTid(zettle.senast_synkad_at)}</dd>
                  </div>
                </dl>
              )}
              {zettle?.senaste_fel && !meddelande && (
                <p className="mt-3 text-sm text-rose-600">{zettle.senaste_fel}</p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {(!zettle?.kopplad || utgangen) && (
                  <button
                    onClick={koppla}
                    disabled={busy !== null || zettle === null}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition hover:opacity-90"
                    style={{ backgroundColor: CORAL }}
                  >
                    {busy === 'koppla' ? 'Skickar dig till Zettle…' : utgangen ? 'Koppla om Zettle' : 'Koppla Zettle'}
                  </button>
                )}
                {zettle?.kopplad && !utgangen && (
                  <button
                    onClick={synka}
                    disabled={busy !== null}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition hover:opacity-90"
                    style={{ backgroundColor: NAV_BG }}
                  >
                    {busy === 'synka' ? 'Hämtar…' : 'Hämta nu'}
                  </button>
                )}
                {zettle?.kopplad && (
                  <button
                    onClick={kopplaBort}
                    disabled={busy !== null}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 transition"
                  >
                    Koppla bort
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {zettle?.kopplad && !utgangen && (
          <p className="text-xs text-slate-400 leading-relaxed px-1">
            Skicka inte in Zettle-exporter som underlag nu när kontot är kopplat — då bokförs försäljningen dubbelt.
          </p>
        )}
      </div>
    </div>
  );
}
