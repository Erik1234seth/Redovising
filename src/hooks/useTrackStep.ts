'use client';

import { useEffect } from 'react';

export function useTrackStep(step: string, packageType?: string, bank?: string, userId?: string) {
  useEffect(() => {
    // Get or create anonymous session ID
    let sessionId = sessionStorage.getItem('analyticsSessionId');
    if (!sessionId) {
      sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('analyticsSessionId', sessionId);
    }

    // Fire-and-forget, never blocks the user
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, packageType, bank, sessionId, userId }),
    }).catch(() => {});
  }, [step, packageType, bank, userId]);
}
