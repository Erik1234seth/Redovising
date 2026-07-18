import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: NAV_BG }} className="border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CORAL }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[18px] leading-none tracking-tight">
                <span className="text-white/55 font-medium">Enkla </span>
                <span className="text-white font-extrabold">Bokslut</span>
              </span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-4">
              Specialister på redovisning för enskilda firmor.
              Låga priser, professionellt resultat.
            </p>
            <div className="flex flex-col items-start gap-2.5">
              <a
                href="mailto:erik@enklabokslut.se"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                erik@enklabokslut.se
              </a>
              <a
                href="https://www.facebook.com/people/Enkla-Bokslut/61591841676029/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Enkla Bokslut på Facebook"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z" />
                </svg>
                Facebook
              </a>
            </div>
            <p className="text-white/35 text-xs mt-4">
              Org.nr 559555-3586
            </p>
          </div>

          {/* Kom igång */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5">Kom igång</h3>
            <ul className="space-y-3">
              {[
                { href: '/skaffa', label: 'Priser' },
                { href: '/#hur-det-fungerar', label: 'Så fungerar det' },
                { href: '/kvalificera', label: 'Skapa konto' },
                { href: '/kontakt', label: 'Kontakt' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors">
                    <span className="w-1 h-1 rounded-full bg-white/30 group-hover:bg-white transition-colors" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kunskap */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5">Kunskap</h3>
            <ul className="space-y-3">
              {[
                { href: '/#faq', label: 'Vanliga frågor' },
                { href: '/tutorial', label: 'Guider' },
                { href: '/artiklar', label: 'Blogg' },
                { href: '/ordlista', label: 'Ordlista' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors">
                    <span className="w-1 h-1 rounded-full bg-white/30 group-hover:bg-white transition-colors" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Juridiskt */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5">Juridiskt</h3>
            <ul className="space-y-3">
              {[
                { href: '/integritetspolicy', label: 'Integritetspolicy' },
                { href: '/cookiepolicy', label: 'Cookiepolicy' },
                { href: '/anvandarvillkor', label: 'Användarvillkor' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors">
                    <span className="w-1 h-1 rounded-full bg-white/30 group-hover:bg-white transition-colors" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/35 text-xs">
            © {new Date().getFullYear()} Enkla Bokslut. Alla rättigheter förbehållna.
          </p>
          <p className="text-white/35 text-xs">
            Specialiserade på förenklad redovisning för enskilda firmor
          </p>
        </div>
      </div>
    </footer>
  );
}
