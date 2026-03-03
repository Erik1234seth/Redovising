'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type Method = 'contact' | 'upload' | null;

export default function MethodSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const packageType = params.package as string;

  const [selected, setSelected] = useState<Method>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const packageName = packageType === 'komplett' ? 'Komplett tjänst' : 'NE-bilaga';

  const handleContactSubmit = async () => {
    if (!email || !email.includes('@')) {
      setError('Ange en giltig e-postadress');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/contact-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, packageType }),
      });
      if (!res.ok) throw new Error('Något gick fel');
      setDone(true);
    } catch {
      setError('Något gick fel, försök igen');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = () => {
    if (user) {
      router.push(`/flow/${packageType}/bank-selection`);
    } else {
      router.push(`/auth/login?redirect=/flow/${packageType}/bank-selection`);
    }
  };

  // Done screen
  if (done) {
    return (
      <div className="min-h-screen bg-navy-800 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Vi hör av oss!</h1>
          <p className="text-warm-300 text-lg mb-8">
            Vi har tagit emot din förfrågan och kontaktar dig på <span className="text-gold-500 font-semibold">{email}</span> inom kort.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-8 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200"
          >
            Tillbaka till startsidan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-800 flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center px-3 py-1.5 bg-gold-500/10 border border-gold-500/20 rounded-full mb-4">
            <span className="text-gold-500 text-sm font-semibold">{packageName}</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Hur vill du komma igång?</h1>
          <p className="text-warm-300">Välj det alternativ som passar dig bäst</p>
        </div>

        {/* Options */}
        <div className="space-y-4 mb-8">
          {/* Option 1: Contact by email */}
          <button
            onClick={() => setSelected('contact')}
            className={`w-full text-left p-6 rounded-xl border-2 transition-all duration-200 ${
              selected === 'contact'
                ? 'border-gold-500 bg-gold-500/10'
                : 'border-navy-600 bg-navy-700/50 hover:border-gold-500/50 hover:bg-navy-700'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5 ${
                selected === 'contact' ? 'bg-gold-500' : 'bg-navy-600'
              }`}>
                {selected === 'contact' ? (
                  <svg className="w-5 h-5 text-navy-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Jag vill bli kontaktad via mail</h3>
                <p className="text-warm-300 text-sm">Vi kontaktar dig och hjälper dig hela vägen. Du behöver inte göra något mer.</p>
              </div>
            </div>
          </button>

          {/* Option 2: Upload yourself */}
          <button
            onClick={() => setSelected('upload')}
            className={`w-full text-left p-6 rounded-xl border-2 transition-all duration-200 ${
              selected === 'upload'
                ? 'border-gold-500 bg-gold-500/10'
                : 'border-navy-600 bg-navy-700/50 hover:border-gold-500/50 hover:bg-navy-700'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5 ${
                selected === 'upload' ? 'bg-gold-500' : 'bg-navy-600'
              }`}>
                {selected === 'upload' ? (
                  <svg className="w-5 h-5 text-navy-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Jag laddar upp allt underlag på hemsidan</h3>
                <p className="text-warm-300 text-sm">Följ våra steg-för-steg instruktioner och ladda upp dina kontoutdrag direkt.</p>
              </div>
            </div>
          </button>
        </div>

        {/* Email input for contact option */}
        {selected === 'contact' && (
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6 mb-6">
            <label className="block text-sm font-medium text-warm-300 mb-2">
              Din e-postadress
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@email.se"
              className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500 mb-4"
            />
            <label className="block text-sm font-medium text-warm-300 mb-2">
              Ditt telefonnummer
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="070-000 00 00"
              className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500 mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleContactSubmit()}
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              onClick={handleContactSubmit}
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200 disabled:opacity-50"
            >
              {submitting ? 'Skickar...' : 'Skicka förfrågan →'}
            </button>
          </div>
        )}

        {/* Continue button for upload option */}
        {selected === 'upload' && (
          <button
            onClick={handleUpload}
            className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 mb-6"
          >
            {user ? 'Fortsätt →' : 'Skapa konto eller logga in →'}
          </button>
        )}

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="w-full text-center text-warm-400 hover:text-white font-semibold transition-colors text-sm"
        >
          ← Tillbaka
        </button>
      </div>
    </div>
  );
}
