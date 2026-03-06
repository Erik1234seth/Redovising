'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function MethodSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const packageType = params.package as string;

  const [name, setName] = useState('');
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
      const meetingDate = sessionStorage.getItem('meetingDate') || '';
      const meetingTime = sessionStorage.getItem('meetingTime') || '';
      const sessionId = sessionStorage.getItem('analyticsSessionId') || null;
      const res = await fetch('/api/contact-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, packageType, meetingDate, meetingTime, sessionId }),
      });
      if (!res.ok) throw new Error('Något gick fel');
      setDone(true);
    } catch {
      setError('Något gick fel, försök igen');
    } finally {
      setSubmitting(false);
    }
  };

  // Kept for future use
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
          <div className="w-20 h-20 bg-[#E95C63]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-[#E95C63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Vi hör av oss!</h1>
          <p className="text-warm-300 text-lg mb-8">
            Vi har tagit emot din förfrågan och kontaktar dig på <span className="text-[#E95C63] font-semibold">{email}</span> inom kort.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-8 py-3 bg-[#E95C63] hover:bg-[#d04e55] text-white font-bold rounded-xl transition-all duration-200"
          >
            Tillbaka till startsidan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-800 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center px-3 py-1.5 bg-[#E95C63]/10 border border-[#E95C63]/20 rounded-full mb-4">
            <span className="text-[#E95C63] text-sm font-semibold">{packageName}</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Kom igång idag</h1>
          <p className="text-warm-300">Lämna dina uppgifter så kontaktar vi dig inom kort.</p>
        </div>

        {/* Contact form */}
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-warm-300 mb-2">
                Ditt namn
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="För- och efternamn"
                className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-[#E95C63] focus:border-[#E95C63] outline-none transition placeholder-warm-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-300 mb-2">
                Din e-postadress <span className="text-[#E95C63]">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@email.se"
                className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-[#E95C63] focus:border-[#E95C63] outline-none transition placeholder-warm-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-300 mb-2">
                Ditt mobilnummer
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="070-000 00 00"
                className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-[#E95C63] focus:border-[#E95C63] outline-none transition placeholder-warm-500"
                onKeyDown={(e) => e.key === 'Enter' && handleContactSubmit()}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

          <button
            onClick={handleContactSubmit}
            disabled={submitting}
            className="w-full mt-6 py-3 bg-[#E95C63] hover:bg-[#d04e55] text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50"
          >
            {submitting ? 'Skickar...' : 'Skicka →'}
          </button>
        </div>

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
