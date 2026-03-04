import Image from 'next/image';
import Link from 'next/link';

const CORAL = '#E95C63';

const values = [
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    title: 'Specialiserad expertis',
    body: 'Vi gör bara en sak – redovisning för enskilda firmor. Det gör oss bättre på det än de som gör allt.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    title: 'Transparent prissättning',
    body: 'Inga dolda avgifter. Du ser priset innan du börjar och betalar exakt det – inte en krona mer.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    ),
    title: 'Snabb leverans',
    body: 'Din NE-bilaga levereras snabbt. Ingen väntan, ingen stress – vi vet att din tid är värdefull.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    ),
    title: 'Säkerhet och integritet',
    body: 'Dina uppgifter hanteras enligt GDPR med högsta säkerhet. Vi delar aldrig data med tredje part.',
  },
];

const simplifiedPoints = [
  'Enklare bokföringskrav jämfört med aktiebolag',
  'Färre obligatoriska rapporter och deklarationer',
  'Inget krav på auktoriserad revisor',
  'Betydligt lägre administrativa kostnader',
  'Vi hanterar processen – du fokuserar på din verksamhet',
];

export default function OmOssPage() {
  return (
    <div className="bg-white">

      {/* ── HERO: split ── */}
      <section className="flex flex-col lg:flex-row min-h-[460px] sm:min-h-[520px]">
        {/* Left: navy panel */}
        <div
          className="flex-1 flex items-center px-8 sm:px-12 lg:px-16 py-16"
          style={{ backgroundColor: '#173b57' }}
        >
          <div className="max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: CORAL }}>
              Om oss
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-5 leading-tight">
              Redovisning gjord för dig som driver eget
            </h1>
            <p className="text-white/70 text-base sm:text-lg leading-relaxed">
              Vi grundades med en enkel vision: göra professionell redovisning tillgänglig
              och prisvärd för alla som driver enskild firma i Sverige – utan krångel och utan onödiga kostnader.
            </p>
          </div>
        </div>

        {/* Right: photo */}
        <div className="flex-1 relative min-h-[280px] sm:min-h-[380px]">
          <Image
            src="/ChatGPT Image 4 mars 2026 09_04_31.png"
            alt="Glada småföretagare i sin verkstad"
            fill
            className="object-cover"
            priority
          />
        </div>
      </section>

      {/* ── STATS BELT ── */}
      <section className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: '100%', label: 'Fokus på enskilda firmor' },
              { value: 'Fast pris', label: 'Inga timarvoden' },
              { value: '< 5 dagar', label: 'Genomsnittlig leveranstid' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl sm:text-3xl font-extrabold text-navy-800 mb-1">{s.value}</p>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
                Vår mission
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900 mb-6 leading-snug">
                Byråkvalitet till ett rättvist pris
              </h2>
              <div className="space-y-4 text-slate-600 leading-relaxed text-[15px]">
                <p>
                  Traditionella redovisningsbyråer erbjuder samma tjänster till aktiebolag
                  och enskilda firmor – och tar ut timarvoden som snabbt blir dyra. Det är inte rimligt.
                </p>
                <p>
                  Enskilda firmor har enklare regelverk och kan utnyttja förenklad redovisning.
                  Genom att specialisera oss enbart på detta kan vi automatisera processen och
                  leverera professionell service till en bråkdel av det traditionella priset.
                </p>
                <p>
                  Du ska kunna fokusera på din verksamhet – vi tar hand om pappersarbetet.
                </p>
              </div>
            </div>

            {/* Highlight box */}
            <div className="rounded-2xl p-8 sm:p-10" style={{ backgroundColor: '#173b57' }}>
              <h3 className="text-lg font-bold text-white mb-6">
                Vad är förenklad redovisning?
              </h3>
              <p className="text-white/65 text-sm mb-6 leading-relaxed">
                Enskilda firmor med omsättning under 3 mkr kan använda förenklad redovisning
                enligt Bokföringslagen. Det innebär:
              </p>
              <ul className="space-y-3">
                {simplifiedPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: `${CORAL}22` }}
                    >
                      <svg className="w-3 h-3" style={{ color: CORAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-white/80 text-sm leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
              Varför vi
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900">
              Det vi lovar – och håller
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {values.map((v) => (
              <div
                key={v.title}
                className="bg-white rounded-2xl p-7 border border-navy-100 shadow-sm hover:shadow-md hover:border-navy-300 transition-all duration-200"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: '#173b5712' }}
                >
                  <svg className="w-6 h-6 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {v.icon}
                  </svg>
                </div>
                <h3 className="text-base font-bold text-navy-900 mb-2">{v.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#173b57' }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
            Redo att komma igång?
          </h2>
          <p className="text-white/65 mb-8 text-base sm:text-lg">
            Välj ditt paket och kom igång direkt – enkel process, fast pris, professionellt resultat.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/#packages"
              className="px-7 py-3.5 font-semibold text-navy-900 bg-white hover:bg-gray-100 rounded-full shadow transition-all duration-200 hover:scale-[1.02]"
            >
              Välj ditt paket
            </Link>
            <Link
              href="/kontakt"
              className="px-7 py-3.5 font-semibold text-white rounded-full border border-white/20 hover:bg-white/10 transition-all duration-200"
            >
              Kontakta oss
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
