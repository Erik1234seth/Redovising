'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FlowContainer from '@/components/FlowContainer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

export default function ContactInfoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageType = params.package as string;
  const bank = searchParams.get('bank') || '';

  const { user, profile } = useAuth();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    company: '',
  });

  const [existingCustomer, setExistingCustomer] = useState(false);
  const [loading, setLoading] = useState(false);

  // Pre-fill form for logged-in users
  useEffect(() => {
    if (user && profile) {
      setFormData({
        email: user.email || '',
        name: profile.full_name || '',
        phone: profile.phone || '',
        company: profile.company_name || '',
      });
    }
  }, [user, profile]);

  // Check if email exists for guest users
  const checkExistingCustomer = async (email: string) => {
    if (user) return; // Skip check for logged-in users

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    setExistingCustomer(!!data);
  };

  const handleEmailBlur = () => {
    if (formData.email && !user) {
      checkExistingCustomer(formData.email);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Pass contact info to confirmation page via URL params
    const params = new URLSearchParams({
      bank,
      email: formData.email,
      name: formData.name,
      phone: formData.phone,
      company: formData.company,
    });

    router.push(`/flow/${packageType}/confirmation?${params.toString()}`);
  };

  return (
    <FlowContainer
      title="Kontaktuppgifter"
      description="Fyll i dina uppgifter så kan vi nå dig när din NE-bilaga är klar."
      currentStep={5}
      totalSteps={6}
      packageType={packageType}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {existingCustomer && (
          <div className="bg-gold-500/10 border border-gold-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-gold-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-semibold text-gold-500 mb-1">
                  Vi ser att du har köpt från oss tidigare!
                </h4>
                <p className="text-sm text-warm-300">
                  <Link href="/auth/login" className="text-gold-500 hover:text-gold-400 underline">
                    Logga in
                  </Link>
                  {' '}för att se din orderhistorik och snabbare checkout.
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-warm-300 mb-2">
            E-postadress *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            onBlur={handleEmailBlur}
            disabled={!!user}
            className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="din@epost.se"
          />
          <p className="mt-1 text-xs text-warm-500">
            Vi skickar din färdiga NE-bilaga hit
          </p>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-warm-300 mb-2">
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
            placeholder="För- och efternamn"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-warm-300 mb-2">
            Telefonnummer *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            required
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500"
            placeholder="070-123 45 67"
          />
          <p className="mt-1 text-xs text-warm-500">
            För att nå dig vid eventuella frågor
          </p>
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-medium text-warm-300 mb-2">
            Företagsnamn (Enskild firma) *
          </label>
          <input
            type="text"
            id="company"
            name="company"
            required
            value={formData.company}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500"
            placeholder="Namnet på din enskilda firma"
          />
        </div>

        {!user && (
          <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-4">
            <p className="text-sm text-warm-300 mb-3">
              Vill du spara dina uppgifter för framtida beställningar?
            </p>
            <Link
              href={`/auth/signup?redirect=/flow/${packageType}/contact-info?bank=${bank}`}
              className="inline-flex items-center text-gold-500 hover:text-gold-400 font-semibold text-sm"
            >
              Skapa konto innan du fortsätter
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <Link
            href={`/flow/${packageType}/upload-previous?bank=${bank}`}
            className="flex-1 px-6 py-3 bg-navy-800 hover:bg-navy-600 border border-navy-600 hover:border-gold-500/50 text-white rounded-xl font-semibold transition-all duration-200 text-center"
          >
            Tillbaka
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 disabled:from-gold-600 disabled:to-gold-600 disabled:opacity-50 text-navy-900 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-[1.02]"
          >
            {loading ? 'Bearbetar...' : 'Fortsätt till bekräftelse'}
          </button>
        </div>
      </form>
    </FlowContainer>
  );
}
