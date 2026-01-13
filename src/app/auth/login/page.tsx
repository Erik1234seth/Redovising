'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
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

    const { error } = await signIn(email, password);

    if (error) {
      setError('Fel e-postadress eller lösenord');
      setLoading(false);
    } else {
      // Wait a moment for auth state to update, then refresh profile and redirect
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshProfile();
      router.push(redirectUrl);
    }
  };

  return (
    <div className="min-h-screen bg-navy-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Logga in</h1>
          <p className="text-warm-300">Välkommen tillbaka till Enkla bokslut</p>
        </div>

        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-warm-300 mb-2">
                E-postadress
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500"
                placeholder="din@epost.se"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-warm-300 mb-2">
                Lösenord
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 disabled:from-gold-600 disabled:to-gold-600 disabled:opacity-50 text-navy-900 font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-[1.02]"
            >
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-warm-400 text-sm">
              Har du inget konto?{' '}
              <Link href="/auth/signup" className="text-gold-500 hover:text-gold-400 font-semibold">
                Skapa konto
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-warm-400 hover:text-white text-sm inline-flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Tillbaka till startsidan
          </Link>
        </div>
      </div>
    </div>
  );
}
