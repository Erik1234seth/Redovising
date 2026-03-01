'use client';

import { useState } from 'react';

export default function KontaktPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
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

      if (!response.ok) {
        throw new Error('Kunde inte skicka meddelandet');
      }

      setIsSubmitted(true);
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Kunde inte skicka meddelandet. Försök igen senare.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-navy-800 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            Kontakta oss
          </h1>
          <p className="text-base sm:text-xl text-warm-300 px-4">
            Har du frågor? Vi hjälper dig gärna!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {/* Contact Info */}
          <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">
              Kontaktinformation
            </h2>

            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-start">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gold-500/20 rounded-lg sm:rounded-xl flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-gold-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm sm:text-base mb-1">E-post</h3>
                  <a
                    href="mailto:erik@enklabokslut.se"
                    className="text-gold-500 hover:text-gold-400 transition-colors text-sm sm:text-base"
                  >
                    erik@enklabokslut.se
                  </a>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gold-500/20 rounded-lg sm:rounded-xl flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-gold-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm sm:text-base mb-1">Telefon</h3>
                  <a
                    href="tel:+46725191616"
                    className="text-gold-500 hover:text-gold-400 transition-colors text-sm sm:text-base"
                  >
                    072-519-16-16
                  </a>
                  <p className="text-xs sm:text-sm text-warm-400 mt-1">
                    Vardagar 9:00-17:00
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gold-500/20 rounded-lg sm:rounded-xl flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-gold-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm sm:text-base mb-1">
                    Svarstid
                  </h3>
                  <p className="text-warm-300 text-sm sm:text-base">
                    Vi strävar efter att svara så snart som möjligt
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-navy-600">
              <h3 className="font-semibold text-white text-sm sm:text-base mb-2 sm:mb-3">
                Vanliga frågor?
              </h3>
              <p className="text-warm-300 text-sm sm:text-base mb-3 sm:mb-4">
                Kolla in vår guidesida för svar på vanliga frågor och
                steg-för-steg instruktioner.
              </p>
              <a
                href="/tutorial"
                className="inline-flex items-center text-gold-500 hover:text-gold-400 font-semibold transition-colors text-sm sm:text-base"
              >
                Till guider
                <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8">
            {isSubmitted ? (
              <div className="text-center py-8 sm:py-12">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 text-green-500"
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
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Tack för ditt meddelande!
                </h3>
                <p className="text-warm-300 text-sm sm:text-base mb-4 sm:mb-6">
                  Vi återkommer till dig så snart som möjligt.
                </p>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="text-gold-500 hover:text-gold-400 font-semibold transition-colors text-sm sm:text-base"
                >
                  Skicka ett nytt meddelande
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">
                  Skicka ett meddelande
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-warm-300 mb-2"
                    >
                      Namn *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500"
                      placeholder="Ditt namn"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-warm-300 mb-2"
                    >
                      E-postadress *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500"
                      placeholder="din@epost.se"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-warm-300 mb-2"
                    >
                      Telefonnummer (valfritt)
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500"
                      placeholder="070-123 45 67"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-medium text-warm-300 mb-2"
                    >
                      Meddelande *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition resize-none placeholder-warm-500"
                      placeholder="Skriv ditt meddelande här..."
                    />
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full font-bold py-3 px-6 rounded-xl transition-all duration-200 ${
                      isLoading
                        ? 'bg-navy-600 text-navy-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-[1.02]'
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Skickar...
                      </span>
                    ) : (
                      'Skicka meddelande'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-gold-500/10 border-l-4 border-gold-500 rounded-r-lg sm:rounded-r-xl p-4 sm:p-6">
          <h3 className="font-semibold text-gold-500 text-sm sm:text-base mb-2">
            Personuppgifter och GDPR
          </h3>
          <p className="text-xs sm:text-sm text-warm-300">
            Vi värnar om din integritet. De uppgifter du delar med oss hanteras enligt
            GDPR och används endast för att svara på din förfrågan. Läs mer om hur vi
            behandlar dina personuppgifter i vår integritetspolicy.
          </p>
        </div>
      </div>
    </div>
  );
}
