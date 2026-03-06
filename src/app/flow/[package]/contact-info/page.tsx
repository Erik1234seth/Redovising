'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

export default function ContactInfoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageType = params.package as string;
  const bank = searchParams.get('bank') || '';

  const { user, profile, loading: authLoading } = useAuth();
  useTrackStep('contact-info', packageType, bank, user?.id);

  // Protect route - require authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth/login?redirect=/flow/${packageType}/contact-info?bank=${bank}`);
    }
  }, [user, authLoading, router, packageType, bank]);
  const supabase = createClient();

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    company: '',
  });

  const [existingCustomer, setExistingCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFirstYear, setIsFirstYear] = useState(false);

  // Check if it's user's first year (to determine back navigation)
  useEffect(() => {
    const answersStr = sessionStorage.getItem(`qualificationAnswers_${packageType}`);
    if (answersStr) {
      const answers = JSON.parse(answersStr);
      setIsFirstYear(answers.isFirstYear === true);
    }
  }, [packageType]);

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

    router.push(`/flow/${packageType}/review-and-accept?${params.toString()}`);
  };

  // Total steps: 9 for all, except ne-bilaga first year = 8
  const totalSteps = (packageType !== 'komplett' && isFirstYear) ? 8 : 9;
  // contact-info is step 7 normally, step 6 if ne-bilaga first year (skipped upload-previous)
  const currentStep = (packageType !== 'komplett' && isFirstYear) ? 6 : 7;

  return (
    <FlowContainer
      title="Kontaktuppgifter"
      description="Fyll i dina uppgifter så kan vi nå dig när din NE-bilaga är klar."
      currentStep={currentStep}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {existingCustomer && (
          <div className="bg-[#E95C63]/8 border border-[#E95C63]/30 rounded-xl p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-[#E95C63] mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-semibold text-[#E95C63] mb-1">
                  Vi ser att du har köpt från oss tidigare!
                </h4>
                <p className="text-sm text-slate-500">
                  <Link href="/auth/login" className="text-[#E95C63] hover:opacity-80 underline">
                    Logga in
                  </Link>
                  {' '}för att se din orderhistorik och snabbare checkout.
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-slate-600 mb-1.5">
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
            className="w-full px-4 py-3 bg-white border border-gray-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-[#E95C63] focus:border-[#E95C63] outline-none transition placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="din@epost.se"
          />
          <p className="mt-1 text-xs text-slate-400">
            Vi skickar din färdiga NE-bilaga hit
          </p>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-slate-600 mb-1.5">
            Namn *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-white border border-gray-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-[#E95C63] focus:border-[#E95C63] outline-none transition placeholder-slate-400"
            placeholder="För- och efternamn"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-slate-600 mb-1.5">
            Telefonnummer *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            required
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-white border border-gray-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-[#E95C63] focus:border-[#E95C63] outline-none transition placeholder-slate-400"
            placeholder="070-123 45 67"
          />
          <p className="mt-1 text-xs text-slate-400">
            För att nå dig vid eventuella frågor
          </p>
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-semibold text-slate-600 mb-1.5">
            Företagsnamn (Enskild firma) *
          </label>
          <input
            type="text"
            id="company"
            name="company"
            required
            value={formData.company}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-white border border-gray-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-[#E95C63] focus:border-[#E95C63] outline-none transition placeholder-slate-400"
            placeholder="Namnet på din enskilda firma"
          />
        </div>

        {!user && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-slate-500 mb-3">
              Vill du spara dina uppgifter för framtida beställningar?
            </p>
            <Link
              href={`/auth/signup?redirect=/flow/${packageType}/contact-info?bank=${bank}`}
              className="inline-flex items-center text-[#E95C63] hover:opacity-80 font-semibold text-sm"
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
            href={packageType === 'komplett'
              ? `/flow/${packageType}/delegation-guide?bank=${bank}`
              : (isFirstYear ? `/flow/${packageType}/add-transactions?bank=${bank}` : `/flow/${packageType}/upload-previous?bank=${bank}`)}
            className="flex-1 px-6 py-3 bg-white hover:bg-gray-50 border border-gray-200 text-slate-600 rounded-xl font-semibold transition-all duration-200 text-center"
          >
            Tillbaka
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 text-white rounded-xl font-bold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
            style={{ backgroundColor: '#173b57' }}
          >
            {loading ? 'Bearbetar...' : 'Fortsätt till bekräftelse'}
          </button>
        </div>
      </form>
    </FlowContainer>
  );
}
