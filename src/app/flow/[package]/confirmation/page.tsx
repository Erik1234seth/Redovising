'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import FlowContainer from '@/components/FlowContainer';
import { banks } from '@/data/banks';
import { packages } from '@/data/packages';
import { Bank } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

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

  // Protect route - require authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/login?redirect=/flow/${packageType}/confirmation?bank=${bankId}`);
    }
  }, [user, loading, router, packageType, bankId]);
  const supabase = createClient();

  const bank = banks.find((b) => b.id === bankId);
  const packageInfo = packages.find((p) => p.id === packageType);

  // Total steps: 9 for all, except ne-bilaga first year = 8
  const [totalSteps, setTotalSteps] = useState(9);
  const [orderSaved, setOrderSaved] = useState(false);

  useEffect(() => {
    const answersStr = sessionStorage.getItem(`qualificationAnswers_${packageType}`);
    if (answersStr) {
      const answers = JSON.parse(answersStr);
      if (packageType !== 'komplett' && answers.isFirstYear === true) {
        setTotalSteps(8);
      } else {
        setTotalSteps(9);
      }
    } else {
      setTotalSteps(9);
    }
  }, [packageType]);

  // Save order to database on mount
  useEffect(() => {
    const saveOrder = async () => {
      if (orderSaved) return; // Prevent duplicate saves

      // Retrieve uploaded file IDs from sessionStorage
      const statementFileId = sessionStorage.getItem('statementFileId');
      const previousFileId = sessionStorage.getItem('previousFileId');

      // Retrieve qualification answers for komplett/ne-bilaga packages
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

      const { data: newOrder, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select('id')
        .single();

      if (!error && newOrder) {
        setOrderSaved(true);

        // Link uploaded files to the order
        const fileIds = [statementFileId, previousFileId].filter(Boolean);
        if (fileIds.length > 0) {
          await supabase
            .from('files')
            .update({
              order_id: newOrder.id,
              guest_email: user ? null : email,
              guest_name: user ? null : name,
            })
            .in('id', fileIds);
        }

        // Link manual transactions to the order
        const tempOrderId = sessionStorage.getItem('tempOrderId');
        if (tempOrderId) {
          await supabase
            .from('manual_transactions')
            .update({
              order_id: newOrder.id,
              guest_email: user ? null : email,
              guest_name: user ? null : name,
            })
            .eq('order_id', tempOrderId);

          // Also update parsed transactions to use the real order ID
          await supabase
            .from('parsed_transactions')
            .update({ order_id: newOrder.id })
            .eq('order_id', tempOrderId);
        }

        // Export transactions to Excel and save to Supabase
        try {
          await fetch('/api/export-transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: newOrder.id }),
          });
          console.log('Transactions exported successfully');
        } catch (exportError) {
          console.error('Error exporting transactions:', exportError);
        }

        // Clean up sessionStorage
        sessionStorage.removeItem('statementFileUrl');
        sessionStorage.removeItem('statementFilePath');
        sessionStorage.removeItem('statementFileId');
        sessionStorage.removeItem('previousFileUrl');
        sessionStorage.removeItem('previousFilePath');
        sessionStorage.removeItem('previousFileId');
        sessionStorage.removeItem('tempOrderId');
        sessionStorage.removeItem(`qualificationAnswers_${packageType}`);
        sessionStorage.removeItem(`qualificationPopup_${packageType}`);

        // Increment order count for logged-in users
        if (user) {
          await supabase.rpc('increment_order_count', { user_id: user.id });
          // Refresh profile to update order count in UI
          await refreshProfile();
        }
      }
    };

    if (bankId && packageType && (user || email)) {
      saveOrder();
    }
  }, [bankId, packageType, email, user, orderSaved, supabase, refreshProfile, name, phone, company]);

  return (
    <FlowContainer
      title="Tack för din beställning!"
      description="Vi har tagit emot dina uppgifter och börjar arbeta med din redovisning."
      currentStep={totalSteps}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gold-500/20 border-2 border-gold-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-12 h-12 text-gold-500"
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
        <h2 className="text-2xl font-bold text-white mb-4">
          Beställningen är mottagen!
        </h2>
      </div>

      {/* Next steps */}
      <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-6 mb-8">
        <h3 className="font-semibold text-white mb-4 text-center">Vad händer nu?</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <p className="text-warm-300 pt-1">
              Vi granskar dina kontoutdrag och börjar arbeta med dina uppgifter
            </p>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <p className="text-warm-300 pt-1">
              {packageType === 'komplett'
                ? 'Du får ett mail när vi är klara'
                : 'Du får en länk via e-post när vi är klara där du kan hämta din färdiga NE-bilaga'
              }
            </p>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <p className="text-warm-300 pt-1">
              {packageType === 'komplett'
                ? 'Vi lämnar in din deklaration åt dig hos Skatteverket'
                : 'Du loggar in hos Skatteverket och lämnar in NE-bilagan själv'
              }
            </p>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold">
              4
            </div>
            <p className="text-warm-300 pt-1">
              Klart! Kontakta oss vid frågor
            </p>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-6 mb-8">
        <h3 className="font-semibold text-white mb-4">
          Sammanfattning av din beställning:
        </h3>
        <div className="space-y-3 text-warm-300">
          <div className="flex justify-between">
            <span>Paket:</span>
            <span className="font-semibold text-gold-500">{packageInfo?.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Bank:</span>
            <span className="font-semibold text-white">{bank?.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Pris:</span>
            <span className="font-semibold text-gold-500">{packageInfo?.price} kr</span>
          </div>
          {(name || email) && (
            <>
              <div className="border-t border-navy-600 my-3 pt-3"></div>
              <div className="flex justify-between">
                <span>Kontakt:</span>
                <span className="font-semibold text-white text-right">{name}</span>
              </div>
              <div className="flex justify-between">
                <span>E-post:</span>
                <span className="font-semibold text-warm-400 text-right">{email}</span>
              </div>
              {phone && (
                <div className="flex justify-between">
                  <span>Telefon:</span>
                  <span className="font-semibold text-warm-400 text-right">{phone}</span>
                </div>
              )}
              {company && (
                <div className="flex justify-between">
                  <span>Företag:</span>
                  <span className="font-semibold text-warm-400 text-right">{company}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-amber-500 mb-2">
              Viktigt att tänka på
            </h3>
            <p className="text-sm text-warm-300 mb-2">
              <strong className="text-white">Du ansvarar för dina underlag.</strong> Vi utgår från dina kontoutdrag, men du behöver ha kvitton och fakturor för alla transaktioner som ingår i verksamheten.
            </p>
            <p className="text-sm text-warm-300">
              Vid en eventuell granskning från Skatteverket kan du behöva visa upp dessa. Vi hör av oss om vi har frågor om specifika transaktioner.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-6 mb-8">
        <h3 className="font-semibold text-white mb-3">
          Kontakta oss vid frågor
        </h3>
        <p className="text-sm text-warm-300 mb-3">
          Om du har några frågor eller funderingar, tveka inte att höra av dig!
        </p>
        <Link
          href="/kontakt"
          className="inline-flex items-center text-gold-500 hover:text-gold-400 font-semibold transition-colors"
        >
          Gå till kontaktsidan
          <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Link
          href="/"
          className="px-8 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105 text-center"
        >
          Tillbaka till startsidan
        </Link>
        <Link
          href="/kontakt"
          className="px-8 py-3 bg-navy-800 hover:bg-navy-600 border-2 border-gold-500/50 hover:border-gold-500 text-white rounded-xl font-bold transition-all duration-200 text-center"
        >
          Kontakta oss
        </Link>
      </div>
    </FlowContainer>
  );
}
