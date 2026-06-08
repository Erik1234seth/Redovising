'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { packages } from '@/data/packages';
import { useAuth } from '@/contexts/AuthContext';

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

type AppTab = 'bokforing' | 'fakturor' | 'rapporter' | 'hjalp';

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
  const [activeTab, setActiveTab] = useState<AppTab>('bokforing');
  const [tabPaused, setTabPaused] = useState(false);
  const fakeCountdown = useFakeCountdown();
  const router = useRouter();

  const tabs: AppTab[] = ['bokforing', 'rapporter', 'fakturor', 'hjalp'];
  useEffect(() => {
    if (tabPaused) return;
    const id = setInterval(() => {
      setActiveTab(prev => {
        const i = tabs.indexOf(prev);
        return tabs[(i + 1) % tabs.length];
      });
    }, 4000);
    return () => clearInterval(id);
  }, [tabPaused]);

  const handleTabClick = (tab: AppTab) => {
    setActiveTab(tab);
    setTabPaused(true);
  };

  const handleGetStarted = () => {
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
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold"
                  style={{ backgroundColor: `${CORAL}15`, color: CORAL }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: CORAL }} />
                  Bokslut för enskilda firmor
                </div>
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
                Förenklat årsbokslut, momsredovisning och NE-bilaga för enskilda firmor – fast pris, snabb leverans och ingen onödig byrå&shy;kostnad.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <a
                  href="#packages"
                  className="px-7 py-3.5 font-bold text-white rounded-xl shadow-lg transition-all duration-200 hover:opacity-90 hover:scale-[1.02] text-sm sm:text-base"
                  style={{ backgroundColor: NAV_BG, boxShadow: `0 8px 24px ${NAV_BG}30` }}
                >
                  Se priset
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
                  { value: 'Trygg', label: 'bokföring' },
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
                    src="/hero-enkla-bokslut.png"
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


      <SectionDivider />

      {/* ══════════════════════════════════════════
          PACKAGES
      ══════════════════════════════════════════ */}
      <section id="packages" className="py-20 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: value proposition */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Pris</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 leading-tight" style={{ color: NAV_BG }}>
                Ett pris.<br />Allt inkluderat.
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                Vi erbjuder ett enda abonnemang — för att hålla det enkelt. Du behöver inte välja rätt paket eller oroa dig för att du köper fel. Allt ingår.
              </p>

              <div className="space-y-4 mb-10">
                {[
                  { title: 'Ingen bindningstid', desc: 'Avsluta abonnemanget när du vill, utan förklaring.' },
                  { title: 'Inga andra program behövs', desc: 'Allt du behöver för bokslut, moms och deklaration — inget dyrt program att köpa eller lära sig.' },
                  { title: 'Fast månadsavgift', desc: 'Inga timarvoden, inga tilläggsavgifter. Du vet alltid vad det kostar.' },
                  { title: '100% fokus på enskilda firmor', desc: 'Vi specialiserar oss på en sak — och gör den bra.' },
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
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Löpande abonnemang</span>
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
                    <h3 className="text-xl font-bold mb-1 text-white">{pkg.name}</h3>
                    <p className="text-sm mb-6 text-white/55">Du skickar in dina transaktioner löpande — vi sköter resten. I slutet av året är NE-bilaga och momsredovisning redo.</p>
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
                    {billing === 'yearly' && (
                      <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>≈ 292 kr/mån — du faktureras en gång per år</p>
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
                    className="block w-full text-center font-bold py-4 rounded-xl transition-all duration-200 hover:scale-[1.02] text-sm"
                    style={{ backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 20px ${CORAL}40` }}
                  >
                    Kom igång →
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
      <section className="py-20 sm:py-24" style={{ backgroundColor: NAV_BG }}>
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
          APP PREVIEW
      ══════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Rubrik */}
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Hur det ser ut</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: NAV_BG }}>
              Allt ingår – från kontering<br />till färdiga bokslut
            </h2>
            <p className="text-slate-500 text-base max-w-xl mx-auto leading-relaxed">
              Du sköter din löpande bokföring och vi ser till att allt stämmer. Vid årets slut är NE-bilaga, momsredovisning och bokslut redan klara.
            </p>

            {/* Allt ingår-pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {['Bokföring', 'Fakturor', 'Momsredovisning', 'NE-bilaga', 'Rapporter'].map(f => (
                <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${NAV_BG}10`, color: NAV_BG }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Tabs + Mockup */}
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200" style={{ backgroundColor: '#fff' }}>

            {/* Webbläsar-chrome */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200" style={{ backgroundColor: '#f1f3f5' }}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-3 bg-white rounded-md px-3 py-1.5 text-[11px] text-slate-400 border border-slate-200 font-mono">
                app.enklabokslut.se
              </div>
            </div>

            {/* Tab-rad */}
            <div className="flex border-b border-slate-200 bg-slate-50">
              {([
                { id: 'bokforing', label: 'Bokföring' },
                { id: 'rapporter', label: 'Rapporter & Bokslut' },
                { id: 'fakturor', label: 'Fakturor' },
                { id: 'hjalp', label: 'Hjälp & Support' },
              ] as { id: AppTab; label: string }[]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className="flex-1 px-4 py-3.5 text-sm font-semibold transition-all duration-150 border-b-2 hover:bg-white cursor-pointer"
                  style={{
                    borderBottomColor: activeTab === tab.id ? CORAL : 'transparent',
                    color: activeTab === tab.id ? CORAL : '#64748b',
                    backgroundColor: activeTab === tab.id ? '#fff' : 'transparent',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Mockup-innehåll */}
            <style>{`
              @keyframes tabFadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              .tab-content { animation: tabFadeIn 0.3s ease forwards; }
              @keyframes tabProgress {
                from { width: 0%; }
                to   { width: 100%; }
              }
              .tab-progress { animation: tabProgress 2.5s linear forwards; }
            `}</style>
            <div className="flex flex-col lg:flex-row min-h-[420px]">

              {/* Vänster: UI-mockup */}
              <div className="flex-1 p-6 lg:p-8 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-hidden">
                <div key={activeTab} className="tab-content">

                {activeTab === 'bokforing' && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-slate-400 mb-1">Bokföring</p>
                    <p className="text-base font-extrabold text-slate-800 tracking-tight mb-3">Vad har hänt?</p>
                    {[
                      { label: 'Jag fick betalt av en kund', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', color: '#ECFDF5', iconColor: '#059669' },
                      { label: 'Jag köpte något till företaget', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', color: '#EFF6FF', iconColor: '#2563EB' },
                      { label: 'Privata pengar in eller ut', icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4', color: '#F5F3FF', iconColor: '#7C3AED' },
                      { label: 'Ladda upp transaktionslista', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12', color: '#ECFEFF', iconColor: '#0891B2' },
                    ].map(c => (
                      <div key={c.label} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-slate-200">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.color }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: c.iconColor }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={c.icon} /></svg>
                        </div>
                        <span className="text-xs font-medium text-slate-700">{c.label}</span>
                        <svg className="w-3.5 h-3.5 text-slate-300 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    ))}
                    <div className="mt-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="grid px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wide" style={{ gridTemplateColumns: '80px 1fr 80px' }}>
                        <span>Datum</span><span>Beskrivning</span><span className="text-right">Belopp</span>
                      </div>
                      {[
                        { desc: 'Kontorsmaterial', belopp: '−450 kr', date: '2026-05-28', neg: true },
                        { desc: 'Kund AB – faktura #42', belopp: '+12 500 kr', date: '2026-05-26', neg: false },
                        { desc: 'Mobilabonnemang', belopp: '−299 kr', date: '2026-05-25', neg: true },
                      ].map(t => (
                        <div key={t.desc} className="grid px-4 py-2 border-b border-slate-50 last:border-0 text-[11px]" style={{ gridTemplateColumns: '80px 1fr 80px' }}>
                          <span className="text-slate-400">{t.date}</span>
                          <span className="text-slate-700 truncate">{t.desc}</span>
                          <span className="text-right font-medium" style={{ color: t.neg ? '#ef4444' : '#059669' }}>{t.belopp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'fakturor' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-base font-extrabold text-slate-800 tracking-tight">Fakturor</p>
                        <p className="text-[10px] text-slate-400">Skapa och hantera dina kundfakturor</p>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ backgroundColor: NAV_BG }}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        Ny faktura
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="grid px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wide" style={{ gridTemplateColumns: '70px 1fr 90px 70px' }}>
                        <span>Faktura nr</span><span>Kund</span><span className="text-right">Belopp</span><span className="text-right">Status</span>
                      </div>
                      {[
                        { nr: '2026-014', kund: 'Kund AB', belopp: '12 500 kr', status: 'Obetald', stBg: '#FEF9C3', stColor: '#A16207' },
                        { nr: '2026-013', kund: 'Design Studio', belopp: '8 750 kr', status: 'Betald', stBg: '#DCFCE7', stColor: '#166534' },
                        { nr: '2026-012', kund: 'Företag AB', belopp: '4 250 kr', status: 'Betald', stBg: '#DCFCE7', stColor: '#166534' },
                        { nr: '2026-011', kund: 'Konsult & Co', belopp: '21 875 kr', status: 'Försenad', stBg: '#FEE2E2', stColor: '#991B1B' },
                      ].map(f => (
                        <div key={f.nr} className="grid px-4 py-2.5 border-b border-slate-50 last:border-0 items-center text-[11px]" style={{ gridTemplateColumns: '70px 1fr 90px 70px' }}>
                          <span className="font-semibold text-slate-700">{f.nr}</span>
                          <span className="text-slate-600 truncate">{f.kund}</span>
                          <span className="text-right font-semibold text-slate-700">{f.belopp}</span>
                          <span className="text-right">
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold" style={{ backgroundColor: f.stBg, color: f.stColor }}>{f.status}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'rapporter' && (
                  <div className="space-y-2">
                    <p className="text-base font-extrabold text-slate-800 tracking-tight mb-3">Rapporter & Bokslut</p>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Rapporter-kort */}
                      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <p className="text-sm font-extrabold text-slate-800 mb-1">Rapporter</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed mb-3">Alltid uppdaterat.</p>
                        <div className="space-y-1.5">
                          {[{ label: 'Resultatrapport', color: '#059669' }, { label: 'Balansrapport', color: '#2563EB' }, { label: 'Momsredovisning', color: '#D97706' }, { label: 'Transaktionslista', color: '#0891B2' }].map(r => (
                            <div key={r.label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />{r.label}
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto pt-3 text-[10px] font-semibold text-blue-600 flex items-center gap-1">Öppna rapporter <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg></div>
                      </div>
                      {/* Bokslut-kort */}
                      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        </div>
                        <p className="text-sm font-extrabold text-slate-800 mb-1">Bokslut</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed mb-3">Steg-för-steg till inlämnad deklaration.</p>
                        <div className="space-y-1.5">
                          {['Stäm av transaktioner', 'Kontrollera moms', 'Ladda ned NE-bilaga', 'Lämna in deklaration'].map((r, i) => (
                            <div key={r} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                              <div className="w-4 h-4 rounded-full border border-emerald-300 flex items-center justify-center text-emerald-600 flex-shrink-0" style={{ fontSize: 8 }}>{i + 1}</div>{r}
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto pt-3 text-[10px] font-semibold text-emerald-600 flex items-center gap-1">Starta bokslut <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg></div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'hjalp' && (
                  <div className="space-y-3">
                    {/* Hero-sektion */}
                    <div className="rounded-xl px-4 py-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAV_BG} 0%, #1e5278 100%)` }}>
                      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10" style={{ background: CORAL }} />
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold mb-2" style={{ backgroundColor: `${CORAL}28`, color: CORAL, border: `1px solid ${CORAL}30` }}>
                        Hjälp & support
                      </div>
                      <p className="text-lg font-extrabold text-white mb-1">Vi hjälper dig</p>
                      <p className="text-[10px] text-white/55 mb-3">Alltid någon att fråga, guider och svar.</p>
                      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgba(255,255,255,0.35)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Sök bland guider och frågor...</span>
                      </div>
                    </div>
                    {/* Guider */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { title: 'Kom igång med bokföring', color: '#2563EB', bg: '#EFF6FF', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
                        { title: 'Skapa din första faktura', color: '#D97706', bg: '#FFFBEB', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                        { title: 'Förstå dina rapporter', color: '#059669', bg: '#ECFDF5', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                        { title: 'Lager & Inventarier', color: '#7C3AED', bg: '#F5F3FF', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
                      ].map(g => (
                        <div key={g.title} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <div className="h-0.5 w-full" style={{ background: g.color }} />
                          <div className="p-3 flex items-start gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: g.bg }}>
                              <svg style={{ color: g.color, width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={g.icon} /></svg>
                            </div>
                            <p className="text-[10px] font-bold text-slate-800 leading-snug">{g.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* FAQ preview */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {['Hur bokför jag ett köp?', 'Hur skapar jag en faktura?', 'Vad är en NE-bilaga?'].map((q, i) => (
                        <div key={q} className={`flex items-center justify-between px-4 py-2.5 text-[11px] ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                          <span className="text-slate-700 font-medium">{q}</span>
                          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>

              {/* Höger: beskrivning */}
              <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 p-6 lg:p-8 flex flex-col justify-between">
                <div key={activeTab} className="tab-content">
                  {activeTab === 'bokforing' && <>
                    <h3 className="text-lg font-extrabold mb-3" style={{ color: NAV_BG }}>Enkel löpande bokföring</h3>
                    <ul className="space-y-2.5">
                      {['Lägg in köp och intäkter på sekunder', 'Ladda upp kvitto – rätt uppgifter fylls i automatiskt', 'Rätt konton sätts automatiskt', 'Full historik och sökbar transaktionslista'].map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>}
                  {activeTab === 'fakturor' && <>
                    <h3 className="text-lg font-extrabold mb-3" style={{ color: NAV_BG }}>Proffsiga fakturor</h3>
                    <ul className="space-y-2.5">
                      {['Skapa och skicka faktura direkt via mail', 'Spara kunder och produkter', 'PDF med din logotyp och info', 'Automatisk bokföring när fakturan skapas'].map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>}
                  {activeTab === 'rapporter' && <>
                    <h3 className="text-lg font-extrabold mb-3" style={{ color: NAV_BG }}>Rapporter & Bokslut</h3>
                    <ul className="space-y-2.5">
                      {['Resultat- och balansrapport alltid uppdaterad', 'NE-bilaga redo att lämna in till Skatteverket', 'Momsredovisning per period', 'Exportera allt som PDF'].map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>}
                  {activeTab === 'hjalp' && <>
                    <h3 className="text-lg font-extrabold mb-3" style={{ color: NAV_BG }}>Hjälp när du behöver</h3>
                    <ul className="space-y-2.5">
                      {['Alltid någon att fråga – dygnet runt, direkt svar', 'Guidar dig rätt i varje steg', 'Förklarar momsregler och kontoplanen på enkelt sätt', 'FAQ med vanliga frågor för enskilda firmor'].map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>}
                </div>

                {/* CTAs */}
                <div className="mt-8 space-y-3">
                  <button
                    onClick={handleGetStarted}
                    className="w-full py-3 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: CORAL, boxShadow: `0 4px 14px ${CORAL}40` }}
                  >
                    Testa 14 dagar gratis →
                  </button>
                  <Link
                    href="/boka-mote"
                    className="w-full py-3 text-sm font-semibold rounded-xl border-2 flex items-center justify-center transition-colors hover:bg-slate-50"
                    style={{ borderColor: NAV_BG, color: NAV_BG }}
                  >
                    Boka gratis demo
                  </Link>
                </div>
              </div>

            </div>
          </div>
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
