'use client';

import { useEffect, useState } from 'react';

export interface Kund {
  id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  org_nr: string | null;
  verksamhet: string | null;
  ort: string | null;
  kontext: string;
}

export const kundNamn = (k: Kund) => k.company_name || k.full_name || k.email || 'Namnlös kund';

/** Hämtar kundlistan en gång per panel. Delas av Underlag- och SIE-fliken. */
export function useKunder() {
  const [kunder, setKunder] = useState<Kund[]>([]);
  const [fel, setFel] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ai-test/kunder')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Kunde inte hämta kunder');
        setKunder(data.kunder);
      })
      .catch((err) => setFel(err instanceof Error ? err.message : 'Okänt fel'));
  }, []);

  return { kunder, fel };
}
