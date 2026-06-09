'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PAYMENTS_ENABLED } from '@/lib/config';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

export default function BestallPage() {
  const router = useRouter();
  const [contactMethod, setContactMethod] = useState<'email' | 'meeting' | null>(null);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    const stored = sessionStorage.getItem('billingPeriod');
    if (stored === 'monthly' || stored === 'yearly') setBilling(stored);
  }, []);

  const handleContinue = () => {
    if (!contactMethod) return;
    sessionStorage.setItem('contactMethod', contactMethod);
    if (contactMethod === 'meeting') {
      router.push('/bestall/tid');
    } else {
      router.push('/bestall/kontakt');
    }
  };

  if (!PAYMENTS_ENABLED) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: `${NAV_BG}10` }}>
            <svg className="w-7 h-7" fill="none" stroke={NAV_BG} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold mb-2" style={{ color: NAV_BG }}>Betalning inte tillgänglig just nu</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Vi håller på att förbereda betalningsfunktionen. Återkom snart eller kontakta oss direkt.
          </p>
          <a
            href="mailto:hej@enklabokslut.se"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: NAV_BG }}
          >
            Kontakta oss
          </a>
          <button onClick={() => router.back()} className="block w-full mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            ← Tillbaka
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">

        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: NAV_BG }}>1</div>
            <span className="text-sm font-semibold text-slate-700">Kontakt</span>
          </div>
          <div className="flex-1 h-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-slate-200 text-slate-400">2</div>
            <span className="text-sm text-slate-400">Dina uppgifter</span>
          </div>
          <div className="flex-1 h-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-slate-200 text-slate-400">3</div>
            <span className="text-sm text-slate-400">Betalning</span>
          </div>
        </div>

        {/* Selected plan summary */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3 mb-8 shadow-sm">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Valt abonnemang</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">Enkla Bokslut</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-extrabold" style={{ color: CORAL }}>
              {billing === 'yearly' ? '3 499 kr/år' : '299 kr/mån'}
            </p>
            <button
              onClick={() => router.back()}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Ändra →
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold mb-2" style={{ color: NAV_BG }}>Hur vill du bli kontaktad?</h1>
        <p className="text-slate-500 text-sm mb-7">Vi hör av oss så snart betalningen är klar.</p>

        <div className="flex flex-col gap-3 mb-8">
          {/* Email option */}
          <button
            onClick={() => setContactMethod('email')}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-150 ${
              contactMethod === 'email'
                ? 'border-[#173b57] bg-[#173b57]/5'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                contactMethod === 'email' ? 'bg-[#173b57]/15' : 'bg-slate-100'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  style={{ color: contactMethod === 'email' ? NAV_BG : '#94a3b8' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-bold text-slate-800">Via mail</p>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full text-white" style={{ backgroundColor: CORAL }}>
                    REKOMMENDERAS
                  </span>
                </div>
                <p className="text-sm text-slate-500">Vi skickar ett välkomstmail med allt du behöver veta direkt efter betalning.</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center transition-colors ${
                contactMethod === 'email' ? 'border-[#173b57] bg-[#173b57]' : 'border-slate-300'
              }`}>
                {contactMethod === 'email' && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </div>
          </button>

          {/* Meeting option */}
          <button
            onClick={() => setContactMethod('meeting')}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-150 ${
              contactMethod === 'meeting'
                ? 'border-[#173b57] bg-[#173b57]/5'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                contactMethod === 'meeting' ? 'bg-[#173b57]/10' : 'bg-slate-100'
              }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  style={{ color: contactMethod === 'meeting' ? NAV_BG : '#94a3b8' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 mb-0.5">Via möte</p>
                <p className="text-sm text-slate-500">Vi bokar in ett kort möte där vi går igenom ditt ärende tillsammans.</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center transition-colors ${
                contactMethod === 'meeting' ? 'border-[#173b57] bg-[#173b57]' : 'border-slate-300'
              }`}>
                {contactMethod === 'meeting' && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={handleContinue}
          disabled={!contactMethod}
          className="w-full py-4 rounded-2xl font-bold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01]"
          style={{ backgroundColor: NAV_BG, color: 'white' }}
        >
          Fortsätt →
        </button>

        <button onClick={() => router.back()} className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors text-center">
          ← Tillbaka
        </button>
      </div>
    </div>
  );
}
