'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const ACCENT = '#d04a52';
const NAV_BG = '#173b57';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, refreshProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError('Fel e-postadress eller lösenord');
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
          E-postadress
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition placeholder-slate-400 text-sm"
          style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
          placeholder="din@epost.se"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
          Lösenord
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition placeholder-slate-400 text-sm"
          style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 hover:opacity-90"
        style={{ backgroundColor: ACCENT }}
      >
        {loading ? 'Loggar in...' : 'Logga in'}
      </button>

      <p className="text-center text-sm text-slate-500">
        Inget konto?{' '}
        <Link href="/auth/signup" className="font-semibold hover:opacity-80" style={{ color: ACCENT }}>
          Skapa konto
        </Link>
      </p>
    </form>
  );
}

export default function AppLoginPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EEF5FF' }}>

      {/* Mini-header */}
      <div className="px-6 py-4" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-md mx-auto flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">Enkla Bokslut</span>
        </div>
      </div>

      {/* Formulär */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Logga in</h1>
            <p className="text-slate-500 text-sm">Välkommen tillbaka</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <Suspense fallback={<div className="space-y-4 animate-pulse"><div className="h-12 bg-slate-100 rounded-xl" /><div className="h-12 bg-slate-100 rounded-xl" /><div className="h-12 bg-slate-100 rounded-xl" /></div>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
