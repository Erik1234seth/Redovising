'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function AccountPage() {
  const { user, profile, signOut, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-warm-300">Laddar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Mitt konto</h1>
          <p className="text-sm sm:text-base text-warm-300">Inloggad som {user.email}</p>
        </div>

        {/* My Accounting */}
        <Link
          href="/account/redovisning"
          className="block bg-[#E95C63]/10 hover:bg-[#E95C63]/20 border border-[#E95C63]/30 hover:border-[#E95C63]/50 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 mb-4 sm:mb-6 transition-all duration-200 group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#E95C63]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#E95C63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Min redovisning</h2>
                <p className="text-sm sm:text-base text-warm-300">Se dina färdiga bokslut och NE-bilagor</p>
              </div>
            </div>
            <svg className="w-6 h-6 text-[#E95C63] group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Order Statistics */}
        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Orderstatistik</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-[#E95C63]/10 border border-[#E95C63]/30 rounded-lg sm:rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-warm-300 text-xs sm:text-sm mb-1">Totalt antal beställningar</p>
                  <p className="text-3xl sm:text-4xl font-bold text-[#E95C63]">{profile.order_count}</p>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#E95C63]/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#E95C63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-navy-800/50 border border-navy-600 rounded-lg sm:rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-warm-300 text-xs sm:text-sm mb-1">Medlem sedan</p>
                  <p className="text-lg sm:text-xl font-bold text-white">
                    {new Date(profile.created_at).toLocaleDateString('sv-SE', {
                      year: 'numeric',
                      month: 'long',
                    })}
                  </p>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-navy-600/50 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-warm-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Kontoåtgärder</h2>
          <button
            onClick={handleLogout}
            className="w-full px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-red-300 rounded-xl font-semibold transition-all duration-200"
          >
            Logga ut
          </button>
        </div>
      </div>
    </div>
  );
}
