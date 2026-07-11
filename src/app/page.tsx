'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { packages } from '@/data/packages';
import { useAuth } from '@/contexts/AuthContext';
import { PAYMENTS_ENABLED } from '@/lib/config';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const monthlyFeatures = [
  'Samma låga kostnad varje månad',
  'Mejla in dina underlag',
  'Bokföring, bokslut och deklaration ingår',
  'Vi lämnar in till Skatteverket',
  'Automatisk månadsbetalning',
  'Ingen bindningstid',
];

const yearlyFeatures = [
  'Betala en gång för hela året',
  'Slipp månadsfakturor',
  'Mejla bara in dina underlag',
  'Bokföring, bokslut och deklaration ingår',
  'Vi lämnar in till Skatteverket',
  'Allt klart med en enda betalning',
];

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
  { q: 'Följer Enkla Bokslut reglerna?', a: <>Ja. Enkla Bokslut är utvecklat för att följa K1-regelverket, som är Skatteverkets och Bokföringsnämndens förenklade regler för mindre enskilda firmor (<a href="https://www4.skatteverket.se/rattsligvagledning/edition/2025.3/3213.html" target="_blank" rel="noopener noreferrer" className="underline font-medium" style={{ color: CORAL }}>skatteverket</a>).{'\n\n'}Eftersom vi enbart arbetar med enskilda firmor som omfattas av K1 har vi specialiserat oss på just dessa regler. Det innebär att vi inte bara följer regelverket – vi är experter på det.</> },
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

  const handleGetStarted = () => {
    sessionStorage.setItem('billingPeriod', billing);
    window.location.href = 'https://app.enklabokslut.se/auth/signup';
  };

  // Log QR-code landings (?ref=brev-a). Once per browser session, per code.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (!ref) return;
    const key = `qrTracked_${ref}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    fetch('/api/qr-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref }),
    }).catch(() => {});
  }, []);

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

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center sm:items-start">
                <Link
                  href="/kvalificera"
                  className="px-7 py-3.5 font-bold text-white rounded-xl shadow-lg transition-all duration-200 hover:opacity-90 hover:scale-[1.02] text-sm sm:text-base"
                  style={{ backgroundColor: NAV_BG, boxShadow: `0 8px 24px ${NAV_BG}30` }}
                >
                  Kom igång
                </Link>
                <Link
                  href="/boka-mote"
                  className="px-7 py-2.5 font-semibold text-slate-600 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 text-sm sm:text-base flex flex-col items-center justify-center leading-tight"
                >
                  <span>Boka möte</span>
                  <span className="text-xs font-normal text-slate-400">Såklart gratis</span>
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
                <div className="absolute -bottom-4 -left-4 lg:bottom-8 lg:-left-8 rounded-2xl shadow-xl flex items-center gap-3 lg:gap-4 p-4 lg:p-5" style={{ backgroundColor: NAV_BG, fontFamily: 'var(--font-inter)' }}>
                  <svg className="w-6 h-6 lg:w-7 lg:h-7 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-xs lg:text-sm font-bold text-white">Maila dina kvitton</p>
                    <p className="text-[11px] lg:text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Vi hjälper dig med resten.</p>
                  </div>
                </div>

                {/* Floating badge – top right */}
                <div className="absolute -top-4 -right-4 lg:top-8 lg:-right-8 rounded-2xl shadow-xl whitespace-nowrap flex items-center gap-3 lg:gap-4 p-4 lg:p-5" style={{ backgroundColor: NAV_BG, fontFamily: 'var(--font-inter)' }}>
                  <svg className="w-6 h-6 lg:w-7 lg:h-7 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs lg:text-sm font-bold text-white">Bokföring utan krångel</p>
                    <p className="text-[11px] lg:text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>Vi guidar dig hela vägen.</p>
                  </div>
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
                  { title: 'Mejla bara in dina underlag', desc: 'Inga krångliga program eller avancerade bokföringskunskaper.' },
                  { title: 'Fast pris', desc: 'Allt ingår. Löpande bokföring, moms, årsbokslut och deklaration.' },
                  { title: 'Ingen bindningstid', desc: 'Du bestämmer själv hur länge du vill vara kund.' },
                  { title: 'Byggt för enskilda firmor', desc: 'Vi gör en sak – och vi gör den riktigt bra.' },
                  { title: 'Lågt pris av en anledning', desc: 'Enkel process, automatisering och bara det som behövs!' },
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
                        Betala efter bokslut
                      </span>
                    </button>
                  </div>

                  <div className="mb-7 pb-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                    <h3 className="text-xl font-bold mb-1 text-white">{billing === 'monthly' ? 'Månadsvis' : 'Årsvis'}</h3>
                    <p className="text-sm mb-6 text-white/55">
                      {billing === 'monthly'
                        ? 'Perfekt om du vill fördela kostnaden över året istället för att betala allt på en gång.'
                        : 'Passar dig som vill betala en gång och sedan vara klar för hela året.'}
                    </p>
                    <div className="flex items-end gap-1.5">
                      <span className="text-6xl font-extrabold text-white leading-none">
                        {billing === 'monthly' ? pkg.price.toLocaleString('sv') : pkg.yearlyPrice.toLocaleString('sv')}
                      </span>
                      <div className="mb-1">
                        <p className="text-sm font-semibold" style={{ color: CORAL }}>
                          {billing === 'monthly' ? 'kr/månad' : 'kr/år'}
                        </p>
                        <p className="text-xs text-white/40">(exkl. moms)</p>
                      </div>
                    </div>
                    {billing === 'monthly' && (
                      <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Sprid din kostnad över året</p>
                    )}
                    {billing === 'yearly' && (
                      <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Faktureras när bokslut och deklaration är färdigställda.</p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {(billing === 'monthly' ? monthlyFeatures : yearlyFeatures).map((feature) => (
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
                    className="block w-full text-center font-bold py-4 rounded-xl transition-all duration-200 text-sm"
                    style={{ backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 20px ${CORAL}40` }}
                  >
                    {PAYMENTS_ENABLED ? 'Kom igång →' : 'Skapa konto'}
                  </button>
                </div>
              </div>
            ))}

          </div>
        </div>
      </section>

      <div className="w-full h-px" style={{ backgroundColor: '#94a3b8' }} />

      {/* ══════════════════════════════════════════
          VARFÖR SÅ BILLIGT
      ══════════════════════════════════════════ */}
      <section id="billigt" className="py-20 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: CORAL }}>Prisvärt av en anledning</p>
          <div className="mb-14 sm:ml-16 lg:ml-32 lg:pl-[38px]">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: NAV_BG }}>
              Hur kan EnklaBokslut vara så billiga?
            </h2>
            <p className="text-slate-500 text-base max-w-2xl leading-relaxed">
              Lägre pris betyder inte lägre kvalitet. Hos EnklaBokslut granskas all bokföring och varje deklaration av en redovisningskonsult innan något skickas till Skatteverket. Det lägre priset beror inte på att vi gör mindre eller inte följer regler – utan på att vi arbetar smartare. Genom modern teknik, standardiserade processer och ett tydligt fokus på en specifik målgrupp kan vi erbjuda professionell redovisning till ett betydligt lägre pris.
            </p>
          </div>

          <div className="space-y-5">
            {[
              {
                title: 'Förenklade regler ger lägre pris',
                paragraphs: [
                  <>Enskilda firmor med en omsättning på högst 3 miljoner kronor har rätt att upprätta ett förenklat årsbokslut (<a href="https://www4.skatteverket.se/rattsligvagledning/edition/2025.3/3213.html" target="_blank" rel="noopener noreferrer" className="underline font-medium" style={{ color: CORAL }}>skatteverket</a>). Det innebär att de får använda enklare redovisningsregler och flera praktiska förenklingar jämfört med företag som måste upprätta ett vanligt årsbokslut eller en årsredovisning.</>,
                  'EnklaBokslut är utvecklat specifikt för dessa företag. Genom att anpassa våra arbetssätt efter de förenklade reglerna kan vi arbeta mer effektivt och erbjuda professionell redovisning till ett betydligt lägre pris.',
                ],
              },
              {
                title: 'Smart teknik och standardiserade arbetssätt',
                paragraphs: [
                  'Vi använder modern teknik och standardiserade arbetssätt där det är möjligt. Genom att automatisera återkommande moment och arbeta enligt väl genomtänkta processer kan vi lägga mindre tid på administration och mer tid på att säkerställa att din redovisning blir korrekt. Det gör att vi kan erbjuda ett lägre pris utan att kompromissa med kvaliteten.',
                ],
              },
              {
                title: 'Specialiserade på en tydlig målgrupp',
                paragraphs: [
                  'EnklaBokslut är utvecklat för enskilda firmor med ett redovisningsflöde som går att standardisera. Vi hjälper därför inte verksamheter med mer komplex redovisning, till exempel företag med anställda, omfattande lagerhantering eller andra behov som kräver mer individuell hantering.',
                  'Genom att fokusera på företag med liknande förutsättningar kan vi arbeta enligt tydliga och effektiva processer. Det gör att vi kan erbjuda professionell redovisning till ett lägre pris.',
                ],
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl p-7 sm:p-8 border border-slate-200 bg-slate-50 flex gap-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${CORAL}18` }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: NAV_BG }}>{item.title}</h3>
                  <div className="space-y-3">
                    {item.paragraphs.map((p, i) => (
                      <p key={i} className="text-slate-500 text-sm leading-relaxed">{p}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="w-full h-px" style={{ backgroundColor: '#94a3b8' }} />

      {/* ══════════════════════════════════════════
          TRE ALTERNATIV
      ══════════════════════════════════════════ */}
      <section id="hur-det-fungerar" className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <img
            src="/Processbild2.png"
            alt="Så här fungerar det"
            className="w-full rounded-3xl shadow-2xl border border-slate-200"
          />
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
