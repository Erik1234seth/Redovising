'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import FlowCheckpoints from '@/components/FlowCheckpoints';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function ValkommenPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [slow, setSlow] = useState(false);

  const active = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  // Vänta in webhooken: uppdatera profilen tills prenumerationen är aktiv.
  useEffect(() => {
    if (active) return;
    const poll = setInterval(() => { refreshProfile(); }, 2500);
    const slowTimer = setTimeout(() => setSlow(true), 12000);
    return () => { clearInterval(poll); clearTimeout(slowTimer); };
  }, [active, refreshProfile]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">

        <div className="mb-10">
          <FlowCheckpoints current={3} />
        </div>

        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ backgroundColor: `${CORAL}15`, border: `2px solid ${CORAL}30` }}
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold mb-3" style={{ color: NAV_BG }}>
          Välkommen ombord!
        </h1>
        <p className="text-slate-500 text-base leading-relaxed mb-8">
          Din betalning gick igenom och din prenumeration är på plats. Vi tar hand om bokföring, moms, bokslut och deklaration.
        </p>

        {active ? (
          <button
            onClick={() => router.replace('/')}
            className="inline-block px-8 py-4 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02]"
            style={{ backgroundColor: CORAL, boxShadow: `0 8px 20px ${CORAL}40` }}
          >
            Kom igång →
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2.5 text-slate-500 text-sm">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              Aktiverar ditt konto...
            </div>
            {slow && (
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Det tar lite längre än vanligt. Du kan lämna sidan öppen — den släpper in dig så fort betalningen är registrerad.
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
