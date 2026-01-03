'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function BankIDTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if we're returning from BankID
  const status = searchParams.get('status');
  const sessionId = searchParams.get('sessionId');

  const handleBankIDLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/bankid/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create BankID session');
      }

      // Redirect to BankID authentication URL
      window.location.href = data.authenticationUrl;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/bankid/session/${sessionId}`);
      const data = await response.json();

      if (response.ok && data.subject) {
        setUserData(data.subject);
      } else {
        setError(data.error || 'Failed to fetch user data');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Fetch user data if we have a successful callback
  if (status === 'success' && sessionId && !userData && !error) {
    fetchUserData();
  }

  return (
    <div className="min-h-screen bg-navy-800 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            BankID Test
          </h1>
          <p className="text-base sm:text-lg text-warm-300">
            Testa BankID-inloggning via Signicat
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl">
            <p className="font-semibold">Fel:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Success - User Data */}
        {userData && (
          <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-6 sm:p-8 mb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gold-500/20 border-2 border-gold-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-gold-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              BankID-inloggning lyckades!
            </h2>

            <div className="space-y-4">
              <div className="bg-navy-800/50 rounded-lg p-4">
                <p className="text-sm text-warm-400 mb-1">Namn</p>
                <p className="text-white font-semibold">
                  {userData.name || 'Ej tillgängligt'}
                </p>
              </div>

              {userData.firstName && (
                <div className="bg-navy-800/50 rounded-lg p-4">
                  <p className="text-sm text-warm-400 mb-1">Förnamn</p>
                  <p className="text-white font-semibold">{userData.firstName}</p>
                </div>
              )}

              {userData.lastName && (
                <div className="bg-navy-800/50 rounded-lg p-4">
                  <p className="text-sm text-warm-400 mb-1">Efternamn</p>
                  <p className="text-white font-semibold">{userData.lastName}</p>
                </div>
              )}

              {userData.nin && (
                <div className="bg-navy-800/50 rounded-lg p-4">
                  <p className="text-sm text-warm-400 mb-1">Personnummer</p>
                  <p className="text-white font-semibold">{userData.nin}</p>
                </div>
              )}

              {userData.dateOfBirth && (
                <div className="bg-navy-800/50 rounded-lg p-4">
                  <p className="text-sm text-warm-400 mb-1">Födelsedatum</p>
                  <p className="text-white font-semibold">{userData.dateOfBirth}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setUserData(null);
                router.push('/bankid-test');
              }}
              className="w-full mt-6 px-6 py-3 bg-navy-600 hover:bg-navy-500 border border-gold-500/50 hover:border-gold-500 text-white rounded-xl font-semibold transition-all duration-200"
            >
              Testa igen
            </button>
          </div>
        )}

        {/* Abort Message */}
        {status === 'abort' && !userData && (
          <div className="bg-warm-500/10 border border-warm-500/50 text-warm-300 px-4 py-3 rounded-xl mb-6">
            <p className="font-semibold">Inloggning avbruten</p>
            <p>Du avbröt BankID-inloggningen.</p>
          </div>
        )}

        {/* Login Button */}
        {!userData && (
          <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-6 sm:p-8">
            <div className="space-y-4 mb-6">
              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-gold-500 mr-3 flex-shrink-0 mt-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <div>
                  <p className="text-white font-semibold mb-1">Säker autentisering</p>
                  <p className="text-sm text-warm-300">
                    Använder Signicat och Sveriges BankID för säker identifiering
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-gold-500 mr-3 flex-shrink-0 mt-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-white font-semibold mb-1">Test-miljö</p>
                  <p className="text-sm text-warm-300">
                    Detta är en testsida för att verifiera BankID-integration
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleBankIDLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 disabled:from-gold-600 disabled:to-gold-600 disabled:opacity-50 text-navy-900 font-bold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-[1.02] flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-navy-900"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Startar BankID...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  Logga in med BankID
                </>
              )}
            </button>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-navy-900/50 border border-navy-700 rounded-xl p-4">
          <p className="text-xs text-warm-400 text-center">
            <strong className="text-gold-500">OBS:</strong> Du kommer att redirectas till BankID för autentisering
          </p>
        </div>
      </div>
    </div>
  );
}
