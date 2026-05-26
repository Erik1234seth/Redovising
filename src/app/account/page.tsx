'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const NAV_BG = '#173b57';
const ACCENT = '#d04a52';
const ACCENT_LIGHT = '#FDEAEA';

type Tab = 'bokforing' | 'ne-bilaga' | 'moms' | 'prenumeration';

const tabs: { id: Tab; label: string }[] = [
  { id: 'bokforing', label: 'Bokföring' },
  { id: 'ne-bilaga', label: 'NE-bilaga' },
  { id: 'moms', label: 'Moms' },
  { id: 'prenumeration', label: 'Prenumeration' },
];

function getInitials(fullName: string | null | undefined, email: string) {
  if (fullName) {
    const parts = fullName.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return email[0].toUpperCase();
}

export default function AccountPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('bokforing');

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EEF5FF' }}>
        <div className="w-6 h-6 border-2 border-blue-200 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? user.email?.split('@')[0];
  const userInitials = getInitials(profile?.full_name, user.email ?? '?');

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EEF5FF' }}>

      {/* Header — fortsätter navyfärgen från navigationen */}
      <div style={{ background: `linear-gradient(160deg, ${NAV_BG} 0%, #1d5070 100%)` }}>
        <div className="max-w-7xl mx-auto px-6 pt-6 pb-0">

          <div className="flex items-center justify-between pb-5">
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg"
                style={{ backgroundColor: ACCENT }}
              >
                {userInitials}
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">
                  Välkommen, {firstName}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {profile?.company_name ?? 'Enskild firma'}
                </p>
              </div>
            </div>

            <div
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}
            >
              Räkenskapsår {new Date().getFullYear()}
            </div>
          </div>

          {/* Flikar */}
          <div className="flex gap-1">
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-5 py-2.5 text-sm font-medium rounded-t-xl transition-all duration-150 border-b-2"
                  style={{
                    color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                    backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                    borderBottomColor: active ? '#fff' : 'transparent',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Innehåll */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'bokforing' && <BokforingTab />}
        {activeTab === 'ne-bilaga' && <NEBilagaTab />}
        {activeTab === 'moms' && <MomsTab />}
        {activeTab === 'prenumeration' && <PrenumerationTab email={user.email ?? ''} />}
      </div>
    </div>
  );
}

function BokforingTab() {
  const [chatMessage, setChatMessage] = useState('');

  return (
    <div className="flex gap-5" style={{ height: 'calc(100vh - 205px)' }}>

      {/* Transaktionspanel */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden min-w-0" style={{ border: '1px solid #D6E8FF' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0" style={{ backgroundColor: '#F4F9FF', borderBottomColor: '#D6E8FF' }}>
          <div>
            <h2 className="font-semibold text-slate-800">Transaktioner</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Lägg till och kontera dina transaktioner</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 text-sm font-medium border rounded-lg transition-colors bg-white" style={{ color: '#64748B', borderColor: '#D6E8FF' }}>
              Ladda upp fil
            </button>
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-all hover:opacity-90"
              style={{ backgroundColor: ACCENT }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Lägg till
            </button>
          </div>
        </div>

        {/* Kolumnhuvud */}
        <div
          className="grid px-6 py-2.5 border-b text-xs font-semibold uppercase tracking-wide flex-shrink-0"
          style={{ gridTemplateColumns: '110px 1fr 100px 140px 70px', color: '#94A3B8', borderBottomColor: '#F1F5F9' }}
        >
          <span>Datum</span>
          <span>Beskrivning</span>
          <span className="text-right">Belopp</span>
          <span>Konto</span>
          <span>Moms</span>
        </div>

        {/* Tom vy */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: ACCENT_LIGHT }}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: ACCENT }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-700 mb-1">Inga transaktioner än</p>
            <p className="text-sm text-slate-400 max-w-xs">
              Lägg till din första transaktion manuellt eller ladda upp en bankfil
            </p>
          </div>
        </div>
      </div>

      {/* AI-chatt */}
      <div className="w-[300px] flex-shrink-0 rounded-2xl shadow-sm flex flex-col overflow-hidden" style={{ border: '1px solid #D6E8FF' }}>

        {/* Chattens header — gradient */}
        <div
          className="px-5 py-4 flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #b03840 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Assistent</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Hjälper dig kontera</p>
            </div>
          </div>
        </div>

        {/* Meddelanden */}
        <div className="flex-1 px-4 py-4 overflow-y-auto space-y-3 bg-white">
          <div className="flex gap-2 items-start">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: ACCENT }}
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-600 leading-relaxed"
              style={{ backgroundColor: '#F0F6FF' }}
            >
              Hej! Jag hjälper dig att kontera dina transaktioner mot BAS-kontoplanen. Välj en transaktion så föreslår jag rätt konto.
            </div>
          </div>
        </div>

        {/* Inmatning */}
        <div className="px-4 py-3 flex-shrink-0 bg-white border-t" style={{ borderTopColor: '#EEF4FF' }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              placeholder="Skriv ett meddelande..."
              className="flex-1 text-sm px-3 py-2.5 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none transition-colors"
              style={{ border: '1px solid #D6E8FF', backgroundColor: '#F4F9FF' }}
            />
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity"
              style={{ backgroundColor: ACCENT, opacity: chatMessage.trim() ? 1 : 0.4 }}
              disabled={!chatMessage.trim()}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NEBilagaTab() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-14 text-center" style={{ border: '1px solid #D6E8FF' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: ACCENT_LIGHT }}>
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: ACCENT }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="font-semibold text-slate-700 mb-1">NE-bilaga</p>
      <p className="text-sm text-slate-400 max-w-sm mx-auto">
        Uppdateras automatiskt när du kontering dina transaktioner. Ingen transaktion har konterats ännu.
      </p>
    </div>
  );
}

function MomsTab() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-14 text-center" style={{ border: '1px solid #D6E8FF' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: ACCENT_LIGHT }}>
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: ACCENT }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="font-semibold text-slate-700 mb-1">Momsredovisning</p>
      <p className="text-sm text-slate-400 max-w-sm mx-auto">
        Sammanställs automatiskt baserat på dina konteringar. Ingen moms har registrerats ännu.
      </p>
    </div>
  );
}

type Subscription = {
  status: string;
  billing_period: string;
  current_period_end: string | null;
  price_id: string;
};

function PrenumerationTab({ email }: { email: string }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    fetch('/api/stripe/subscription-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(r => r.json())
      .then(data => { setSubscription(data.subscription ?? null); setLoadingData(false); })
      .catch(() => setLoadingData(false));
  }, [email]);

  const handleManage = async () => {
    setRedirecting(true);
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const { url } = await res.json();
    window.location.href = url;
  };

  const statusLabel: Record<string, { text: string; color: string; bg: string }> = {
    active: { text: 'Aktiv', color: '#166534', bg: '#dcfce7' },
    trialing: { text: 'Testperiod', color: '#92400e', bg: '#fef3c7' },
    past_due: { text: 'Betalning förfallen', color: '#991b1b', bg: '#fee2e2' },
    canceled: { text: 'Avslutad', color: '#4b5563', bg: '#f3f4f6' },
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-14 text-center" style={{ border: '1px solid #D6E8FF' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: ACCENT_LIGHT }}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: ACCENT }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <p className="font-semibold text-slate-700 mb-1">Ingen aktiv prenumeration</p>
        <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
          Du har inte en aktiv prenumeration kopplad till detta konto.
        </p>
        <a
          href="/#packages"
          className="inline-block px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          Se prenumerationsalternativ
        </a>
      </div>
    );
  }

  const s = statusLabel[subscription.status] ?? { text: subscription.status, color: '#4b5563', bg: '#f3f4f6' };
  const renewalDate = subscription.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #D6E8FF' }}>
        <div className="px-6 py-4 border-b" style={{ backgroundColor: '#F4F9FF', borderBottomColor: '#D6E8FF' }}>
          <h2 className="font-semibold text-slate-800">Din prenumeration</h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center py-3 border-b" style={{ borderBottomColor: '#F1F5F9' }}>
            <span className="text-sm text-slate-500">Status</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ color: s.color, backgroundColor: s.bg }}>
              {s.text}
            </span>
          </div>

          <div className="flex justify-between items-center py-3 border-b" style={{ borderBottomColor: '#F1F5F9' }}>
            <span className="text-sm text-slate-500">Plan</span>
            <span className="text-sm font-semibold text-slate-800">
              Enkla Bokslut — {subscription.billing_period === 'yearly' ? '3 499 kr/år' : '299 kr/mån'}
            </span>
          </div>

          <div className="flex justify-between items-center py-3 border-b" style={{ borderBottomColor: '#F1F5F9' }}>
            <span className="text-sm text-slate-500">Fakturering</span>
            <span className="text-sm text-slate-700">{subscription.billing_period === 'yearly' ? 'Årsvis' : 'Månadsvis'}</span>
          </div>

          {renewalDate && (
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-slate-500">
                {subscription.status === 'canceled' ? 'Aktiv till' : 'Förnyas'}
              </span>
              <span className="text-sm text-slate-700">{renewalDate}</span>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={handleManage}
            disabled={redirecting}
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {redirecting ? 'Öppnar portalen...' : 'Hantera prenumeration →'}
          </button>
          <p className="text-xs text-slate-400 text-center mt-2">
            Ändra betalningsmetod, avsluta eller uppdatera din prenumeration
          </p>
        </div>
      </div>
    </div>
  );
}
