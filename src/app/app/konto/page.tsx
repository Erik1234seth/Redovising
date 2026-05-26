'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);

function getInitials(fullName: string | null | undefined, email: string) {
  if (fullName) {
    const parts = fullName.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return email[0].toUpperCase();
}

export default function KontoPage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [orgNr, setOrgNr] = useState('');
  const [adress, setAdress] = useState('');
  const [postnummer, setPostnummer] = useState('');
  const [ort, setOrt] = useState('');
  const [momsnr, setMomsnr] = useState('');
  const [verksamhet, setVerksamhet] = useState('');
  const [momsPeriod, setMomsPeriod] = useState<'månadsvis' | 'kvartalsvis' | 'helår' | null>(null);
  const [startAr, setStartAr] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subscription, setSubscription] = useState<{ status: string; billing_period: string; current_period_end: string | null } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<'monthly' | 'yearly' | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.email) {
      fetch('/api/stripe/subscription-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })
        .then(r => r.json())
        .then(data => setSubscription(data.subscription ?? null))
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setCompanyName(profile.company_name ?? '');
      setOrgNr(profile.org_nr ?? '');
      setAdress(profile.adress ?? '');
      setPostnummer(profile.postnummer ?? '');
      setOrt(profile.ort ?? '');
      setMomsnr(profile.momsnr ?? '');
      setVerksamhet(profile.verksamhet ?? '');
      setMomsPeriod(profile.moms_period ?? null);
      setStartAr(profile.start_ar ?? null);
    }
  }, [profile]);

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName || null,
          company_name: companyName || null,
          org_nr: orgNr || null,
          adress: adress || null,
          postnummer: postnummer || null,
          ort: ort || null,
          momsnr: momsnr || null,
          verksamhet: verksamhet || null,
          moms_period: momsPeriod,
          start_ar: startAr,
        })
        .eq('id', user.id);

      if (dbError) throw dbError;
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStartCheckout(billingPeriod: 'monthly' | 'yearly') {
    if (!user?.email) return;
    setCheckoutLoading(billingPeriod);
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingPeriod, email: user.email }),
    });
    const { url } = await res.json();
    window.location.href = url;
  }

  async function handleManageSubscription() {
    if (!user?.email) return;
    setPortalLoading(true);
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });
    const { url } = await res.json();
    window.location.href = url;
  }

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
  }

  const initials = getInitials(profile?.full_name, user.email ?? '?');

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Header */}
      <div className="px-8 pt-12 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Mitt konto</h1>
        <p className="text-slate-400 text-sm mt-2">Hantera din profil och inställningar</p>
      </div>

      <div className="px-8 pb-12 max-w-2xl flex flex-col gap-5">

        {/* Profilkort */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
              style={{ backgroundColor: CORAL }}
            >
              {initials}
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg leading-tight">{profile?.full_name ?? user.email?.split('@')[0]}</p>
              <p className="text-slate-400 text-sm">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Namn</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Ditt namn"
                className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition"
                style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">E-post</label>
              <input
                type="email"
                value={user.email ?? ''}
                disabled
                className="w-full px-4 py-2.5 text-sm text-slate-400 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Företagsnamn</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Din enskilda firma"
                  className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition"
                  style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Organisationsnummer</label>
                <input
                  type="text"
                  value={orgNr}
                  onChange={e => setOrgNr(e.target.value)}
                  placeholder="XXXXXXXX-XXXX"
                  className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition"
                  style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Adress</label>
              <input
                type="text"
                value={adress}
                onChange={e => setAdress(e.target.value)}
                placeholder="Gatuadress"
                className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition"
                style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Postnummer</label>
                <input
                  type="text"
                  value={postnummer}
                  onChange={e => setPostnummer(e.target.value)}
                  placeholder="123 45"
                  className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition"
                  style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ort</label>
                <input
                  type="text"
                  value={ort}
                  onChange={e => setOrt(e.target.value)}
                  placeholder="Stockholm"
                  className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition"
                  style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Momsregistreringsnummer (VAT)</label>
              <input
                type="text"
                value={momsnr}
                onChange={e => setMomsnr(e.target.value)}
                placeholder="SE556000000001"
                className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition"
                style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
              />
              <p className="text-xs text-slate-400 mt-1">Visas på fakturor. För enskild firma: SE + personnummer + 01</p>
            </div>
          </div>
        </div>

        {/* Verksamhetskort */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-1">Din verksamhet</h2>
          <p className="text-xs text-slate-400 mb-4">Används för att bokföra rätt och ge bättre förslag</p>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Beskrivning</label>
              <textarea
                rows={3}
                value={verksamhet}
                onChange={e => setVerksamhet(e.target.value)}
                placeholder="Beskriv kort vad du säljer eller utför..."
                className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white resize-none transition"
                style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Momsredovisning</label>
              <div className="flex flex-col gap-2">
                {(['månadsvis', 'kvartalsvis', 'helår'] as const).map(val => {
                  const labels: Record<string, string> = { månadsvis: 'Månadsvis', kvartalsvis: 'Kvartalsvis', helår: 'En gång per år' };
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMomsPeriod(val)}
                      className="flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-left transition-all duration-100"
                      style={{
                        borderColor: momsPeriod === val ? NAV_BG : '#e2e8f0',
                        backgroundColor: momsPeriod === val ? NAV_BG : 'transparent',
                      }}
                    >
                      <span className="text-sm font-semibold" style={{ color: momsPeriod === val ? 'white' : '#475569' }}>
                        {labels[val]}
                      </span>
                      {momsPeriod === val && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Startår för enskilda firman</label>
              <div className="grid grid-cols-5 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {YEARS.map(year => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setStartAr(year)}
                    className="py-2 rounded-lg text-xs font-semibold border-2 transition-all duration-100"
                    style={{
                      borderColor: startAr === year ? NAV_BG : '#e2e8f0',
                      backgroundColor: startAr === year ? NAV_BG : 'transparent',
                      color: startAr === year ? 'white' : '#475569',
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Spara + fel */}
        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-60"
          style={{ backgroundColor: NAV_BG }}
        >
          {saving ? 'Sparar...' : saved ? 'Sparat!' : 'Spara ändringar'}
        </button>

        {/* Prenumeration */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-1">Prenumeration</h2>
          <p className="text-xs text-slate-400 mb-4">Hantera din betalning och ditt abonnemang</p>

          {subscription ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Status</span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: subscription.status === 'active' ? '#dcfce7' : '#fee2e2',
                    color: subscription.status === 'active' ? '#166534' : '#991b1b',
                  }}
                >
                  {subscription.status === 'active' ? 'Aktiv' : subscription.status === 'canceled' ? 'Avslutad' : subscription.status}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Plan</span>
                <span className="text-sm font-semibold text-slate-700">
                  {subscription.billing_period === 'yearly' ? '3 499 kr/år' : '299 kr/mån'}
                </span>
              </div>
              {subscription.current_period_end && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-500">
                    {subscription.status === 'canceled' ? 'Aktiv till' : 'Förnyas'}
                  </span>
                  <span className="text-sm text-slate-700">
                    {new Date(subscription.current_period_end).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="w-full mt-2 py-2.5 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-60"
                style={{ backgroundColor: CORAL }}
              >
                {portalLoading ? 'Öppnar portalen...' : 'Hantera prenumeration →'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-400 mb-1">Välj ett abonnemang för att komma igång.</p>
              <button
                type="button"
                onClick={() => handleStartCheckout('monthly')}
                disabled={checkoutLoading !== null}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all disabled:opacity-60"
              >
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-700">Månadsvis</p>
                  <p className="text-xs text-slate-400">Ingen bindningstid</p>
                </div>
                <span className="text-sm font-extrabold" style={{ color: CORAL }}>
                  {checkoutLoading === 'monthly' ? '...' : '299 kr/mån'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleStartCheckout('yearly')}
                disabled={checkoutLoading !== null}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl border-2 transition-all disabled:opacity-60"
                style={{ borderColor: NAV_BG, backgroundColor: `${NAV_BG}08` }}
              >
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-700">Årsvis <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded" style={{ backgroundColor: CORAL, color: 'white' }}>SPARA 89 KR</span></p>
                  <p className="text-xs text-slate-400">Faktureras en gång per år</p>
                </div>
                <span className="text-sm font-extrabold" style={{ color: NAV_BG }}>
                  {checkoutLoading === 'yearly' ? '...' : '3 499 kr/år'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Logga ut */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-700 text-sm">Logga ut</p>
            <p className="text-xs text-slate-400 mt-0.5">Du loggas ut från alla enheter</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Logga ut
          </button>
        </div>

      </div>
    </div>
  );
}
