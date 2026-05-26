'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

export default function KontaktPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [contactMethod, setContactMethod] = useState<string>('email');
  const [meetingDate, setMeetingDate] = useState<string | null>(null);
  const [meetingTime, setMeetingTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedBilling = sessionStorage.getItem('billingPeriod');
    const storedMethod = sessionStorage.getItem('contactMethod');
    const storedDate = sessionStorage.getItem('meetingDate');
    const storedTime = sessionStorage.getItem('meetingTime');
    if (storedBilling === 'monthly' || storedBilling === 'yearly') setBilling(storedBilling);
    if (storedMethod) setContactMethod(storedMethod);
    if (storedDate) setMeetingDate(storedDate);
    if (storedTime) setMeetingTime(storedTime);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { setError('Ange en giltig e-postadress'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: billing,
          email,
          metadata: {
            name,
            contactMethod,
            ...(meetingDate && { meetingDate }),
            ...(meetingTime && { meetingTime }),
          },
        }),
      });
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError('Något gick fel, försök igen.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">

        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: CORAL }}>✓</div>
            <span className="text-sm text-slate-400">Kontakt</span>
          </div>
          {contactMethod === 'meeting' && (
            <>
              <div className="flex-1 h-px bg-slate-200 mx-2" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: CORAL }}>✓</div>
                <span className="text-sm text-slate-400 whitespace-nowrap">Välj tid</span>
              </div>
            </>
          )}
          <div className="flex-1 h-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: NAV_BG }}>{contactMethod === 'meeting' ? '3' : '2'}</div>
            <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Dina uppgifter</span>
          </div>
          <div className="flex-1 h-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-slate-200 text-slate-400 flex-shrink-0">{contactMethod === 'meeting' ? '4' : '3'}</div>
            <span className="text-sm text-slate-400">Betalning</span>
          </div>
        </div>

        {/* Selected plan summary */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3 mb-8 shadow-sm">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Valt abonnemang</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">Enkla Bokslut</p>
          </div>
          <p className="text-lg font-extrabold" style={{ color: CORAL }}>
            {billing === 'yearly' ? '3 499 kr/år' : '299 kr/mån'}
          </p>
        </div>

        <h1 className="text-2xl font-extrabold mb-2" style={{ color: NAV_BG }}>Dina uppgifter</h1>
        <p className="text-slate-500 text-sm mb-7">Vi skickar bekräftelse och välkomstmail hit.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Namn</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="För- och efternamn"
                required
                className="w-full px-4 py-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition"
                style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">E-postadress</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="din@email.se"
                required
                className="w-full px-4 py-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition"
                style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
              />
              <p className="text-xs text-slate-400 mt-1.5">Välkomstmailet skickas hit direkt efter betalning</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !name || !email}
            className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01]"
            style={{ backgroundColor: NAV_BG }}
          >
            {loading ? 'Skickar till betalning...' : 'Gå till betalning →'}
          </button>

          <button type="button" onClick={() => router.back()} className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors text-center">
            ← Tillbaka
          </button>
        </form>
      </div>
    </div>
  );
}
