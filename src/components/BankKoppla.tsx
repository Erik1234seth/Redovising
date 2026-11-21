'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

const CORAL = '#E95C63';

/**
 * Välj bank och kontotyp och skicka kunden till bankens inloggning. Samma
 * formulär på startsidan och på Integrationer; `tillbaka` säger vart kunden
 * kommer efter banken ('/' eller '/integrationer').
 */

async function api(path: string, init: RequestInit = {}) {
  const { data } = await createClient().auth.getSession();
  return fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
}

export default function BankKoppla({
  tillbaka,
  onAvbryt,
  onFel,
}: {
  tillbaka: '/' | '/integrationer';
  onAvbryt?: () => void;
  onFel: (text: string) => void;
}) {
  const [banker, setBanker] = useState<{ name: string; psu_types: string[] }[] | null>(null);
  const [valdBank, setValdBank] = useState('');
  const [psuType, setPsuType] = useState<'business' | 'personal'>('business');
  const [skickar, setSkickar] = useState(false);

  useEffect(() => {
    let avbruten = false;
    api('/api/bank/banker')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (avbruten) return;
        if (res.ok) setBanker(data.banker);
        else onFel(data.error ?? 'Kunde inte hämta bankerna.');
      })
      .catch(() => { if (!avbruten) onFel('Kunde inte hämta bankerna.'); });
    return () => { avbruten = true; };
  }, [onFel]);

  async function koppla() {
    setSkickar(true);
    const res = await api('/api/bank/koppla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank: valdBank, psu_type: psuType, tillbaka }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    onFel(data.error ?? 'Kunde inte starta kopplingen.');
    setSkickar(false);
  }

  const valdaBanken = banker?.find((b) => b.name === valdBank);

  return (
    <div className="flex flex-col gap-3">
      <select
        value={valdBank}
        onChange={(e) => setValdBank(e.target.value)}
        disabled={!banker}
        // Listan ritas av webbläsaren och följer annars datorns mörka läge
        style={{ colorScheme: 'light' }}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        <option value="" className="bg-white text-slate-500">{banker ? 'Välj bank' : 'Hämtar banker…'}</option>
        {banker?.map((b) => <option key={b.name} value={b.name} className="bg-white text-slate-800">{b.name}</option>)}
      </select>
      <div className="flex gap-2 text-sm">
        {(['business', 'personal'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setPsuType(t)}
            disabled={!!valdaBanken?.psu_types.length && !valdaBanken.psu_types.includes(t)}
            className={`px-4 py-2 rounded-xl font-semibold border transition disabled:opacity-40 ${psuType === t ? 'border-slate-700 text-slate-800' : 'border-slate-200 text-slate-400'}`}
          >
            {t === 'business' ? 'Företagskonto' : 'Privatkonto'}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={koppla}
          disabled={skickar || !valdBank}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition hover:opacity-90"
          style={{ backgroundColor: CORAL }}
        >
          {skickar ? 'Skickar dig till banken…' : 'Fortsätt till banken'}
        </button>
        {onAvbryt && (
          <button onClick={onAvbryt} disabled={skickar} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Avbryt
          </button>
        )}
      </div>
    </div>
  );
}
