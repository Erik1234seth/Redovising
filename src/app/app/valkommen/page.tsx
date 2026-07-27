'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const NAV_BG = '#173b57';
const SUCCESS = '#059669';
const SUCCESS_BG = '#ECFDF5';

export default function ValkommenPage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [slow, setSlow] = useState(false);

  const active = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing' || profile?.subscription_status === 'invoice';

  // Vänta in webhooken: uppdatera profilen tills prenumerationen är aktiv.
  useEffect(() => {
    if (active) return;
    const poll = setInterval(() => { refreshProfile(); }, 2500);
    const slowTimer = setTimeout(() => setSlow(true), 12000);
    return () => { clearInterval(poll); clearTimeout(slowTimer); };
  }, [active, refreshProfile]);

  // Innan prenumerationen registrerats: enkel aktiveringsskärm.
  if (!active) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5 text-slate-500 text-sm">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
            Aktiverar ditt konto...
          </div>
          {slow && (
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Det tar lite längre än vanligt. Du kan lämna sidan öppen — den blir klar så fort betalningen är registrerad.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Klart! Heltäckande välkomstskärm — kunden behöver inte göra något mer.
  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex items-center justify-center px-6 py-10 overflow-y-auto">
      <div className="w-full max-w-md text-center">

        <div className="relative w-24 h-24 mx-auto mb-8">
          {/* Mjuk grön ring runt bocken */}
          <div className="absolute inset-0 rounded-full" style={{ backgroundColor: SUCCESS_BG }} />
          <div
            className="absolute inset-2 rounded-full flex items-center justify-center"
            style={{ backgroundColor: SUCCESS, boxShadow: `0 10px 24px ${SUCCESS}45` }}
          >
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-extrabold mb-3" style={{ color: NAV_BG }}>
          Allt är klart!
        </h1>
        <p className="text-slate-500 text-base leading-relaxed mb-6">
          Ditt konto är skapat och färdigt. Du behöver inte göra något mer just nu —
          vi hör av oss via mail snarast och tar hand om resten.
        </p>

        {/* Bekräftelse skickad till mail */}
        <div
          className="flex items-center justify-center gap-2.5 rounded-2xl px-4 py-3.5 mb-8 mx-auto w-fit max-w-full"
          style={{ backgroundColor: 'white', border: '1px solid #e2e8f0' }}
        >
          <svg className="w-4 h-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-slate-500 leading-snug">
            Vi har skickat en bekräftelse
            {user?.email ? <> till <span className="font-semibold text-slate-700">{user.email}</span></> : ' till din mail'}
          </p>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Vill du kika runt kan du{' '}
          <button
            onClick={() => router.replace('/')}
            className="font-medium underline transition-colors hover:text-slate-600"
            style={{ color: NAV_BG }}
          >
            gå till appen
          </button>
          , men det behövs inte — det räcker att svara på vårt mail.
        </p>

      </div>
    </div>
  );
}
