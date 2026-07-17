'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const GA_ID = 'G-8XZDRG1PSH';
const STORAGE_KEY = 'cookie-consent'; // 'accepted' | 'declined'

declare global {
  interface Window {
    dataLayer?: unknown[];
    __gaLoaded?: boolean;
  }
}

// Injicerar Google Analytics först EFTER samtycke. Laddas aldrig annars.
function loadGoogleAnalytics() {
  if (typeof window === 'undefined' || window.__gaLoaded) return;
  window.__gaLoaded = true;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function gtag(...args: any[]) { window.dataLayer!.push(args); }
  gtag('js', new Date());
  gtag('config', GA_ID);
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'accepted') {
      loadGoogleAnalytics();
    } else if (stored !== 'declined') {
      setVisible(true);
    }

    // Låt en "Hantera cookies"-knapp öppna bannern igen
    const reopen = () => setVisible(true);
    window.addEventListener('open-cookie-settings', reopen);
    return () => window.removeEventListener('open-cookie-settings', reopen);
  }, []);

  // Banners och popups slåss om nederkanten av skärmen. Landningssidan väntar
  // in det här innan den visar sina ref-popups, så de aldrig hamnar under bannern.
  const announceResolved = () => window.dispatchEvent(new Event('cookie-consent-resolved'));

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    loadGoogleAnalytics();
    setVisible(false);
    announceResolved();
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setVisible(false);
    announceResolved();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6">
      <div
        className="mx-auto max-w-3xl rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
        style={{ backgroundColor: NAV_BG, boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}
      >
        <div className="flex-1">
          <p className="text-white font-bold text-sm mb-1">Vi använder cookies 🍪</p>
          <p className="text-white/60 text-[13px] leading-relaxed">
            Nödvändiga cookies krävs för att sajten ska fungera. Vi vill även gärna använda
            analyscookies för att förbättra tjänsten – men bara om du säger ja. Läs mer i vår{' '}
            <Link href="/cookiepolicy" className="underline hover:text-white transition-colors" style={{ color: CORAL }}>
              cookiepolicy
            </Link>
            .
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white/80 transition-colors hover:text-white"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            Endast nödvändiga
          </button>
          <button
            onClick={accept}
            className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: CORAL, boxShadow: `0 6px 16px ${CORAL}55` }}
          >
            Acceptera alla
          </button>
        </div>
      </div>
    </div>
  );
}
