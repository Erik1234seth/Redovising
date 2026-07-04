'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from './AppSidebar';
import HjalpChat from './HjalpChat';

// Fullskärmsflöden utan sidomeny (och utom den hårda låsningen)
const BARE_PREFIXES = ['/auth', '/onboarding', '/betalning', '/valkommen'];

function hasActiveSubscription(status: string | null | undefined) {
  return status === 'active' || status === 'trialing';
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

  const isBare = BARE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
  const isAuthPath = pathname === '/auth' || pathname.startsWith('/auth/');

  // Hård låsning: styr obetalda/oonboardade till rätt steg
  useEffect(() => {
    if (loading || isAuthPath) return;
    if (!user) { router.replace('/auth/login'); return; }
    if (!profile) return;

    if (!profile.onboarding_done) {
      if (pathname !== '/onboarding') router.replace('/onboarding');
      return;
    }
    if (!hasActiveSubscription(profile.subscription_status)) {
      // Låt betal- och välkomstsidan ligga kvar; allt annat skickas till betalning
      if (pathname !== '/betalning' && pathname !== '/valkommen') router.replace('/betalning');
    }
  }, [loading, isAuthPath, user, profile, pathname, router]);

  // Flödessidor renderas utan sidomeny
  if (isBare) return <>{children}</>;

  // Skyddade sidor: visa loader medan vi väntar in auth/profil eller en pågående omdirigering
  if (loading || !user || !profile) return <Loader />;
  if (!profile.onboarding_done || !hasActiveSubscription(profile.subscription_status)) return <Loader />;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <HjalpChat />
    </div>
  );
}
