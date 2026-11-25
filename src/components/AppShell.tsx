'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from './AppSidebar';
import HjalpChat from './HjalpChat';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

// Fullskärmsflöden utan sidomeny (och utom den hårda låsningen)
const BARE_PREFIXES = ['/auth', '/onboarding', '/betalning', '/valkommen', '/koppla-bank'];
// Sidor utan låsning. /koppla-bank är sidan vi länkar kunderna till om
// bankkopplingen; den ska synas även utloggad och sköter inloggningen själv.
const OPEN_PREFIXES = ['/auth', '/koppla-bank'];

function hasActiveSubscription(status: string | null | undefined) {
  // 'invoice' = årskund som får tillgång direkt och faktureras i efterhand
  return status === 'active' || status === 'trialing' || status === 'invoice';
}

function Loader() {
  return (
    <div className="flex-1 flex items-center justify-center h-screen bg-slate-50">
      <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [menyOppen, setMenyOppen] = useState(false);

  const isBare = BARE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
  const isOpen = OPEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));

  // Hård låsning: styr obetalda/oonboardade till rätt steg
  useEffect(() => {
    if (loading || isOpen) return;
    if (!user) { router.replace('/auth/login'); return; }
    if (!profile) return;

    if (!profile.onboarding_done) {
      if (pathname !== '/onboarding') router.replace('/onboarding');
      return;
    }
    if (!hasActiveSubscription(profile.subscription_status)) {
      // Låt betal-, välkomst- och onboardingsidan ligga kvar (så man kan gå tillbaka
      // och ändra sina uppgifter); allt annat skickas till betalning
      if (pathname !== '/betalning' && pathname !== '/valkommen' && pathname !== '/onboarding') {
        router.replace('/betalning');
      }
    }
  }, [loading, isOpen, user, profile, pathname, router]);

  // Flödessidor renderas utan sidomeny
  if (isBare) return <>{children}</>;

  // Skyddade sidor: visa loader medan vi väntar in auth/profil eller en pågående omdirigering
  if (loading || !user || !profile) return <Loader />;
  if (!profile.onboarding_done || !hasActiveSubscription(profile.subscription_status)) return <Loader />;

  return (
    <div className="flex flex-col md:flex-row h-dvh overflow-hidden bg-slate-50">
      {/* På mobilen ligger menyn bakom en knapp i en list överst */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 flex-shrink-0" style={{ backgroundColor: NAV_BG }}>
        <span className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: CORAL }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span className="text-[15px] leading-none tracking-tight">
            <span className="text-white/55 font-medium">Enkla </span>
            <span className="text-white font-extrabold">Bokslut</span>
          </span>
        </span>
        <button
          onClick={() => setMenyOppen(true)}
          aria-label="Öppna menyn"
          className="w-10 h-10 -mr-2 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {menyOppen && <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMenyOppen(false)} />}

      {/* Ett klick på en länk i menyn stänger den på mobilen */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${menyOppen ? 'translate-x-0' : '-translate-x-full'}`}
        onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenyOppen(false); }}
      >
        <AppSidebar />
      </div>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <HjalpChat />
    </div>
  );
}
