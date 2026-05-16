'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

type Tab = 'fakturor' | 'kunder';

interface Faktura {
  id: string;
  faktura_nr: string;
  kund_namn: string;
  belopp_inkl_moms: number;
  forfallo_datum: string;
  faktura_datum: string;
  status: string;
}

interface Kund {
  id: string;
  namn: string;
  email: string | null;
  org_nr: string | null;
  ort: string | null;
}

interface NyKundForm {
  namn: string;
  email: string;
  telefon: string;
  adress: string;
  postnummer: string;
  ort: string;
  land: string;
  org_nr: string;
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  obetald:  { label: 'Obetald',  bg: '#FEF9C3', color: '#A16207' },
  betald:   { label: 'Betald',   bg: '#DCFCE7', color: '#166534' },
  forsenad: { label: 'Försenad', bg: '#FEE2E2', color: '#991B1B' },
};

export default function FakturorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('fakturor');
  const [fakturor, setFakturor] = useState<Faktura[]>([]);
  const [kunder, setKunder] = useState<Kund[]>([]);
  const [fetching, setFetching] = useState(true);

  const [showNyKund, setShowNyKund] = useState(false);
  const [kundForm, setKundForm] = useState<NyKundForm>({
    namn: '', email: '', telefon: '', adress: '', postnummer: '', ort: '', land: 'Sverige', org_nr: '',
  });
  const [kundSaving, setKundSaving] = useState(false);
  const [kundError, setKundError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function fetch() {
      const supabase = createClient();
      const [fRes, kRes] = await Promise.all([
        supabase.from('fakturor').select('id,faktura_nr,kund_namn,belopp_inkl_moms,forfallo_datum,faktura_datum,status').order('created_at', { ascending: false }),
        supabase.from('kunder').select('id,namn,email,org_nr,ort').order('namn'),
      ]);
      if (fRes.data) setFakturor(fRes.data);
      if (kRes.data) setKunder(kRes.data);
      setFetching(false);
    }
    fetch();
  }, [user]);

  async function sparaKund() {
    if (!user) return;
    setKundSaving(true);
    setKundError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('kunder').insert({
        user_id: user.id,
        ...kundForm,
        email: kundForm.email || null,
        telefon: kundForm.telefon || null,
        adress: kundForm.adress || null,
        postnummer: kundForm.postnummer || null,
        ort: kundForm.ort || null,
        org_nr: kundForm.org_nr || null,
      }).select('id,namn,email,org_nr,ort').single();
      if (error) throw error;
      setKunder(prev => [...prev, data].sort((a, b) => a.namn.localeCompare(b.namn)));
      setShowNyKund(false);
      setKundForm({ namn: '', email: '', telefon: '', adress: '', postnummer: '', ort: '', land: 'Sverige', org_nr: '' });
    } catch {
      setKundError('Något gick fel. Försök igen.');
    } finally {
      setKundSaving(false);
    }
  }

  async function taBortKund(id: string) {
    const supabase = createClient();
    await supabase.from('kunder').delete().eq('id', id);
    setKunder(prev => prev.filter(k => k.id !== id));
  }

  async function uppdateraStatus(id: string, status: string) {
    const supabase = createClient();
    await supabase.from('fakturor').update({ status }).eq('id', id);
    setFakturor(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  }


  if (loading || !user) return null;

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Header */}
      <div className="px-8 pt-12 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Fakturor</h1>
          <p className="text-slate-400 text-sm mt-2">Skapa och hantera dina kundfakturor</p>
        </div>
        <Link
          href="/fakturor/ny"
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl mt-1 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: NAV_BG }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Ny faktura
        </Link>
      </div>

      {/* Tabs */}
      <div className="px-8 flex gap-1 mb-6">
        {(['fakturor', 'kunder'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{
              backgroundColor: tab === t ? NAV_BG : 'transparent',
              color: tab === t ? 'white' : '#94a3b8',
            }}
          >
            {t === 'fakturor' ? `Fakturor (${fakturor.length})` : `Kunder (${kunder.length})`}
          </button>
        ))}
      </div>

      <div className="px-8 pb-12">

        {/* ── Fakturor-flik ── */}
        {tab === 'fakturor' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {fetching ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : fakturor.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F1F5F9' }}>
                  <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="font-bold text-slate-700 mb-1">Inga fakturor ännu</p>
                <p className="text-sm text-slate-400 max-w-xs mb-6 leading-relaxed">
                  Skapa din första faktura med knappen uppe till höger
                </p>
                <Link
                  href="/fakturor/ny"
                  className="px-5 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: NAV_BG }}
                >
                  Skapa faktura
                </Link>
              </div>
            ) : (
              <>
                {/* Kolumnhuvud */}
                <div
                  className="grid px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100"
                  style={{ gridTemplateColumns: '110px 1fr 130px 130px 110px' }}
                >
                  <span>Faktura nr</span>
                  <span>Kund</span>
                  <span className="text-right">Belopp inkl. moms</span>
                  <span>Förfallodatum</span>
                  <span>Status</span>
                </div>

                {fakturor.map(f => {
                  const st = STATUS_LABEL[f.status] ?? STATUS_LABEL.obetald;
                  const forfallen = f.status === 'obetald' && new Date(f.forfallo_datum) < new Date();
                  const effectiveSt = forfallen ? STATUS_LABEL.forsenad : st;
                  return (
                    <div
                      key={f.id}
                      className="grid px-6 py-4 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors group"
                      style={{ gridTemplateColumns: '110px 1fr 130px 130px 110px' }}
                    >
                      <span className="text-sm font-semibold text-slate-700">{f.faktura_nr}</span>
                      <span className="text-sm text-slate-600 truncate">{f.kund_namn}</span>
                      <span className="text-sm font-semibold text-slate-700 text-right">
                        {Number(f.belopp_inkl_moms).toLocaleString('sv-SE')} kr
                      </span>
                      <span className="text-sm text-slate-500">
                        {new Date(f.forfallo_datum).toLocaleDateString('sv-SE')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{ backgroundColor: effectiveSt.bg, color: effectiveSt.color }}
                        >
                          {forfallen ? 'Försenad' : effectiveSt.label}
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all">
                          {f.status !== 'betald' && (
                            <button
                              onClick={() => uppdateraStatus(f.id, 'betald')}
                              className="text-xs text-slate-400 hover:text-green-600 transition-colors"
                              title="Markera som betald"
                            >
                              ✓
                            </button>
                          )}
                          <Link
                            href={`/fakturor/${f.id}`}
                            className="text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            Öppna →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── Kunder-flik ── */}
        {tab === 'kunder' && (
          <div className="flex flex-col gap-4">

            {/* Kundlista */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {kunder.length === 0 && !showNyKund ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F1F5F9' }}>
                    <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="font-bold text-slate-700 mb-1">Inga sparade kunder</p>
                  <p className="text-sm text-slate-400 max-w-xs mb-6 leading-relaxed">
                    Spara kunder för att snabbt fylla i dem på nya fakturor
                  </p>
                  <button
                    onClick={() => setShowNyKund(true)}
                    className="px-5 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: NAV_BG }}
                  >
                    Lägg till kund
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-700">Sparade kunder</p>
                    <button
                      onClick={() => setShowNyKund(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: NAV_BG }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Lägg till
                    </button>
                  </div>
                  {kunder.map(k => (
                    <div key={k.id} className="flex items-center gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: CORAL }}
                      >
                        {k.namn[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700">{k.namn}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {[k.email, k.org_nr, k.ort].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <button
                        onClick={() => taBortKund(k.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-slate-300 hover:text-red-400 transition-all"
                      >
                        Ta bort
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Formulär: ny kund */}
            {showNyKund && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-slate-800">Ny kund</h2>
                  <button onClick={() => setShowNyKund(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Namn *</label>
                    <input type="text" value={kundForm.namn} onChange={e => setKundForm(f => ({ ...f, namn: e.target.value }))}
                      placeholder="Kundnamn eller företagsnamn"
                      className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">E-post</label>
                    <input type="email" value={kundForm.email} onChange={e => setKundForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="kund@example.com"
                      className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Telefon</label>
                    <input type="text" value={kundForm.telefon} onChange={e => setKundForm(f => ({ ...f, telefon: e.target.value }))}
                      placeholder="070-000 00 00"
                      className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Adress</label>
                    <input type="text" value={kundForm.adress} onChange={e => setKundForm(f => ({ ...f, adress: e.target.value }))}
                      placeholder="Gatuadress"
                      className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Postnummer</label>
                    <input type="text" value={kundForm.postnummer} onChange={e => setKundForm(f => ({ ...f, postnummer: e.target.value }))}
                      placeholder="123 45"
                      className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ort</label>
                    <input type="text" value={kundForm.ort} onChange={e => setKundForm(f => ({ ...f, ort: e.target.value }))}
                      placeholder="Stockholm"
                      className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Org-nr / personnummer</label>
                    <input type="text" value={kundForm.org_nr} onChange={e => setKundForm(f => ({ ...f, org_nr: e.target.value }))}
                      placeholder="556000-0000"
                      className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Land</label>
                    <input type="text" value={kundForm.land} onChange={e => setKundForm(f => ({ ...f, land: e.target.value }))}
                      placeholder="Sverige"
                      className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                  </div>
                </div>

                {kundError && <p className="mt-3 text-xs text-red-500">{kundError}</p>}

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowNyKund(false)}
                    className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                    Avbryt
                  </button>
                  <button onClick={sparaKund} disabled={kundForm.namn.trim().length < 2 || kundSaving}
                    className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: NAV_BG }}>
                    {kundSaving ? 'Sparar...' : 'Spara kund'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
