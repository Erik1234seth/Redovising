'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import { useMainSiteUrl } from '@/lib/useMainSiteUrl';
import { BankradLista, type Bankrad, formatKr, kortIban } from '@/components/Bankrader';
import BankKoppla from '@/components/BankKoppla';

const NAV_BG = '#173b57';

/**
 * Startsidan: först det som är bra att göra (checklistan), sedan kundens
 * bankkonton och vad bankraderna är kopplade till, sist året hittills ur det
 * byrån bokfört. Allt annat finns i vänstermenyn.
 */

interface Checkpunkt { id: 'bank' | 'ombud' | 'underlag' | 'kassa'; klar: boolean; valfri?: boolean }

interface Bankkonto {
  kontoHash: string;
  namn: string | null;
  iban: string | null;
  bank: string | null;
  status: 'aktiv' | 'utgangen' | 'borttagen';
  senastHamtad: string | null;
  saldo: { belopp: number; valuta: string; datum: string } | null;
  antal: number;
  kopplade: number;
}

interface Arsoversikt {
  ar: number;
  intakter: number;
  kostnader: number;
  resultat: number;
  moms: number;
  verifikationer: number;
  manader: { manad: number; intakter: number; kostnader: number }[];
}

interface Start {
  checklista: Checkpunkt[];
  konton: Bankkonto[];
  senaste: Bankrad[];
  ar: Arsoversikt;
}

async function api(path: string, init: RequestInit = {}) {
  const { data } = await createClient().auth.getSession();
  return fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
}

function halsning() {
  const h = new Date().getHours();
  if (h < 5) return 'God natt';
  if (h < 10) return 'God morgon';
  if (h < 12) return 'God förmiddag';
  if (h < 17) return 'God eftermiddag';
  return 'God kväll';
}

const MANAD = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function hamtadText(iso: string | null) {
  if (!iso) return 'Inte hämtat än';
  const d = new Date(iso);
  const idag = new Date().toDateString() === d.toDateString();
  return `Hämtat ${idag ? 'i dag' : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
}

// ---------- Checklistan ----------

function Checklista({ punkter, onOmbud, onKopplaBank }: { punkter: Checkpunkt[]; onOmbud: () => void; onKopplaBank: () => void }) {
  const mainSite = useMainSiteUrl();
  const [visaOmbud, setVisaOmbud] = useState(false);
  const TEXT: Record<Checkpunkt['id'], { titel: string; text: string; knapp: string; href?: string }> = {
    bank: { titel: 'Koppla ditt bankkonto', text: 'Transaktionerna hämtas varje morgon, så slipper du kontoutdrag', knapp: 'Koppla' },
    ombud: { titel: 'Registrera oss som ombud hos Skatteverket', text: 'Så kan vi lämna moms och deklaration åt dig', knapp: 'Visa hur' },
    underlag: { titel: 'Skicka in ditt första underlag', text: 'Mejla kvitton och fakturor till erik@enklabokslut.se eller ladda upp dem', knapp: 'Ladda upp', href: '/underlag' },
    kassa: { titel: 'Koppla kassa eller webbutik', text: 'Zettle, Shopify eller WooCommerce, om du har', knapp: 'Koppla', href: '/integrationer' },
  };
  const kravda = punkter.filter((p) => !p.valfri);
  const klara = kravda.filter((p) => p.klar).length;
  if (punkter.every((p) => p.klar)) return null;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-bold text-slate-800 text-[17px]">Kom igång</h2>
        <span className="text-sm text-slate-400">{klara} av {kravda.length} klara</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 mt-3 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${(klara / kravda.length) * 100}%`, backgroundColor: NAV_BG }} />
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {punkter.map((p) => {
          const t = TEXT[p.id];
          return (
            <li key={p.id} className="py-3">
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${p.klar ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'}`}
                  aria-hidden="true"
                >
                  {p.klar && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${p.klar ? 'text-slate-400' : 'text-slate-800'}`}>
                    {t.titel}
                    {p.valfri && <span className="ml-2 text-[11px] font-medium text-slate-400">Valfritt</span>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.text}</p>
                </div>
                {p.klar ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 flex-shrink-0">Klar</span>
                ) : t.href ? (
                  <Link href={t.href} className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex-shrink-0">{t.knapp}</Link>
                ) : p.id === 'bank' ? (
                  <button onClick={onKopplaBank} className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex-shrink-0">
                    {t.knapp}
                  </button>
                ) : (
                  <button onClick={() => setVisaOmbud((v) => !v)} className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex-shrink-0">
                    {visaOmbud ? 'Dölj' : t.knapp}
                  </button>
                )}
              </div>
              {p.id === 'ombud' && !p.klar && visaOmbud && (
                <div className="mt-3 ml-9 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 leading-relaxed">
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Logga in på skatteverket.se med BankID</li>
                    <li>Gå till Mina sidor → Mina ombud och fullmakter</li>
                    <li>Välj Lägg till ombud och lägg in Enkla Bokslut som deklarationsombud</li>
                  </ol>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a href={`${mainSite}/ombud`} target="_blank" rel="noreferrer" className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100">Se guiden med video</a>
                    <button onClick={onOmbud} className="text-sm font-semibold px-4 py-2 rounded-xl text-white hover:opacity-90" style={{ backgroundColor: NAV_BG }}>Jag har gjort det</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- Bankkonton ----------

function Bankkonton({ konton, senaste, kopplaOppen, setKopplaOppen, meddelande, onFel }: {
  konton: Bankkonto[];
  senaste: Bankrad[];
  kopplaOppen: boolean;
  setKopplaOppen: (v: boolean) => void;
  meddelande: { text: string; ok: boolean } | null;
  onFel: (text: string) => void;
}) {
  return (
    <section id="bankkonton" className="bg-white rounded-2xl border border-slate-200 p-6 scroll-mt-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-bold text-slate-800 text-[17px]">Bankkonton</h2>
        {!kopplaOppen && (
          <button onClick={() => setKopplaOppen(true)} className="text-sm font-semibold hover:underline" style={{ color: NAV_BG }}>
            {konton.length ? 'Koppla fler' : 'Koppla bank'}
          </button>
        )}
      </div>

      {meddelande && (
        <p className={`mt-3 text-sm ${meddelande.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{meddelande.text}</p>
      )}

      {kopplaOppen && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500 mb-3">
            Välj din bank. Du loggar in hos banken med BankID och kommer sedan tillbaka hit. Vi kan bara läsa transaktionerna, aldrig flytta pengar.
          </p>
          <BankKoppla tillbaka="/" onAvbryt={() => setKopplaOppen(false)} onFel={onFel} />
        </div>
      )}

      {konton.length === 0 ? (
        <p className="text-sm text-slate-400 mt-3">
          Koppla ditt bankkonto så hämtar vi transaktionerna varje morgon och kopplar dem till dina kvitton och fakturor.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {konton.map((k) => (
            <Link
              key={k.kontoHash}
              href={`/bank/${encodeURIComponent(k.kontoHash)}`}
              className="group rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 truncate">{k.namn || 'Bankkonto'}</p>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
              <p className="text-xs text-slate-400 truncate">{[k.bank, kortIban(k.iban)].filter(Boolean).join(' · ') || ' '}</p>
              <p className="text-xl font-extrabold text-slate-800 tabular-nums mt-2">
                {k.saldo ? formatKr(k.saldo.belopp, k.saldo.valuta) : '–'}
              </p>
              <p className="text-xs mt-1">
                {k.status === 'aktiv' ? <span className="text-slate-400">{hamtadText(k.senastHamtad)}</span>
                  : k.status === 'utgangen' ? <span className="text-amber-600 font-semibold">Behöver kopplas om</span>
                  : <span className="text-slate-400">Hämtas inte längre</span>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-semibold text-emerald-700">{k.kopplade.toLocaleString('sv-SE')}</span> av {k.antal.toLocaleString('sv-SE')} transaktioner kopplade
              </p>
            </Link>
          ))}
        </div>
      )}

      {senaste.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Senast kopplade</p>
          <BankradLista rader={senaste} />
        </div>
      )}
    </section>
  );
}

// ---------- Året hittills ----------

function AretHittills({ ar }: { ar: Arsoversikt }) {
  const max = Math.max(1, ...ar.manader.flatMap((m) => [Math.abs(m.intakter), Math.abs(m.kostnader)]));
  const visade = ar.manader.slice(-12);
  const tal = [
    { namn: 'Intäkter', varde: ar.intakter },
    { namn: 'Kostnader', varde: ar.kostnader },
    { namn: 'Resultat', varde: ar.resultat, farg: ar.resultat >= 0 ? 'text-emerald-700' : 'text-rose-600' },
    { namn: ar.moms >= 0 ? 'Moms att betala' : 'Moms att få tillbaka', varde: Math.abs(ar.moms) },
  ];
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="font-bold text-slate-800 text-[17px]">Året hittills</h2>
        <span className="text-xs text-slate-400">1 jan – i dag {ar.ar} · det vi bokfört</span>
      </div>
      {ar.verifikationer === 0 ? (
        <p className="text-sm text-slate-400 mt-3">Inget är bokfört i år än. När vi bokfört dina underlag syns intäkter, kostnader och resultat här.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {tal.map((t) => (
              <div key={t.namn} className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-400">{t.namn}</p>
                <p className={`text-lg font-extrabold tabular-nums mt-0.5 ${t.farg ?? 'text-slate-800'}`}>{formatKr(t.varde)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-end gap-1.5 sm:gap-3 h-32 border-b border-slate-100">
            {visade.map((m) => (
              <div key={m.manad} className="flex-1 flex items-end justify-center gap-0.5 h-full" title={`${MANAD[m.manad - 1]}: intäkter ${formatKr(m.intakter)}, kostnader ${formatKr(m.kostnader)}`}>
                <div className="flex-1 max-w-4 rounded-t" style={{ height: `${(Math.max(0, m.intakter) / max) * 100}%`, backgroundColor: NAV_BG }} />
                <div className="flex-1 max-w-4 rounded-t bg-slate-300" style={{ height: `${(Math.max(0, m.kostnader) / max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 sm:gap-3 mt-1.5">
            {visade.map((m) => <span key={m.manad} className="flex-1 text-center text-[11px] text-slate-400">{MANAD[m.manad - 1]}</span>)}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: NAV_BG }} />Intäkter</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300" />Kostnader</span>
            <Link href="/rapporter" className="ml-auto font-semibold hover:underline" style={{ color: NAV_BG }}>Rapporter</Link>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- Sidan ----------

export default function HomePage() {
  const { user, loading, profile } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Start | null>(null);
  const [fel, setFel] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/auth/login'); return; }
    if (profile && !profile.onboarding_done) router.push('/onboarding');
  }, [user, loading, profile, router]);

  const ladda = useCallback(async () => {
    const res = await api('/api/start');
    if (res.ok) { setData(await res.json()); setFel(false); } else setFel(true);
  }, []);

  useEffect(() => {
    if (user && profile?.onboarding_done !== false) ladda();
  }, [user, profile?.onboarding_done, ladda]);

  const [kopplaOppen, setKopplaOppen] = useState(false);
  const [bankMeddelande, setBankMeddelande] = useState<{ text: string; ok: boolean } | null>(null);
  const kopplingsfel = useCallback((text: string) => setBankMeddelande({ text, ok: false }), []);

  // Tillbaka från banken: visa utfallet, rensa adressraden och gör första hämtningen
  const tillbakaHanterad = useRef(false);
  useEffect(() => {
    if (!user || tillbakaHanterad.current) return;
    const resultat = new URLSearchParams(window.location.search).get('bank');
    if (!resultat) return;
    tillbakaHanterad.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    if (resultat !== 'kopplad') {
      setBankMeddelande(resultat === 'avbruten'
        ? { text: 'Bankkopplingen avbröts. Du kan försöka igen när du vill.', ok: false }
        : { text: 'Något gick fel när banken skulle kopplas. Försök igen.', ok: false });
      return;
    }
    setBankMeddelande({ text: 'Banken är kopplad. Vi hämtar transaktionerna nu…', ok: true });
    api('/api/bank', { method: 'POST' })
      .then((res) => res.json().catch(() => ({})))
      .then((d) => setBankMeddelande(d.fel?.length
        ? { text: d.fel.join(' '), ok: false }
        : { text: `Banken är kopplad. ${d.totalt != null ? `${Number(d.totalt).toLocaleString('sv-SE')} transaktioner hämtade.` : ''}`.trim(), ok: true }))
      .catch(() => setBankMeddelande({ text: 'Banken är kopplad, men hämtningen misslyckades. Försök igen med Hämta nu på kontot.', ok: false }))
      .finally(ladda);
  }, [user, ladda]);

  function oppnaKoppla() {
    setKopplaOppen(true);
    setBankMeddelande(null);
    setTimeout(() => document.getElementById('bankkonton')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  async function ombudKlart() {
    await api('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ombud: true }) });
    setData((d) => d && { ...d, checklista: d.checklista.map((p) => (p.id === 'ombud' ? { ...p, klar: true } : p)) });
  }

  if (loading || !user || (profile && !profile.onboarding_done)) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fornamn = profile?.full_name?.split(' ')[0] ?? null;

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="px-4 sm:px-8 pt-8 pb-2 max-w-5xl w-full">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3">
          {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{halsning()}{fornamn ? `, ${fornamn}` : ''}!</h1>
      </div>

      <div className="px-4 sm:px-8 pt-6 pb-12 max-w-5xl w-full space-y-4">
        {fel && <p className="text-sm text-rose-600">Kunde inte hämta översikten. Ladda om sidan för att försöka igen.</p>}
        {!data && !fel ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data && (
          <>
            <Checklista punkter={data.checklista} onOmbud={ombudKlart} onKopplaBank={oppnaKoppla} />
            <Bankkonton
              konton={data.konton}
              senaste={data.senaste}
              kopplaOppen={kopplaOppen}
              setKopplaOppen={setKopplaOppen}
              meddelande={bankMeddelande}
              onFel={kopplingsfel}
            />
            <AretHittills ar={data.ar} />
          </>
        )}
      </div>
    </div>
  );
}
