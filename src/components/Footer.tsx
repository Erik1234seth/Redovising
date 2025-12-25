import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-navy-900 border-t border-navy-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          <div>
            <div className="mb-4">
              <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">
                Enkla bokslut
              </span>
            </div>
            <p className="text-warm-400 text-sm leading-relaxed">
              Specialister på redovisning för enskilda firmor.
              Vi erbjuder låga priser genom att fokusera på det vi är bäst på.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-4">Våra tjänster</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-warm-400 hover:text-gold-500 transition-colors text-sm flex items-center group">
                  <span className="w-1.5 h-1.5 bg-gold-500 rounded-full mr-2 group-hover:w-2 transition-all"></span>
                  NE-Bilaga - 1499kr
                </Link>
              </li>
              <li>
                <Link href="/" className="text-warm-400 hover:text-gold-500 transition-colors text-sm flex items-center group">
                  <span className="w-1.5 h-1.5 bg-gold-500 rounded-full mr-2 group-hover:w-2 transition-all"></span>
                  Komplett tjänst - 3499kr
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-4">Snabblänkar</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/tutorial" className="text-warm-400 hover:text-gold-500 transition-colors text-sm flex items-center group">
                  <span className="w-1.5 h-1.5 bg-gold-500 rounded-full mr-2 group-hover:w-2 transition-all"></span>
                  Guider
                </Link>
              </li>
              <li>
                <Link href="/om-oss" className="text-warm-400 hover:text-gold-500 transition-colors text-sm flex items-center group">
                  <span className="w-1.5 h-1.5 bg-gold-500 rounded-full mr-2 group-hover:w-2 transition-all"></span>
                  Om oss
                </Link>
              </li>
              <li>
                <Link href="/kontakt" className="text-warm-400 hover:text-gold-500 transition-colors text-sm flex items-center group">
                  <span className="w-1.5 h-1.5 bg-gold-500 rounded-full mr-2 group-hover:w-2 transition-all"></span>
                  Kontakt
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-navy-700 pt-8">
          <div className="bg-navy-800/50 border border-navy-700 rounded-xl p-6 mb-8">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-gold-500/10 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-5 h-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">Varför så låga priser?</h4>
                <p className="text-warm-400 text-sm leading-relaxed">
                  Vi kan erbjuda dessa priser eftersom enskilda firmor kan använda
                  <span className="text-gold-500 font-semibold"> förenklad redovisning</span>, vilket gör processen mer effektiv.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center text-warm-500 text-sm">
            <p>
              © {new Date().getFullYear()} Redovisningsbyrån. Alla rättigheter förbehållna.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
