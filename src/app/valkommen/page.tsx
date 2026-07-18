'use client';

import { useState, useEffect } from 'react';
import AdFunnel from '@/components/AdFunnel';

// Same funnel as the ad popup on the landing page, as a standalone page — for
// linking an ad straight into the flow instead of via the popup. The card is
// white, so the page reads like the rest of the site (same bg as /kvalificera)
// rather than a dark spotlight backdrop.
export default function ValkommenPage() {
  const [refCode, setRefCode] = useState<string | null>(null);
  const [visitId, setVisitId] = useState<number | null>(null);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    setRefCode(ref);

    // Every visit here is an intentional funnel entry — log it and track
    // how far the visitor gets, same as the popup variants.
    fetch('/api/qr-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: ref || 'valkommen', stage: 'hook' }),
    })
      .then((r) => r.json())
      .then((data) => setVisitId(data.id ?? null))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <AdFunnel refCode={refCode} visitId={visitId} />
      </div>
    </div>
  );
}
