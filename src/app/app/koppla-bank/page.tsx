'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import BankKoppla from '@/components/BankKoppla';

/**
 * Sidan vi länkar kunderna till när vi berättar om bankkopplingen:
 * app.enklabokslut.se/koppla-bank. Ligger utan sidomeny och låsning (se
 * BARE_PREFIXES i AppShell), så att den som inte är inloggad ser vad det
 * gäller innan den loggar in. Själva kopplingen är samma som på Integrationer,
 * och kunden kommer tillbaka dit efter banken.
 */

const CORAL = '#E95C63';
const NAV_BG = '#173b57';
const SIDAN = '/koppla-bank';

const fordelar = [
  'Du slipper ta ut och skicka kontoutdrag.',
  'Transaktionerna hämtas automatiskt varje morgon.',
  'Vi kan bara läsa. Vi kan aldrig flytta pengar eller betala något.',
];

function Bock() {
  return (
    <svg className="w-5 h-5 flex-shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Koppla() {
  const [fel, setFel] = useState<string | null>(null);
  const [kopplade, setKopplade] = useState<string[]>([]);
  const onFel = useCallback((text: string) => setFel(text), []);

  // Har kunden redan en bank kopplad säger vi det, så att ingen kopplar samma två gånger
  useEffect(() => {
    let avbruten = false;
    (async () => {
      const { data } = await createClient().auth.getSession();
      const res = await fetch('/api/bank', { headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
      if (!res.ok || avbruten) return;
      const json = await res.json().catch(() => ({}));
      const namn = (json.kopplingar ?? []).map((k: { aspsp_name: string }) => k.aspsp_name);
      if (!avbruten) setKopplade([...new Set<string>(namn)]);
    })().catch(() => {});
    return () => { avbruten = true; };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {kopplade.length > 0 && (
        <p className="text-sm text-slate-600 rounded-xl px-4 py-3" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}18` }}>
          Du har redan kopplat {kopplade.join(', ')}. Du kan koppla fler banker här eller se dina kopplingar under{' '}
          <Link href="/integrationer" className="font-semibold underline" style={{ color: NAV_BG }}>Integrationer</Link>.
        </p>
      )}
      <BankKoppla tillbaka="/integrationer" onFel={onFel} />
      {fel && <p className="text-sm text-rose-600">{fel}</p>}
    </div>
  );
}

export default function KopplaBankPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      <div className="px-4 sm:px-6 py-4" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-lg mx-auto flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: CORAL }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">Enkla Bokslut</span>
        </div>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-16">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Nyhet</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4" style={{ color: NAV_BG }}>
            Nu kan du koppla din bank
          </h1>
          <p className="text-slate-600 leading-relaxed mb-6">
            Koppla ditt bankkonto till Enkla Bokslut så hämtar vi kontots transaktioner åt dig. Det tar ungefär en minut och du godkänner hos din bank med BankID.
          </p>

          <ul className="space-y-3 mb-8">
            {fordelar.map((rad) => (
              <li key={rad} className="flex items-start gap-3 text-slate-700">
                <Bock />
                <span>{rad}</span>
              </li>
            ))}
          </ul>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7" style={{ boxShadow: `0 24px 64px ${NAV_BG}12` }}>
            <h2 className="font-bold text-lg mb-1" style={{ color: NAV_BG }}>Koppla din bank</h2>
            {loading ? (
              <div className="py-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : user ? (
              <>
                <p className="text-sm text-slate-500 mb-4">Välj din bank och om det är ett företags- eller privatkonto.</p>
                <Koppla />
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-4">Logga in på ditt konto hos oss först, så kommer du tillbaka hit och kan välja bank.</p>
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(SIDAN)}`}
                  className="flex w-full items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
                  style={{ backgroundColor: CORAL, boxShadow: `0 8px 20px ${CORAL}40` }}
                >
                  Logga in och koppla
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </>
            )}
          </div>

          <p className="text-sm text-slate-500 leading-relaxed mt-6">
            Kopplingen går via Enable Banking, en licensierad tjänst för bankdata inom EU, och fungerar med de flesta svenska banker. Medgivandet gäller i upp till 180 dagar, sedan godkänner du bara igen med BankID.{' '}
            <a href="https://enklabokslut.se/bankkoppling" className="font-semibold underline" style={{ color: NAV_BG }}>
              Läs mer om hur det går till
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
