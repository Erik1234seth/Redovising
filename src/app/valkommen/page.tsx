'use client';

import { useState, useEffect } from 'react';
import AdFunnel from '@/components/AdFunnel';

// Same funnel as the ad popup on the landing page, as a standalone page — for
// linking an ad straight into the flow instead of via the popup. The card is
// white, so the page reads like the rest of the site (same bg as /kvalificera)
// rather than a dark spotlight backdrop.
export default function ValkommenPage() {
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    setRefCode(new URLSearchParams(window.location.search).get('ref'));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <AdFunnel refCode={refCode} />
      </div>
    </div>
  );
}
