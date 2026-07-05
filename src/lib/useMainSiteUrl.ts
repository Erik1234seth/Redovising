'use client';

import { useEffect, useState } from 'react';

// Räknar ut URL:en till den vanliga webbplatsen (utan "app."-subdomänen).
// Fungerar både i produktion (app.enklabokslut.se → enklabokslut.se) och
// lokalt (app.localhost:3000 → localhost:3000). Faller tillbaka på env/prod vid SSR.
export function useMainSiteUrl(): string {
  const fallback = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://enklabokslut.se';
  const [url, setUrl] = useState(fallback);

  useEffect(() => {
    const { protocol, host } = window.location;
    const mainHost = host.replace(/^app\./, '');
    setUrl(`${protocol}//${mainHost}`);
  }, []);

  return url;
}
