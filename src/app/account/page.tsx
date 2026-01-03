'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

export default function AccountPage() {
  const { user, profile, refreshProfile, signOut, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    company_name: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        company_name: profile.company_name || '',
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        phone: formData.phone,
        company_name: formData.company_name,
      })
      .eq('id', user?.id);

    if (error) {
      setMessage('Ett fel uppstod. Försök igen.');
    } else {
      await refreshProfile();
      setMessage('Profilen har uppdaterats!');
      setEditing(false);
    }

    setSaving(false);
  };

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
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Min profil</h1>
          <p className="text-sm sm:text-base text-warm-300">Hantera dina uppgifter och se din orderhistorik</p>
        </div>

        {message && (
          <div className="mb-4 sm:mb-6 bg-gold-500/10 border border-gold-500/50 text-gold-500 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base">
            {message}
          </div>
        )}

        {/* Profile Information */}
        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 mb-4 sm:mb-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Kontaktuppgifter</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-navy-600 hover:bg-navy-500 border border-gold-500/50 hover:border-gold-500 text-white rounded-xl font-semibold transition-all duration-200"
              >
                Redigera
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-warm-300 mb-2">
                E-postadress
              </label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-warm-500 rounded-xl cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-warm-500">E-postadressen kan inte ändras</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-warm-300 mb-2">
                Namn
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                disabled={!editing}
                className={`w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl outline-none transition placeholder-warm-500 ${
                  editing
                    ? 'focus:ring-2 focus:ring-gold-500 focus:border-gold-500'
                    : 'cursor-not-allowed opacity-75'
                }`}
                placeholder="Ditt namn"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-warm-300 mb-2">
                Telefonnummer
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                disabled={!editing}
                className={`w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl outline-none transition placeholder-warm-500 ${
                  editing
                    ? 'focus:ring-2 focus:ring-gold-500 focus:border-gold-500'
                    : 'cursor-not-allowed opacity-75'
                }`}
                placeholder="070-123 45 67"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-warm-300 mb-2">
                Företagsnamn
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                disabled={!editing}
                className={`w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl outline-none transition placeholder-warm-500 ${
                  editing
                    ? 'focus:ring-2 focus:ring-gold-500 focus:border-gold-500'
                    : 'cursor-not-allowed opacity-75'
                }`}
                placeholder="Namnet på din enskilda firma"
              />
            </div>
          </div>

          {editing && (
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setEditing(false);
                  setFormData({
                    full_name: profile.full_name || '',
                    phone: profile.phone || '',
                    company_name: profile.company_name || '',
                  });
                }}
                className="flex-1 px-6 py-3 bg-navy-600 hover:bg-navy-500 border border-navy-500 text-white rounded-xl font-semibold transition-all duration-200"
              >
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 disabled:from-gold-600 disabled:to-gold-600 disabled:opacity-50 text-navy-900 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40"
              >
                {saving ? 'Sparar...' : 'Spara ändringar'}
              </button>
            </div>
          )}
        </div>

        {/* Order Statistics */}
        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Orderstatistik</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg sm:rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-warm-300 text-xs sm:text-sm mb-1">Totalt antal beställningar</p>
                  <p className="text-3xl sm:text-4xl font-bold text-gold-500">{profile.order_count}</p>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gold-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
