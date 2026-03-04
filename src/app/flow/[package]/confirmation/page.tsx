'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { banks } from '@/data/banks';
import { packages } from '@/data/packages';
import { Bank } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function ConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;
  const email = searchParams.get('email') || '';
  const name = searchParams.get('name') || '';
  const phone = searchParams.get('phone') || '';
  const company = searchParams.get('company') || '';

  const { user, refreshProfile, loading } = useAuth();
  useTrackStep('confirmation', packageType, bankId, user?.id);

  // Protect route - require authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/login?redirect=/flow/${packageType}/confirmation?bank=${bankId}`);
    }
  }, [user, loading, router, packageType, bankId]);

  const supabase = createClient();
  const bank = banks.find((b) => b.id === bankId);
  const packageInfo = packages.find((p) => p.id === packageType);

  const [totalSteps, setTotalSteps] = useState(9);
  const [orderSaved, setOrderSaved] = useState(false);

  useEffect(() => {
    const answersStr = sessionStorage.getItem(`qualificationAnswers_${packageType}`);
    if (answersStr) {
      const answers = JSON.parse(answersStr);
      setTotalSteps(packageType !== 'komplett' && answers.isFirstYear === true ? 8 : 9);
    } else {
      setTotalSteps(9);
    }
  }, [packageType]);

  // Save order to database on mount
  useEffect(() => {
    const saveOrder = async () => {
      if (orderSaved) return;

      const statementFileId = sessionStorage.getItem('statementFileId');
      const previousFileId = sessionStorage.getItem('previousFileId');
      const qualificationAnswersStr = sessionStorage.getItem(`qualificationAnswers_${packageType}`);
      const qualificationAnswers = qualificationAnswersStr ? JSON.parse(qualificationAnswersStr) : null;

      const orderData = {
        user_id: user?.id || null,
        guest_email: user ? null : email,
        guest_name: user ? null : name,
        guest_phone: user ? null : phone,
        guest_company: user ? null : company,
        package_type: packageType,
        bank: bankId,
        status: 'pending',
        qualification_answers: qualificationAnswers,
      };

      const { data: newOrder, error } = await supabase.from('orders').insert(orderData).select('id').single();

      if (!error && newOrder) {
        setOrderSaved(true);

        const fileIds = [statementFileId, previousFileId].filter(Boolean);
        if (fileIds.length > 0) {
          await supabase.from('files').update({ order_id: newOrder.id, guest_email: user ? null : email, guest_name: user ? null : name }).in('id', fileIds);
        }

        const tempOrderId = sessionStorage.getItem('tempOrderId');
        if (tempOrderId) {
          await supabase.from('manual_transactions').update({ order_id: newOrder.id, guest_email: user ? null : email, guest_name: user ? null : name }).eq('order_id', tempOrderId);
          await supabase.from('parsed_transactions').update({ order_id: newOrder.id }).eq('order_id', tempOrderId);
        }

        try {
          await fetch('/api/export-transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: newOrder.id }),
          });
        } catch (exportError) {
          console.error('Error exporting transactions:', exportError);
        }

        sessionStorage.removeItem('statementFileUrl');
        sessionStorage.removeItem('statementFilePath');
        sessionStorage.removeItem('statementFileId');
        sessionStorage.removeItem('previousFileUrl');
        sessionStorage.removeItem('previousFilePath');
        sessionStorage.removeItem('previousFileId');
        sessionStorage.removeItem('tempOrderId');
        sessionStorage.removeItem(`qualificationAnswers_${packageType}`);
        sessionStorage.removeItem(`qualificationPopup_${packageType}`);

        if (user) {
          await supabase.rpc('increment_order_count', { user_id: user.id });
          await refreshProfile();
        }
      }
    };

    if (bankId && packageType && (user || email)) {
      saveOrder();
    }
  }, [bankId, packageType, email, user, orderSaved, supabase, refreshProfile, name, phone, company]);

  const nextSteps = [
    'Vi granskar dina kontoutdrag och börjar arbeta med dina uppgifter',
    packageType === 'komplett'
      ? 'Du får ett mail när vi är klara'
      : 'Du får en länk via e-post när vi är klara där du kan hämta din färdiga NE-bilaga',
    packageType === 'komplett'
      ? 'Vi lämnar in din deklaration åt dig hos Skatteverket'
      : 'Du loggar in hos Skatteverket och lämnar in NE-bilagan själv',
    'Klart! Kontakta oss vid frågor',
  ];

  return (
    <FlowContainer
      title="Tack för din beställning!"
      description="Vi har tagit emot dina uppgifter och börjar arbeta med din redovisning."
      currentStep={totalSteps}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-2"
          style={{ backgroundColor: `${NAV_BG}15`, borderColor: NAV_BG }}>
          <svg className="w-12 h-12" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-4" style={{ color: NAV_BG }}>Beställningen är mottagen!</h2>
      </div>

      {/* Next steps */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
        <h3 className="font-semibold mb-4 text-center" style={{ color: NAV_BG }}>Vad händer nu?</h3>
        <div className="space-y-4">
          {nextSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white"
                style={{ backgroundColor: NAV_BG }}>
                {i + 1}
              </div>
              <p className="text-slate-600 pt-1">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Order summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
        <h3 className="font-semibold mb-4" style={{ color: NAV_BG }}>Sammanfattning av din beställning:</h3>
        <div className="space-y-3 text-slate-600">
          <div className="flex justify-between">
            <span>Paket:</span>
            <span className="font-semibold" style={{ color: NAV_BG }}>{packageInfo?.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Bank:</span>
            <span className="font-semibold text-slate-800">{bank?.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Pris:</span>
            <span className="font-semibold" style={{ color: NAV_BG }}>{packageInfo?.price} kr</span>
          </div>
          {(name || email) && (
            <>
              <div className="border-t border-gray-200 my-3 pt-3"></div>
              <div className="flex justify-between">
                <span>Kontakt:</span>
                <span className="font-semibold text-slate-800 text-right">{name}</span>
              </div>
              <div className="flex justify-between">
                <span>E-post:</span>
                <span className="font-semibold text-slate-500 text-right">{email}</span>
              </div>
              {phone && (
                <div className="flex justify-between">
                  <span>Telefon:</span>
                  <span className="font-semibold text-slate-500 text-right">{phone}</span>
                </div>
              )}
              {company && (
                <div className="flex justify-between">
                  <span>Företag:</span>
                  <span className="font-semibold text-slate-500 text-right">{company}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-amber-700 mb-2">Viktigt att tänka på</h3>
            <p className="text-sm text-amber-700 mb-2">
              <strong>Du ansvarar för dina underlag.</strong> Vi utgår från dina kontoutdrag, men du behöver ha kvitton och fakturor för alla transaktioner som ingår i verksamheten.
            </p>
            <p className="text-sm text-amber-700">
              Vid en eventuell granskning från Skatteverket kan du behöva visa upp dessa. Vi hör av oss om vi har frågor om specifika transaktioner.
            </p>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
        <h3 className="font-semibold mb-3" style={{ color: NAV_BG }}>Kontakta oss vid frågor</h3>
        <p className="text-sm text-slate-600 mb-3">
          Om du har några frågor eller funderingar, tveka inte att höra av dig!
        </p>
        <Link href="/kontakt" className="inline-flex items-center font-semibold transition-colors hover:opacity-80" style={{ color: CORAL }}>
          Gå till kontaktsidan
          <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Link
          href="/"
          className="px-8 py-3 text-white rounded-xl font-bold transition-all duration-200 hover:opacity-90 text-center"
          style={{ backgroundColor: NAV_BG }}
        >
          Tillbaka till startsidan
        </Link>
        <Link
          href="/kontakt"
          className="px-8 py-3 bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-slate-300 text-slate-700 rounded-xl font-bold transition-all duration-200 text-center"
        >
          Kontakta oss
        </Link>
      </div>
    </FlowContainer>
  );
}
