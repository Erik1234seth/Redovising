'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { packages } from '@/data/packages';
import FlowCheckpoints from '@/components/FlowCheckpoints';
import { useMainSiteUrl } from '@/lib/useMainSiteUrl';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const features = [
  'Mejla bara in dina underlag',
  'Löpande bokföring',
  'Årsbokslut, moms och deklaration',
  'Vi lämnar in till Skatteverket',
  'Ingen bindningstid',
];

export default function BetalningPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const mainSiteUrl = useMainSiteUrl();
  const pkg = packages[0];

  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Redan betalat? Skicka in i appen.
  useEffect(() => {
    if (!loading && profile && (profile.subscription_status === 'active' || profile.subscription_status === 'trialing')) {
      router.replace('/');
    }
  }, [loading, profile, router]);

  const handlePay = async () => {
    if (!user) { router.push('/auth/login'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: billing,
          email: user.email,
          metadata: {
            userId: user.id,
            name: profile?.full_name || '',
          },
        }),
      });
      const { url, error: apiError } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        setError(apiError || 'Något gick fel, försök igen.');
        setSubmitting(false);
      }
    } catch {
      setError('Något gick fel, försök igen.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Brand bar */}
      <div className="px-6 py-4" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-md mx-auto">
          <a href={mainSiteUrl} className="flex items-center gap-2.5 w-fit transition-opacity hover:opacity-80">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: CORAL }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[15px] font-bold text-white tracking-tight">Enkla Bokslut</span>
          </a>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          <div className="mb-8">
            <FlowCheckpoints current={3} />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold mb-2" style={{ color: NAV_BG }}>Starta din prenumeration</h1>
            <p className="text-slate-500 text-sm">Allt inkluderat, ingen bindningstid. Avsluta när du vill.</p>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: NAV_BG, boxShadow: `0 24px 64px ${NAV_BG}30` }}>
            <div className="p-7 sm:p-8">

              {/* Billing toggle */}
              <div className="flex items-center gap-1 p-1 rounded-xl mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                <button
                  onClick={() => setBilling('monthly')}
                  className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200"
                  style={billing === 'monthly' ? { backgroundColor: 'white', color: NAV_BG } : { color: 'rgba(255,255,255,0.5)' }}
                >
                  Månadsvis
                </button>
                <button
                  onClick={() => setBilling('yearly')}
                  className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5"
                  style={billing === 'yearly' ? { backgroundColor: 'white', color: NAV_BG } : { color: 'rgba(255,255,255,0.5)' }}
                >
                  Årsvis
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: billing === 'yearly' ? `${CORAL}20` : `${CORAL}40`, color: billing === 'yearly' ? CORAL : 'rgba(233,92,99,0.9)' }}>
                    Spara 89 kr
                  </span>
                </button>
              </div>

              <div className="mb-6 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-end gap-1.5">
                  <span className="text-5xl font-extrabold tracking-tight text-white">
                    {(billing === 'monthly' ? pkg.price : pkg.yearlyPrice).toLocaleString('sv')}
                  </span>
                  <div className="mb-1">
                    <span className="text-xl font-light text-white/40">kr</span>
                    <p className="text-sm font-semibold leading-none mt-0.5" style={{ color: CORAL }}>
                      {billing === 'monthly' ? 'per månad' : 'per år'}
                    </p>
                  </div>
                </div>
                {billing === 'yearly'
                  ? <p className="text-xs mt-2 text-white/35">≈ 292 kr/mån — faktureras en gång per år</p>
                  : <p className="text-xs mt-1 text-white/40">Ingen bindningstid — avsluta när du vill</p>}
              </div>

              <ul className="space-y-3 mb-8">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${CORAL}35` }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm leading-relaxed text-white/75">{feature}</span>
                  </li>
                ))}
              </ul>

              {error && <p className="text-sm text-red-300 text-center mb-4">{error}</p>}

              <button
                onClick={handlePay}
                disabled={submitting}
                className="block w-full text-center font-bold py-4 rounded-xl transition-all duration-200 hover:scale-[1.02] text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 24px ${CORAL}50` }}
              >
                {submitting ? 'Öppnar betalning...' : 'Gå till betalning →'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-slate-400">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Säker betalning via Stripe
          </div>

          <button
            type="button"
            onClick={() => router.push('/onboarding')}
            className="block w-full mt-6 text-sm text-slate-400 hover:text-slate-600 transition-colors text-center"
          >
            ← Tillbaka
          </button>

        </div>
      </div>
    </div>
  );
}
