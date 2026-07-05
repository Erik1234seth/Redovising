'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import FlowCheckpoints from '@/components/FlowCheckpoints';
import { useMainSiteUrl } from '@/lib/useMainSiteUrl';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, refreshProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken');
      setLoading(false);
      return;
    }

    try {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        setError(error.message || 'Ett fel uppstod vid registrering');
        setLoading(false);
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
        await refreshProfile();
        router.push(redirectUrl);
      }
    } catch {
      setError('Något gick fel. Försök igen.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="fullName" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Namn
        </label>
        <input
          id="fullName"
          type="text"
          required
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          className="w-full px-4 py-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition placeholder-slate-400"
          style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
          placeholder="För- och efternamn"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          E-postadress
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition placeholder-slate-400"
          style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
          placeholder="din@epost.se"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Lösenord
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition placeholder-slate-400"
          style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
          placeholder="Minst 6 tecken"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] mt-1"
        style={{ backgroundColor: CORAL, boxShadow: `0 8px 20px ${CORAL}40` }}
      >
        {loading ? 'Skapar konto...' : 'Skapa konto →'}
      </button>

      <p className="text-center text-sm text-slate-500">
        Har du redan ett konto?{' '}
        <Link href="/auth/login" className="font-semibold hover:opacity-80" style={{ color: CORAL }}>
          Logga in
        </Link>
      </p>
    </form>
  );
}

export default function AppSignupPage() {
  const mainSiteUrl = useMainSiteUrl();
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
            <FlowCheckpoints current={1} />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold mb-2" style={{ color: NAV_BG }}>Skapa ditt konto</h1>
            <p className="text-slate-500 text-sm">Det tar under en minut att komma igång.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8" style={{ boxShadow: `0 24px 64px ${NAV_BG}12` }}>
            <Suspense fallback={<div className="flex flex-col gap-4 animate-pulse"><div className="h-12 bg-slate-100 rounded-xl" /><div className="h-12 bg-slate-100 rounded-xl" /><div className="h-12 bg-slate-100 rounded-xl" /><div className="h-12 bg-slate-100 rounded-xl" /></div>}>
              <SignupForm />
            </Suspense>
          </div>

          {/* Trust line */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8">
            {[
              'Ingen bindningstid',
              'Trygg & säker',
              'Fokus på enskilda firmor',
            ].map((item) => (
              <div key={item} className="flex items-center gap-1.5 text-xs text-slate-500">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
