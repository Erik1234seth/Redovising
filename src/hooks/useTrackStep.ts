'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/track';

export function useTrackStep(step: string, packageType?: string, bank?: string, userId?: string) {
  useEffect(() => {
    trackEvent(step, { packageType, bank, userId });
  }, [step, packageType, bank, userId]);
}
