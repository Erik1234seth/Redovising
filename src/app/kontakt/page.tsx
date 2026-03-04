'use client';

import { useState } from 'react';
import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function KontaktPage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/send-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.phone
            ? `Telefon: ${formData.phone}\n\n${formData.message}`
            : formData.message,
        }),
      });
      if (!response.ok) throw new Error('Kunde inte skicka meddelandet');
      setIsSubmitted(true);
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Kunde inte skicka meddelandet. Försök igen senare.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="bg-white min-h-screen">

      {/* ── Page header ── */}
      <div className="py-14 sm:py-20 text-center" style={{ backgroundColor: NAV_BG }}>
        <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
          Kontakt
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3">
          Hur kan vi hjälpa dig?
        </h1>
        <p className="text-white/65 text-base sm:text-lg">
          Vi svarar alltid så snart vi kan – vanligtvis inom en arbetsdag.
        </p>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-14">

          {/* Left – contact info */}
          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-6">Kontaktinformation</h2>
            <div className="space-y-6 mb-8">
              {[
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
                  label: 'E-post',
                  content: <a href="mailto:erik@enklabokslut.se" className="font-medium hover:underline text-[15px]" style={{ color: CORAL }}>erik@enklabokslut.se</a>,
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />,
                  label: 'Telefon',
                  content: (
                    <>
                      <a href="tel:+46725191616" className="font-medium hover:underline text-[15px]" style={{ color: CORAL }}>072-519 16 16</a>
                      <p className="text-xs text-slate-400 mt-0.5">Vardagar 9:00–17:00</p>
                    </>
                  ),
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
                  label: 'Svarstid',
                  content: <p className="text-slate-600 text-[15px]">Vi strävar efter att svara så snart som möjligt</p>,
                },
              ].map(({ icon, label, content }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${NAV_BG}12` }}>
                    <svg className="w-5 h-5 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                    {content}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-8">
              <h3 className="font-semibold text-navy-900 mb-2">Vanliga frågor?</h3>
              <p className="text-slate-500 text-sm mb-3 leading-relaxed">
                Kolla in vår guidesida för svar på vanliga frågor och steg-för-steg instruktioner.
              </p>
              <Link
                href="/tutorial"
                className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
                style={{ color: CORAL }}
              >
                Till guider
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Right – form */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-7 sm:p-8">
            {isSubmitted ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-green-50 border-2 border-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-navy-900 mb-2">Tack för ditt meddelande!</h3>
                <p className="text-slate-500 text-sm mb-6">Vi återkommer till dig så snart som möjligt.</p>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="text-sm font-semibold hover:underline"
                  style={{ color: CORAL }}
                >
                  Skicka ett nytt meddelande
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-navy-900 mb-6">Skicka ett meddelande</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {[
                    { id: 'name', label: 'Namn', type: 'text', required: true, placeholder: 'Ditt namn' },
                    { id: 'email', label: 'E-postadress', type: 'email', required: true, placeholder: 'din@epost.se' },
                    { id: 'phone', label: 'Telefonnummer (valfritt)', type: 'tel', required: false, placeholder: '070-123 45 67' },
                  ].map(({ id, label, type, required, placeholder }) => (
                    <div key={id}>
                      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
                        {label}
                      </label>
                      <input
                        type={type}
                        id={id}
                        name={id}
                        required={required}
                        value={formData[id as keyof typeof formData]}
                        onChange={handleChange}
                        placeholder={placeholder}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 text-navy-900 rounded-xl text-[15px] outline-none focus:ring-2 focus:border-transparent placeholder-gray-400 transition"
                        style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
                        onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${NAV_BG}40`}
                        onBlur={e => e.currentTarget.style.boxShadow = ''}
                      />
                    </div>
                  ))}

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Meddelande
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Skriv ditt meddelande här..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 text-navy-900 rounded-xl text-[15px] outline-none resize-none placeholder-gray-400 transition"
                      onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${NAV_BG}40`}
                      onBlur={e => e.currentTarget.style.boxShadow = ''}
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full font-bold py-3 px-6 rounded-xl text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 hover:scale-[1.01]"
                    style={{ backgroundColor: NAV_BG }}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Skickar...
                      </span>
                    ) : 'Skicka meddelande'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* GDPR notice */}
        <div className="mt-10 border-l-4 rounded-r-xl p-5" style={{ borderColor: `${NAV_BG}50`, backgroundColor: `${NAV_BG}06` }}>
          <h3 className="font-semibold text-navy-800 text-sm mb-1.5">Personuppgifter och GDPR</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Vi värnar om din integritet. De uppgifter du delar med oss hanteras enligt GDPR och används
            endast för att svara på din förfrågan. Vi delar aldrig dina uppgifter med tredje part.
          </p>
        </div>
      </div>
    </div>
  );
}
