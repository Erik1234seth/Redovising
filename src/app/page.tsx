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

export default function Home() {
  const { user, loading } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const fakeCountdown = useFakeCountdown();
  const router = useRouter();

  const handleGetStarted = () => {
    sessionStorage.setItem('billingPeriod', billing);
    router.push('/flow/komplett/qualification');
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
                  Specialiserade på enskilda firmor
                </div>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] mb-6" style={{ color: NAV_BG }}>
                Bokslut gjort{' '}
                <span className="relative inline-block">
                  rätt
                  <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 120 8" fill="none" preserveAspectRatio="none">
                    <path d="M2 6 Q60 2 118 6" stroke={CORAL} strokeWidth="3" strokeLinecap="round" fill="none" />
                  </svg>
                </span>
                <br />
                <span className="text-3xl sm:text-4xl md:text-5xl font-bold" style={{ color: '#64748b' }}>
                  utan krångel
                </span>
              </h1>

              <p className="text-slate-500 text-base sm:text-lg leading-relaxed mb-8 max-w-md mx-auto lg:mx-0">
                Förenklat årsbokslut och NE-bilaga för enskilda firmor –
                fast pris, snabb leverans och ingen onödig byrå&shy;kostnad.
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
                quote: 'Rekommenderar varmt! Tog bara några dagar och NE-bilagan var klar. Slipper oroa mig inför deklarationen nu.',
              },
            ].map(({ name, role, avatar, quote }) => (
              <div
                key={name}
                className="rounded-2xl p-7 flex flex-col"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>

                {/* Quote */}
                <p className="text-sm leading-relaxed flex-1 mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  &ldquo;{quote}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <Image
                    src={avatar}
                    alt={name}
                    width={56}
                    height={56}
                    className="rounded-full object-cover ring-2 ring-white/20"
                  />
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
                  { title: 'Inget bokföringsprogram', desc: 'Vi jobbar i ett delat kalkylark — inget dyrt program att köpa eller lära sig.' },
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

      {/* ══════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════ */}
      <section className="py-20 sm:py-24" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Så fungerar det</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Löpande bokföring — allt klart till deklarationen
            </h2>
            <p className="mt-3 text-base max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Istället för att samla ihop allt på en gång jobbar vi med dig löpande. När deklarationen ska lämnas in i maj är allt redan klart.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-9 left-[12.5%] right-[12.5%] h-px z-0" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />

            {[
              {
                step: '1',
                title: 'Du skickar transaktioner',
                desc: 'Varje månad eller kvartal skickar du in dina transaktioner enligt den struktur vi visar dig. Enkelt och tar bara några minuter.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
              },
              {
                step: '2',
                title: 'Vi bokför löpande',
                desc: 'Vi hanterar bokföringen direkt. Du slipper hög med papper och glömda kvitton när december kommer.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
              },
              {
                step: '3',
                title: 'NE-bilaga & moms klar',
                desc: 'Vid årets slut är din NE-bilaga och momsredovisning redan färdig — vi har haft allt underlag hela året.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
              },
              {
                step: '4',
                title: 'Hjälp med deklarationen',
                desc: 'Vill du ha hjälp att lämna in din deklaration också? Det fixar vi — allt finns redan hos oss.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />,
              },
            ].map((item) => (
              <div key={item.step} className="relative z-10 flex flex-col items-center text-center">
                <div
                  className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center mb-5 relative z-10"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                    {item.icon}
                  </svg>
                  <span
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center"
                    style={{ backgroundColor: CORAL, color: 'white' }}
                  >
                    {item.step}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          WHY US
      ══════════════════════════════════════════ */}
      <section className="py-20 sm:py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Varför vi</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: NAV_BG }}>
              Det vi lovar – och håller
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
                title: 'Säkert och pålitligt',
                desc: 'Dina uppgifter hanteras med högsta säkerhet och följer alla regelverk.'
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
                title: 'Snabbt och enkelt',
                desc: 'Snabb leverans av din NE-bilaga. Enkla steg-för-steg instruktioner.'
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
                title: 'Bästa priset',
                desc: 'Fokus på enskilda firmor gör att vi kan hålla priserna låga utan att tumma på kvaliteten.'
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-md hover:border-navy-200 transition-all duration-200"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200"
                  style={{ backgroundColor: `${NAV_BG}10` }}
                >
                  <svg className="w-6 h-6" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.icon}
                  </svg>
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: NAV_BG }}>{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
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

    </>
  );
}
