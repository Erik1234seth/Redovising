'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-50 border-2 border-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-4" style={{ color: NAV_BG }}>Vi hör av oss!</h1>
          <p className="text-slate-600 text-lg mb-8">
            Vi har tagit emot din förfrågan och kontaktar dig på{' '}
            <span className="font-semibold" style={{ color: CORAL }}>{email}</span>{' '}
            inom kort.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-8 py-3 text-white font-bold rounded-xl transition-all duration-200 hover:opacity-90"
            style={{ backgroundColor: NAV_BG }}
          >
            Tillbaka till startsidan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center px-3 py-1.5 rounded-full mb-4 border" style={{ backgroundColor: `${NAV_BG}10`, borderColor: `${NAV_BG}20` }}>
            <span className="text-sm font-semibold" style={{ color: NAV_BG }}>{packageName}</span>
          </div>
          <h1 className="text-3xl font-bold mb-3" style={{ color: NAV_BG }}>Hur vill du komma igång?</h1>
          <p className="text-slate-500">Välj det alternativ som passar dig bäst</p>
        </div>

        {/* Options */}
        <div className="space-y-4 mb-8">
          {/* Option 1: Contact by email */}
          <button
            onClick={() => setSelected('contact')}
            className={`w-full text-left p-6 rounded-xl border-2 bg-white transition-all duration-200 ${
              selected === 'contact'
                ? ''
                : 'border-gray-200 hover:border-slate-300'
            }`}
            style={selected === 'contact' ? { borderColor: NAV_BG, backgroundColor: `${NAV_BG}06` } : {}}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5"
                style={selected === 'contact' ? { backgroundColor: NAV_BG } : { backgroundColor: '#f3f4f6' }}
              >
                {selected === 'contact' ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1" style={{ color: NAV_BG }}>Jag vill bli kontaktad via mail</h3>
                <p className="text-slate-500 text-sm">Vi kontaktar dig och hjälper dig hela vägen. Du behöver inte göra något mer.</p>
              </div>
            </div>
          </button>

          {/* Option 2: Upload yourself */}
          <button
            onClick={() => setSelected('upload')}
            className={`w-full text-left p-6 rounded-xl border-2 bg-white transition-all duration-200 ${
              selected === 'upload'
                ? ''
                : 'border-gray-200 hover:border-slate-300'
            }`}
            style={selected === 'upload' ? { borderColor: NAV_BG, backgroundColor: `${NAV_BG}06` } : {}}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5"
                style={selected === 'upload' ? { backgroundColor: NAV_BG } : { backgroundColor: '#f3f4f6' }}
              >
                {selected === 'upload' ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1" style={{ color: NAV_BG }}>Jag laddar upp allt underlag på hemsidan</h3>
                <p className="text-slate-500 text-sm">Följ våra steg-för-steg instruktioner och ladda upp dina kontoutdrag direkt.</p>
              </div>
            </div>
          </button>
        </div>

        {/* Email input for contact option */}
        {selected === 'contact' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Din e-postadress
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@email.se"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-slate-900 rounded-xl outline-none transition placeholder-gray-400 mb-4"
              onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${NAV_BG}40`}
              onBlur={e => e.currentTarget.style.boxShadow = ''}
            />
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Ditt telefonnummer
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="070-000 00 00"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-slate-900 rounded-xl outline-none transition placeholder-gray-400 mb-4"
              onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${NAV_BG}40`}
              onBlur={e => e.currentTarget.style.boxShadow = ''}
              onKeyDown={(e) => e.key === 'Enter' && handleContactSubmit()}
            />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button
              onClick={handleContactSubmit}
              disabled={submitting}
              className="w-full py-3 text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: NAV_BG }}
            >
              {submitting ? 'Skickar...' : 'Skicka förfrågan →'}
            </button>
          </div>
        )}

        {/* Continue button for upload option */}
        {selected === 'upload' && (
          <button
            onClick={handleUpload}
            className="w-full py-4 text-white font-bold rounded-xl transition-all duration-200 mb-6 hover:opacity-90"
            style={{ backgroundColor: NAV_BG }}
          >
            {user ? 'Fortsätt →' : 'Skapa konto eller logga in →'}
          </button>
        )}

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="w-full text-center text-slate-400 hover:text-slate-700 font-semibold transition-colors text-sm"
        >
          ← Tillbaka
        </button>
      </div>
    </div>
  );
}
