'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FlowContainer from '@/components/FlowContainer';
import { banks } from '@/data/banks';
import { packages } from '@/data/packages';
import { Bank } from '@/types';

export default function ConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;

  const bank = banks.find((b) => b.id === bankId);
  const packageInfo = packages.find((p) => p.id === packageType);
  const totalSteps = 5;

  return (
    <FlowContainer
      title="Tack för din beställning!"
      description="Vi har tagit emot dina uppgifter och börjar arbeta med din redovisning."
      currentStep={5}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-12 h-12 text-green-600"
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
        <h2 className="text-2xl font-bold text-trust-900 mb-4">
          Allt är klart!
        </h2>
        <p className="text-lg text-trust-600">
          Du kommer få en bekräftelse via e-post inom kort.
        </p>
      </div>

      <div className="bg-trust-50 border border-trust-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-trust-900 mb-4">
          Sammanfattning av din beställning:
        </h3>
        <div className="space-y-3 text-trust-700">
          <div className="flex justify-between">
            <span>Paket:</span>
            <span className="font-semibold">{packageInfo?.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Bank:</span>
            <span className="font-semibold">{bank?.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Pris:</span>
            <span className="font-semibold">{packageInfo?.price} kr</span>
          </div>
        </div>
      </div>

      <div className="bg-primary-50 border-l-4 border-primary-600 p-6 mb-8">
        <h3 className="font-semibold text-primary-900 mb-3">
          Vad händer nu?
        </h3>
        {packageType === 'ne-bilaga' ? (
          <ol className="space-y-3 text-primary-800">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                1
              </span>
              <span>Vi granskar dina kontoutdrag och börjar arbeta med din NE-bilaga</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                2
              </span>
              <span>Inom 24 timmar får du din färdiga NE-bilaga via e-post</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                3
              </span>
              <span>Du loggar in på Skatteverket och lämnar in NE-bilagan själv</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                4
              </span>
              <span>Klart! Kontakta oss vid frågor</span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-3 text-primary-800">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                1
              </span>
              <span>Vi granskar dina kontoutdrag och börjar arbeta med din NE-bilaga</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                2
              </span>
              <span>Innan inlämning får du en kopia på e-post för granskning</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                3
              </span>
              <span>Efter din godkännande lämnar vi in deklarationen åt dig</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                4
              </span>
              <span>Du får bekräftelse när allt är inlämnat - Klart!</span>
            </li>
          </ol>
        )}
      </div>

      <div className="bg-trust-50 border border-trust-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-trust-900 mb-3">
          Kontakta oss vid frågor
        </h3>
        <p className="text-sm text-trust-700 mb-3">
          Om du har några frågor eller funderingar, tveka inte att höra av dig!
        </p>
        <Link
          href="/kontakt"
          className="inline-block text-primary-600 hover:text-primary-700 font-medium"
        >
          Gå till kontaktsidan →
        </Link>
      </div>

      <div className="flex justify-center space-x-4">
        <Link
          href="/"
          className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
        >
          Tillbaka till startsidan
        </Link>
        <Link
          href="/tutorial"
          className="px-8 py-3 border-2 border-primary-600 text-primary-600 hover:bg-primary-50 rounded-lg font-semibold transition-colors"
        >
          Se guider
        </Link>
      </div>
    </FlowContainer>
  );
}
