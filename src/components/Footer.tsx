import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: NAV_BG }} className="border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">

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
            <a
              href="mailto:erik@enklabokslut.se"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              erik@enklabokslut.se
            </a>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5">Våra tjänster</h3>
            <ul className="space-y-3">
              {[
                { href: '/flow/ne-bilaga/qualification', label: 'NE-Bilaga', price: '1 999 kr' },
                { href: '/flow/komplett/qualification', label: 'Komplett redovisning', price: '3 499 kr' },
              ].map(({ href, label, price }) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center justify-between text-sm text-white/55 hover:text-white transition-colors">
                    <span className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-white/30 group-hover:bg-white transition-colors" />
                      {label}
                    </span>
                    <span className="text-white/35 group-hover:text-white/60 transition-colors">{price}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5">Snabblänkar</h3>
            <ul className="space-y-3">
              {[
                { href: '/tutorial', label: 'Guider' },
                { href: '/om-oss', label: 'Om oss' },
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
