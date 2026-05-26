'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

function SuccessContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">

        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ backgroundColor: `${CORAL}15`, border: `2px solid ${CORAL}30` }}
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold mb-3" style={{ color: NAV_BG }}>
          Allt är klart!
        </h1>
        <p className="text-slate-500 text-base leading-relaxed mb-2">
          Tack för din beställning. Vi sätter igång direkt.
        </p>
        {email && (
          <p className="text-slate-500 text-base mb-8">
            Ett välkomstmail är på väg till{' '}
            <span className="font-semibold" style={{ color: NAV_BG }}>{email}</span>.
          </p>
        )}
        {!email && (
          <p className="text-slate-500 text-base mb-8">
            Ett välkomstmail är på väg till din inkorg.
          </p>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 text-left">
          <h2 className="font-bold text-slate-800 mb-4">Vad händer nu?</h2>
          <ul className="space-y-3">
            {[
              'Du får en betalningsbekräftelse från Stripe',
              'Vi skickar ett välkomstmail med nästa steg',
              'Vi hör av oss om vi behöver mer information',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5 text-white"
                  style={{ backgroundColor: CORAL }}
                >
                  {i + 1}
                </span>
                <span className="text-sm text-slate-600">{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/"
          className="inline-block px-8 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02]"
          style={{ backgroundColor: NAV_BG }}
        >
          Tillbaka till startsidan
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
