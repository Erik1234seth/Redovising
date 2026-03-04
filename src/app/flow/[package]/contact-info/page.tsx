'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

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

  const [formData, setFormData] = useState({ email: '', name: '', phone: '', company: '' });
  const [existingCustomer, setExistingCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFirstYear, setIsFirstYear] = useState(false);

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

  const checkExistingCustomer = async (email: string) => {
    if (user) return;
    const { data } = await supabase.from('profiles').select('id').eq('email', email).single();
    setExistingCustomer(!!data);
  };

  const handleEmailBlur = () => {
    if (formData.email && !user) checkExistingCustomer(formData.email);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const queryParams = new URLSearchParams({
      bank,
      email: formData.email,
      name: formData.name,
      phone: formData.phone,
      company: formData.company,
    });
    router.push(`/flow/${packageType}/review-and-accept?${queryParams.toString()}`);
  };

  const totalSteps = (packageType !== 'komplett' && isFirstYear) ? 8 : 9;
  const currentStep = (packageType !== 'komplett' && isFirstYear) ? 6 : 7;

  const inputClass = "w-full px-4 py-3 bg-gray-50 border border-gray-200 text-slate-900 rounded-xl outline-none transition placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed";

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
          <div className="border border-gray-200 rounded-xl p-4 mb-6" style={{ backgroundColor: `${NAV_BG}05` }}>
            <div className="flex items-start">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-semibold mb-1" style={{ color: NAV_BG }}>
                  Vi ser att du har köpt från oss tidigare!
                </h4>
                <p className="text-sm text-slate-600">
                  <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: CORAL }}>
                    Logga in
                  </Link>
                  {' '}för att se din orderhistorik och snabbare checkout.
                </p>
              </div>
            </div>
          </div>
        )}

        {[
          { id: 'email', label: 'E-postadress *', type: 'email', placeholder: 'din@epost.se', hint: 'Vi skickar din färdiga NE-bilaga hit', disabled: !!user },
          { id: 'name', label: 'Namn *', type: 'text', placeholder: 'För- och efternamn', hint: null, disabled: false },
          { id: 'phone', label: 'Telefonnummer *', type: 'tel', placeholder: '070-123 45 67', hint: 'För att nå dig vid eventuella frågor', disabled: false },
          { id: 'company', label: 'Företagsnamn (Enskild firma) *', type: 'text', placeholder: 'Namnet på din enskilda firma', hint: null, disabled: false },
        ].map(({ id, label, type, placeholder, hint, disabled }) => (
          <div key={id}>
            <label htmlFor={id} className="block text-sm font-medium text-slate-600 mb-2">{label}</label>
            <input
              type={type}
              id={id}
              name={id}
              required
              value={formData[id as keyof typeof formData]}
              onChange={handleChange}
              onBlur={id === 'email' ? handleEmailBlur : undefined}
              disabled={disabled}
              className={inputClass}
              placeholder={placeholder}
              onFocus={e => e.currentTarget.style.borderColor = NAV_BG}
              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            />
            {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
          </div>
        ))}

        {!user && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-slate-600 mb-3">
              Vill du spara dina uppgifter för framtida beställningar?
            </p>
            <Link
              href={`/auth/signup?redirect=/flow/${packageType}/contact-info?bank=${bank}`}
              className="inline-flex items-center font-semibold text-sm hover:opacity-80 transition-opacity"
              style={{ color: CORAL }}
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
            className="flex-1 px-6 py-3 bg-white hover:bg-gray-50 border border-gray-200 hover:border-slate-300 text-slate-700 rounded-xl font-semibold transition-all duration-200 text-center"
          >
            Tillbaka
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 text-white rounded-xl font-bold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: NAV_BG }}
          >
            {loading ? 'Bearbetar...' : 'Fortsätt till bekräftelse'}
          </button>
        </div>
      </form>
    </FlowContainer>
  );
}
