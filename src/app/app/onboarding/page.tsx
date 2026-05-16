'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [orgNr, setOrgNr] = useState('');
  const [verksamhet, setVerksamhet] = useState('');
  const [startAr, setStartAr] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          company_name: companyName || null,
          org_nr: orgNr || null,
          verksamhet,
          start_ar: startAr,
          onboarding_done: true,
        })
        .eq('id', user.id);

      if (dbError) throw dbError;
      await refreshProfile();
      router.push('/');
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setSaving(false);
    }
  }

  const progressPercent = (step / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Progress bar */}
      <div className="h-1 bg-slate-200 w-full fixed top-0 left-0 z-50">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%`, backgroundColor: NAV_BG }}
        />
      </div>

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 pt-8 pb-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CORAL }}>
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-[15px] leading-none tracking-tight select-none">
          <span className="font-medium" style={{ color: '#94a3b8' }}>Enkla </span>
          <span className="font-extrabold text-slate-800">Bokslut</span>
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-lg mx-auto w-full">

        {/* Steg 1 — Företagsnamn & org-nr */}
        {step === 1 && (
          <div>
            <StepBadge current={1} total={TOTAL_STEPS} />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              Vad heter ditt företag?
            </h1>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Fyll i ditt företagsnamn och organisationsnummer så vi kan använda det på rapporter och fakturor.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Företagsnamn
                </label>
                <input
                  autoFocus
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="T.ex. Anna Svensson"
                  className="w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 transition-shadow"
                  style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  För enskild firma är det oftast ditt eget namn
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Organisationsnummer
                </label>
                <input
                  type="text"
                  value={orgNr}
                  onChange={e => setOrgNr(e.target.value)}
                  placeholder="ÅÅMMDD-XXXX"
                  className="w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 transition-shadow"
                  style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  För enskild firma är org-numret ditt personnummer
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={companyName.trim().length < 2 || orgNr.trim().length < 6}
              className="w-full mt-8 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
              style={{ backgroundColor: NAV_BG }}
            >
              Nästa
            </button>
          </div>
        )}

        {/* Steg 2 — Verksamhet */}
        {step === 2 && (
          <div>
            <StepBadge current={2} total={TOTAL_STEPS} />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              Beskriv din verksamhet
            </h1>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Berätta kort vad du säljer eller utför. Det hjälper oss bokföra rätt och ge bättre förslag.
            </p>

            <textarea
              autoFocus
              rows={4}
              value={verksamhet}
              onChange={e => setVerksamhet(e.target.value)}
              placeholder="T.ex. jag driver en enskild firma där jag jobbar som frilansande grafisk designer och säljer logotyper och grafiskt material till företag."
              className="w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 resize-none transition-shadow"
              style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
            />

            <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mt-4" style={{ backgroundColor: '#F8FAFC' }}>
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-slate-400 leading-relaxed">
                Du kan alltid ändra detta senare under <span className="font-medium text-slate-500">Mitt konto</span>.
              </p>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Tillbaka
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={verksamhet.trim().length < 5}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                style={{ backgroundColor: NAV_BG }}
              >
                Nästa
              </button>
            </div>
          </div>
        )}

        {/* Steg 3 — Startår */}
        {step === 3 && (
          <div>
            <StepBadge current={3} total={TOTAL_STEPS} />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              Vilket år startade du?
            </h1>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Välj det år du registrerade din enskilda firma hos Skatteverket.
            </p>

            <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {YEARS.map(year => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setStartAr(year)}
                  className="py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-100"
                  style={{
                    borderColor: startAr === year ? NAV_BG : '#e2e8f0',
                    backgroundColor: startAr === year ? NAV_BG : 'white',
                    color: startAr === year ? 'white' : '#475569',
                    boxShadow: startAr === year ? `0 0 0 1px ${NAV_BG}` : undefined,
                  }}
                >
                  {year}
                </button>
              ))}
            </div>

            {error && (
              <p className="mt-4 text-xs text-red-500 text-center">{error}</p>
            )}

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Tillbaka
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={startAr === null || saving}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                style={{ backgroundColor: NAV_BG }}
              >
                {saving ? 'Sparar...' : 'Kom igång!'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepBadge({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
      style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
    >
      Steg {current} av {total}
    </div>
  );
}
