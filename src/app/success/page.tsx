'use client';

import Link from 'next/link';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

export default function SuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: NAV_BG }}>
      <div className="max-w-md w-full text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ backgroundColor: `${CORAL}20` }}
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-4">
          Välkommen ombord!
        </h1>
        <p className="text-white/60 text-base leading-relaxed mb-8">
          Din prenumeration är aktiverad. Vi börjar arbeta med din beställning direkt — du hör av oss inom kort på din e-post.
        </p>

        <div
          className="rounded-2xl p-6 mb-8 text-left"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <h2 className="text-white font-bold mb-4">Nästa steg</h2>
          <ul className="space-y-3">
            {[
              'Du får en bekräftelse via e-post från Stripe',
              'Vi sätter igång med din bokföring direkt',
              'Du hör av oss om vi behöver ytterligare information',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: CORAL, color: 'white' }}
                >
                  {i + 1}
                </span>
                <span className="text-white/70 text-sm">{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/"
          className="inline-block px-8 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
          style={{ backgroundColor: CORAL, color: 'white' }}
        >
          Tillbaka till startsidan
        </Link>
      </div>
    </div>
  );
}
