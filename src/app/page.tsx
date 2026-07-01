'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { packages } from '@/data/packages';
import { useAuth } from '@/contexts/AuthContext';
import { PAYMENTS_ENABLED } from '@/lib/config';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

interface Countdown { days: number; hours: number; minutes: number; seconds: number; }

function useFakeCountdown(): Countdown | null {
  const [value, setValue] = useState<Countdown | null>(null);
  useEffect(() => {
    // Deadline = end of day, 7 days from now (23:59:59)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    deadline.setHours(23, 59, 59, 999);

    const update = () => {
      const diff = Math.max(deadline.getTime() - Date.now(), 0);
      setValue({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return value;
}


const landingFaqItems = [
  { q: 'Vem passar Enkla Bokslut för?', a: 'Enkla Bokslut är byggt för Sveriges småföretagare. Vi riktar oss till enskilda firmor utan anställd personal och med en årsomsättning på upp till 3 miljoner kronor.\n\nTyvärr passar Enkla Bokslut inte alla verksamheter. I dagsläget kan vi inte hjälpa företag som har anställd personal, bedriver skogs- eller lantbruksverksamhet, driver taxiverksamhet, använder vinstmarginalbeskattning (VMB) eller har annan verksamhet med särskilt komplexa skatte- och momsregler.' },
  { q: 'Måste jag kunna bokföring sedan tidigare?', a: 'Nej, det är hela poängen. Du väljer vad som har hänt (köp, betalning, utgift) och resten sköts automatiskt. Rätt konton, rätt moms — du behöver inte förstå hur det fungerar i bakgrunden.' },
  { q: 'Hur kan Enkla Bokslut vara så billigt?', a: 'Enkla Bokslut är utvecklat specifikt för enskilda firmor med en omsättning på upp till 3 miljoner kronor. Genom att fokusera på denna typ av verksamheter kan vi arbeta utifrån ett förenklat regelverk och undvika många av de komplexa moment som finns i större företag.\n\nSamtidigt har vi automatiserat delar av processen som traditionellt görs manuellt av redovisningskonsulter. Det innebär mindre administration, lägre kostnader och ett lägre pris för dig – utan att tumma på kvaliteten.' },
  { q: 'Följer Enkla Bokslut reglerna?', a: 'Ja. Enkla Bokslut är utvecklat för att följa K1-regelverket, som är Skatteverkets och Bokföringsnämndens förenklade regler för mindre enskilda firmor.\n\nEftersom vi enbart arbetar med enskilda firmor som omfattas av K1 har vi specialiserat oss på just dessa regler. Det innebär att vi inte bara följer regelverket – vi är experter på det.' },
  { q: 'Vad händer vid årets slut?', a: 'När året är slut guidar vi dig genom några enkla steg för att samla in de uppgifter som behövs för bokslutet. Därefter sammanställer vi din bokföring, upprättar din NE-bilaga och momsredovisning samt lämnar in uppgifterna till Skatteverket. Enkelt, smidigt och klart.' },
  { q: 'Kan jag avsluta när jag vill?', a: 'Ja, du binder dig inte. Du kan avsluta din prenumeration när som helst — inga dolda bindningstider.' },
];

function SectionDivider({ dark }: { dark?: boolean }) {
  const lineColor = dark ? 'rgba(255,255,255,0.12)' : '#e2e8f0';
  const dotColor = dark ? 'rgba(255,255,255,0.2)' : '#cbd5e1';
  const bg = dark ? NAV_BG : '#f8fafc';
  return (
    <div className="flex items-center justify-center py-5" style={{ backgroundColor: bg }}>
      <div className="flex items-center gap-4">
        <div className="h-px w-24" style={{ background: `linear-gradient(90deg, transparent, ${lineColor})` }} />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CORAL, opacity: dark ? 0.8 : 0.7 }} />
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
        </div>
        <div className="h-px w-24" style={{ background: `linear-gradient(90deg, ${lineColor}, transparent)` }} />
      </div>
    </div>
  );
}

function LandingFaq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {landingFaqItems.map((item, i) => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors"
            style={{ backgroundColor: open === i ? 'rgba(255,255,255,0.04)' : 'transparent' }}
          >
            <span className="text-sm font-semibold text-white pr-4">{item.q}</span>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
              style={{ backgroundColor: open === i ? `${CORAL}30` : 'rgba(255,255,255,0.1)' }}
            >
              <svg
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{ transform: open === i ? 'rotate(180deg)' : 'rotate(0)', color: open === i ? CORAL : 'rgba(255,255,255,0.4)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {open === i && (
            <div className="px-6 pb-5 pt-1">
              <div className="pl-4 border-l-2 text-sm leading-relaxed whitespace-pre-line" style={{ borderColor: CORAL, color: 'rgba(255,255,255,0.55)' }}>
                {item.a}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const fakeCountdown = useFakeCountdown();
  const router = useRouter();

  const handleGetStarted = () => {
    if (!PAYMENTS_ENABLED) return;
    sessionStorage.setItem('billingPeriod', billing);
    router.push('/bestall');
  };

  useEffect(() => {
    if (!loading && !user) {
      const hasSeenPopup = sessionStorage.getItem('hasSeenInfoPopup');
      if (!hasSeenPopup) {
        let variant = sessionStorage.getItem('popupVariant');
        if (!variant) {
          variant = 'no-popup';
          sessionStorage.setItem('popupVariant', variant);
          let sessionId = sessionStorage.getItem('analyticsSessionId');
          if (!sessionId) { sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; sessionStorage.setItem('analyticsSessionId', sessionId); }
          fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step: `ab_popup_${variant}`, sessionId }),
          }).catch(() => {});
        }
      }
    }
  }, [loading, user]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            "name": "Enkla Bokslut",
            "description": "Professionell årsredovisning och bokslut för enskilda firmor.",
            "url": "https://enklabokslut.se",
            "priceRange": "299 kr/mån",
            "areaServed": { "@type": "Country", "name": "Sverige" },
          })
        }}
      />

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-0 lg:gap-16 min-h-[580px] py-16 lg:py-10">

            {/* Left – text */}
            <div className="flex-1 lg:max-w-[520px] text-center lg:text-left">
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-6">
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] mb-6" style={{ color: NAV_BG }}>
                Enkelt,{' '}
                <span className="relative inline-block">
                  rätt
                  <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 120 8" fill="none" preserveAspectRatio="none">
                    <path d="M2 6 Q60 2 118 6" stroke={CORAL} strokeWidth="3" strokeLinecap="round" fill="none" />
                  </svg>
                </span>
                {' '}och till lågt fast pris!
              </h1>

              <p className="text-slate-500 text-base sm:text-lg leading-relaxed mb-8 max-w-md mx-auto lg:mx-0">
                Mejla in dina underlag. Vi sköter bokföring, årsbokslut och deklaration. Allt ingår!
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <a
                  href="#faq"
                  className="px-7 py-3.5 font-bold text-white rounded-xl shadow-lg transition-all duration-200 hover:opacity-90 hover:scale-[1.02] text-sm sm:text-base"
                  style={{ backgroundColor: NAV_BG, boxShadow: `0 8px 24px ${NAV_BG}30` }}
                >
                  Jag vill veta mer
                </a>
                <Link
                  href="/boka-mote"
                  className="px-7 py-3.5 font-semibold text-slate-600 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 text-sm sm:text-base"
                >
                  Boka möte
                </Link>
              </div>

              {/* Mini trust signals */}
              <div className="flex items-center gap-5 lg:gap-7 mt-8 justify-center lg:justify-start">
                {[
                  { value: '299 kr/mån', label: 'allt inkluderat' },
                  { value: 'Trygg och säker', label: 'bokföring' },
                  { value: '100%', label: 'fokus på enskilda firmor' },
                ].map(({ value, label }) => (
                  <div key={label} className="text-center lg:text-left">
                    <p className="text-sm lg:text-base font-extrabold" style={{ color: NAV_BG }}>{value}</p>
                    <p className="text-xs lg:text-sm text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right – photo with floating badge */}
            <div className="flex-1 w-full lg:w-auto flex justify-center lg:justify-end relative mt-10 lg:mt-0 lg:self-stretch">
              <div className="relative w-full max-w-lg lg:max-w-none lg:h-full lg:min-h-[580px]">
                {/* Photo */}
                <div className="relative w-full h-[340px] sm:h-[420px] lg:h-full lg:min-h-[580px] rounded-2xl lg:rounded-[32px] overflow-hidden">
                  <Image
                    src="/landning1.png"
                    alt="Glada småföretagare som fått hjälp med bokslut"
                    fill
                    className="object-cover object-center"
                    priority
                  />
                  {/* Subtle gradient overlay at bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>

                {/* Floating badge – bottom left */}
                <div className="absolute -bottom-4 -left-4 lg:bottom-8 lg:-left-8 bg-white rounded-2xl shadow-xl p-4 lg:p-5 flex items-center gap-3 lg:gap-4 border border-gray-100">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${NAV_BG}12` }}>
                    <svg className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs lg:text-sm font-bold" style={{ color: NAV_BG }}>299 kr/mån</p>
                    <p className="text-[11px] lg:text-xs text-slate-400">Allt inkluderat, ingen bindningstid</p>
                  </div>
                </div>

                {/* Floating badge – top right */}
                <div className="absolute -top-4 -right-4 lg:top-8 lg:-right-8 bg-white rounded-2xl shadow-xl p-3.5 lg:p-5 border border-gray-100">
                  <div className="flex items-center gap-1 lg:gap-1.5 mb-0.5 lg:mb-1">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-3 h-3 lg:w-4 lg:h-4 text-amber-400 fill-amber-400" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-[11px] lg:text-sm font-semibold" style={{ color: NAV_BG }}>Nöjda kunder</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      <div className="w-full h-px" style={{ backgroundColor: '#94a3b8' }} />

      {/* ══════════════════════════════════════════
          PACKAGES
      ══════════════════════════════════════════ */}
      <section id="packages" className="py-20 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

            {/* Left: value proposition */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 leading-tight" style={{ color: NAV_BG }}>
                Ett abonnemang. Allt ingår.
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                Vi tror att bokföring ska vara enkelt. Därför har vi bara ett abonnemang – utan paket, tillval eller dolda kostnader.<br />Du mejlar in dina underlag, vi sköter resten.
              </p>

              <div className="space-y-4 mb-10">
                {[
                  { title: 'Mejla bara in dina underlag', desc: 'Inga krångliga program eller avancerade bokföringskunskaper. Skicka underlagen via e-post – vi sköter resten.' },
                  { title: 'Fast pris', desc: 'Allt ingår. Löpande bokföring, moms, årsbokslut och deklaration till en fast månadsavgift.' },
                  { title: 'Ingen bindningstid', desc: 'Du bestämmer själv hur länge du vill vara kund.' },
                  { title: 'Byggt för enskilda firmor', desc: 'Vi gör en sak – och vi gör den riktigt bra.' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center" style={{ backgroundColor: `${NAV_BG}12` }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: NAV_BG }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: NAV_BG }}>{item.title}</p>
                      <p className="text-slate-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/boka-mote"
                className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
                style={{ color: NAV_BG }}
              >
                Har du frågor? Boka ett gratis möte →
              </Link>
            </div>

            {/* Right: pricing card */}
            {packages.map((pkg) => (
              <div key={pkg.id} className="relative rounded-2xl overflow-hidden" style={{ backgroundColor: NAV_BG, boxShadow: `0 24px 64px ${NAV_BG}40` }}>
                <div className="px-8 pt-6 pb-0 flex justify-between items-center">
                  <span className="px-3 py-1 text-xs font-bold rounded-full" style={{ backgroundColor: CORAL, color: 'white' }}>
                    ALLT INKLUDERAT
                  </span>
                </div>

                <div className="p-7 sm:p-9">
                  {/* Billing toggle */}
                  <div className="flex items-center gap-1 p-1 rounded-xl mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                    <button
                      onClick={() => setBilling('monthly')}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
                      style={billing === 'monthly'
                        ? { backgroundColor: 'white', color: NAV_BG }
                        : { color: 'rgba(255,255,255,0.5)' }
                      }
                    >
                      Månadsvis
                    </button>
                    <button
                      onClick={() => setBilling('yearly')}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5"
                      style={billing === 'yearly'
                        ? { backgroundColor: 'white', color: NAV_BG }
                        : { color: 'rgba(255,255,255,0.5)' }
                      }
                    >
                      Årsvis
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: billing === 'yearly' ? `${CORAL}20` : `${CORAL}40`, color: billing === 'yearly' ? CORAL : 'rgba(233,92,99,0.8)' }}>
                        Spara 89 kr
                      </span>
                    </button>
                  </div>

                  <div className="mb-7 pb-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                    <h3 className="text-xl font-bold mb-1 text-white">Komplett tjänst</h3>
                    <p className="text-sm mb-6 text-white/55">Du mejlar in dina underlag när det passar dig. Vi sköter den löpande bokföringen, momsredovisningen, årsbokslutet och deklarationen.</p>
                    <div className="flex items-end gap-1.5">
                      <span className="text-6xl font-extrabold text-white leading-none">
                        {billing === 'monthly' ? pkg.price.toLocaleString('sv') : pkg.yearlyPrice.toLocaleString('sv')}
                      </span>
                      <div className="mb-1">
                        <p className="text-lg font-light text-white/50">kr</p>
                        <p className="text-sm font-semibold" style={{ color: CORAL }}>
                          {billing === 'monthly' ? 'per månad' : 'per år'}
                        </p>
                      </div>
                    </div>
                    {billing === 'monthly' && (
                      <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Sprid din kostnad över året</p>
                    )}
                    {billing === 'yearly' && (
                      <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Faktureras årsvis efter inlämnad deklaration</p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {pkg.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${CORAL}30` }}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-sm leading-relaxed text-white/80">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={handleGetStarted}
                    disabled={!PAYMENTS_ENABLED}
                    className="block w-full text-center font-bold py-4 rounded-xl transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: CORAL, color: 'white', boxShadow: PAYMENTS_ENABLED ? `0 8px 20px ${CORAL}40` : 'none' }}
                  >
                    {PAYMENTS_ENABLED ? 'Kom igång →' : 'Kommer snart'}
                  </button>
                </div>
              </div>
            ))}

          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════ */}
      <section id="faq" className="py-20 sm:py-24" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Vanliga frågor</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Enklare bokföring börjar här</h2>
            <p className="text-white/50 mt-3 text-base">Få svar på de vanligaste frågorna om bokföring, bokslut och deklaration för enskild firma.</p>
          </div>
          <LandingFaq />
        </div>
      </section>

      <SectionDivider dark />

      {/* ══════════════════════════════════════════
          TRE ALTERNATIV
      ══════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Du väljer hur du jobbar</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: NAV_BG }}>
              Inget nytt system att lära sig<br />— om du inte vill
            </h2>
            <p className="text-slate-500 text-base max-w-lg mx-auto leading-relaxed">
              Oavsett om du föredrar Excel, att maila in ditt underlag eller att ha full koll i webappen — vi tar hand om resten.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Alternativ 1: Maila in */}
            <div className="relative flex flex-col rounded-3xl overflow-hidden border-2 bg-white" style={{ borderColor: `${NAV_BG}18` }}>
              <div className="absolute top-4 right-4">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                  Enklast
                </span>
              </div>
              <div className="p-7 flex flex-col flex-1">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: '#EFF6FF' }}>
                  <svg className="w-6 h-6" fill="none" stroke="#2563EB" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-extrabold mb-1" style={{ color: NAV_BG }}>Maila in</h3>
                <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Noll ny teknik</p>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Fota kvittot, bifoga fakturan — skicka ett mail till oss. Vi bokför och återkommer om vi har frågor.
                </p>
                <ul className="flex flex-col gap-2 mb-6">
                  {['Inga inloggningar att hålla reda på', 'Fungerar från din vanliga inkorg', 'Vi sköter kontering och moms'].map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-3 border-t border-slate-100">
                  <p className="text-[11px] text-slate-400">Passar dig som vill lägga noll tid på administration.</p>
                </div>
              </div>
            </div>

            {/* Alternativ 2: Excel */}
            <div className="relative flex flex-col rounded-3xl overflow-hidden border-2 bg-white" style={{ borderColor: `${NAV_BG}18` }}>
              <div className="absolute top-4 right-4">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
                  Populärt
                </span>
              </div>
              <div className="p-7 flex flex-col flex-1">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: '#ECFDF5' }}>
                  <svg className="w-6 h-6" fill="none" stroke="#059669" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-extrabold mb-1" style={{ color: NAV_BG }}>Excel / Kalkylark</h3>
                <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Fortsätt som vanligt</p>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Håller du redan koll i ett kalkylark? Skicka filen till oss — eller ladda upp den direkt så tolkar vi den automatiskt.
                </p>
                <ul className="flex flex-col gap-2 mb-6">
                  {['Behåll ditt eget kalkylark', 'Ladda upp eller maila filen', 'AI tolkar och bokför automatiskt'].map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-3 border-t border-slate-100">
                  <p className="text-[11px] text-slate-400">Passar dig som redan spårar i Excel eller Google Kalkylark.</p>
                </div>
              </div>
            </div>

            {/* Alternativ 3: Webappen */}
            <div className="relative flex flex-col rounded-3xl overflow-hidden border-2" style={{ borderColor: NAV_BG, backgroundColor: NAV_BG }}>
              <div className="absolute top-4 right-4">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
                  Full kontroll
                </span>
              </div>
              <div className="p-7 flex flex-col flex-1">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-extrabold mb-1 text-white">Webappen</h3>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>Realtid & överblick</p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Bokför direkt, se rapporter live, skapa fakturor och håll full koll på ekonomin — allt på ett ställe.
                </p>
                <ul className="flex flex-col gap-2 mb-6">
                  {['Bokföring på sekunder', 'Fakturor, rapporter och moms', 'Alltid uppdaterat i realtid'].map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke={CORAL} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Passar dig som vill ha full kontroll och överblick.</p>
                </div>
              </div>
            </div>

          </div>

          <img
            src="/Processbild2.png"
            alt="Så här fungerar det"
            className="w-full rounded-3xl shadow-2xl border border-slate-200"
          />
        </div>
      </section>

      <SectionDivider />

      {/* ══════════════════════════════════════════
          JÄMFÖRELSETABELL
      ══════════════════════════════════════════ */}
      <section className="py-20 sm:py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Varför Enkla Bokslut?</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">Se vad du sparar</h2>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-3 border-b border-slate-200">
              <div className="px-6 py-5" />
              <div className="px-6 py-5 border-l border-slate-200 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Traditionell byrå</p>
                <p className="text-2xl font-extrabold text-slate-700">5 000–15 000 kr</p>
                <p className="text-xs text-slate-400 mt-0.5">per år, exkl. moms</p>
              </div>
              <div className="px-6 py-5 border-l border-slate-200 text-center relative" style={{ backgroundColor: `${NAV_BG}08` }}>
                <div className="absolute top-0 left-0 right-0 h-1 rounded-tr-none" style={{ backgroundColor: CORAL }} />
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CORAL }}>Enkla Bokslut</p>
                <p className="text-2xl font-extrabold" style={{ color: NAV_BG }}>Från 299 kr</p>
                <p className="text-xs text-slate-400 mt-0.5">per månad, allt ingår</p>
              </div>
            </div>
            {[
              { label: 'Löpande bokföring', byrå: false, vi: true },
              { label: 'Fakturahantering', byrå: false, vi: true },
              { label: 'Momsredovisning', byrå: true, vi: true },
              { label: 'NE-bilaga', byrå: true, vi: true },
              { label: 'Resultat- & balansrapport', byrå: false, vi: true },
              { label: 'Tillgänglig dygnet runt', byrå: false, vi: true },
              { label: 'Direkt svar på frågor', byrå: false, vi: true },
              { label: 'Fast pris utan fakturerings­överraskningar', byrå: false, vi: true },
            ].map((row, i) => (
              <div key={row.label} className={`grid grid-cols-3 border-b border-slate-100 last:border-0 ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                <div className="px-6 py-4 flex items-center">
                  <span className="text-sm font-medium text-slate-700">{row.label}</span>
                </div>
                <div className="px-6 py-4 border-l border-slate-100 flex items-center justify-center">
                  {row.byrå
                    ? <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>}
                </div>
                <div className="px-6 py-4 border-l border-slate-100 flex items-center justify-center" style={{ backgroundColor: `${NAV_BG}04` }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════
          TRUST BELT
      ══════════════════════════════════════════ */}
      <section className="py-12 sm:py-16" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                ),
                title: 'Enkelt & digitalt',
                desc: 'Hela processen online – inga papper.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                ),
                title: 'Bara enskilda firmor',
                desc: 'En sak – gjord bättre än alla andra.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                ),
                title: 'Support hela vägen',
                desc: 'Vi svarar snabbt om du har frågor.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ),
                title: 'Fast pris alltid',
                desc: 'Inga timarvoden. Du vet vad det kostar.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex flex-col items-center text-center p-5 sm:p-6 lg:p-8 rounded-2xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: CORAL }}
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.icon}
                  </svg>
                </div>
                <p className="text-sm sm:text-base lg:text-lg font-bold text-white mb-1.5 lg:mb-2">{item.title}</p>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA
      ══════════════════════════════════════════ */}
      <section className="py-20 relative overflow-hidden" style={{ backgroundColor: NAV_BG }}>
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white translate-y-1/2 -translate-x-1/3" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4">
            Redo att komma igång?
          </h2>
          <p className="text-white/60 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Välj ditt paket och kom igång direkt. Snabbt, enkelt och till ett fast pris.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#packages"
              className="px-8 py-3.5 font-bold text-navy-900 bg-white hover:bg-gray-100 rounded-full shadow-lg transition-all duration-200 hover:scale-[1.02]"
            >
              Se våra paket
            </a>
            <Link
              href="/kontakt"
              className="px-8 py-3.5 font-semibold text-white rounded-full border border-white/20 hover:bg-white/10 transition-all duration-200"
            >
              Kontakta oss
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════ */}
      <section className="py-20 sm:py-24" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Kundrecensioner</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Vad våra kunder säger
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Anna Lindgren',
                role: 'Frilansfotograf',
                avatar: '/annalindgren.png',
                quote: 'Äntligen ett ställe som verkligen förstår hur det fungerar att driva enskild firma. Snabbt, tydligt och till ett pris jag faktiskt har råd med.',
              },
              {
                name: 'Marcus Eriksson',
                role: 'Webbutvecklare',
                avatar: '/markus.png',
                quote: 'Jag hade aldrig gjort bokslut själv och var lite nervös. Men det var superenkelt — de skötte allt och jag visste exakt vad det kostade från start.',
              },
              {
                name: 'Sara Berg',
                role: 'Kostrådgivare',
                avatar: '/sofia.png',
                quote: 'Rekommenderar varmt! Tok bara några dagar och NE-bilagan var klar. Slipper oroa mig inför deklarationen nu.',
              },
            ].map(({ name, role, avatar, quote }) => (
              <div
                key={name}
                className="rounded-2xl p-7 flex flex-col"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm leading-relaxed flex-1 mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  &ldquo;{quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <Image src={avatar} alt={name} width={56} height={56} className="rounded-full object-cover ring-2 ring-white/20" />
                  <div>
                    <p className="text-sm font-bold text-white">{name}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}
