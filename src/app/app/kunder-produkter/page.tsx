'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';
const STANDARD_ENHETER = ['st', 'tim', 'paket'];
const MOMSSATSER = [25, 12, 6, 0];

type Tab = 'kunder' | 'produkter';
type PrisMode = 'exkl' | 'inkl';

interface Kund {
  id: string;
  namn: string;
  email: string | null;
  org_nr: string | null;
  ort: string | null;
}

interface Produkt {
  id: string;
  namn: string;
  beskrivning: string | null;
  pris_exkl_moms: number;
  momssats: number;
  enhet: string;
}

interface KundForm {
  namn: string; email: string; telefon: string; adress: string;
  postnummer: string; ort: string; land: string; org_nr: string;
}

interface ProduktForm {
  namn: string; beskrivning: string;
  pris: string; prisMode: PrisMode;
  momssats: number; enhet: string; enhetEgen: string;
}

function getPrisExkl(pris: string, momssats: number, mode: PrisMode) {
  const n = parseFloat(pris) || 0;
  return mode === 'exkl' ? n : n / (1 + momssats / 100);
}
function getPrisInkl(pris: string, momssats: number, mode: PrisMode) {
  const n = parseFloat(pris) || 0;
  return mode === 'inkl' ? n : n * (1 + momssats / 100);
}

function Tooltip({ children, align = 'center' }: { children: React.ReactNode; align?: 'center' | 'start' }) {
  const boxCls = align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2';
  const arrowCls = align === 'start' ? 'left-2' : 'left-1/2 -translate-x-1/2';
  return (
    <div className="relative group inline-flex">
      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-xs flex items-center justify-center cursor-default font-bold leading-none select-none">?</span>
      <div className={`absolute bottom-full ${boxCls} mb-2 w-72 bg-slate-800 text-white text-xs rounded-xl p-3 shadow-xl hidden group-hover:block z-10 pointer-events-none`}>
        {children}
        <div className={`absolute top-full ${arrowCls} border-4 border-transparent border-t-slate-800`} />
      </div>
    </div>
  );
}

const inputCls = 'w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition';
const ringStyle = { '--tw-ring-color': NAV_BG } as React.CSSProperties;
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

export default function KunderProdukterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('kunder');
  const [kunder, setKunder] = useState<Kund[]>([]);
  const [produkter, setProdukter] = useState<Produkt[]>([]);
  const [fetching, setFetching] = useState(true);

  // Kund modal
  const [showNyKund, setShowNyKund] = useState(false);
  const [kundForm, setKundForm] = useState<KundForm>({ namn: '', email: '', telefon: '', adress: '', postnummer: '', ort: '', land: 'Sverige', org_nr: '' });
  const [kundSaving, setKundSaving] = useState(false);
  const [kundError, setKundError] = useState<string | null>(null);

  // Produkt modal
  const [showNyProdukt, setShowNyProdukt] = useState(false);
  const [produktForm, setProduktForm] = useState<ProduktForm>({ namn: '', beskrivning: '', pris: '', prisMode: 'exkl', momssats: 25, enhet: 'st', enhetEgen: '' });
  const [produktSaving, setProduktSaving] = useState(false);
  const [produktError, setProduktError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('kunder').select('id,namn,email,org_nr,ort').order('namn'),
      supabase.from('produkter').select('id,namn,beskrivning,pris_exkl_moms,momssats,enhet').order('namn'),
    ]).then(([kRes, pRes]) => {
      if (kRes.data) setKunder(kRes.data);
      if (pRes.data) setProdukter(pRes.data);
      setFetching(false);
    });
  }, [user]);

  async function taBortKund(id: string) {
    const supabase = createClient();
    await supabase.from('kunder').delete().eq('id', id);
    setKunder(prev => prev.filter(k => k.id !== id));
  }

  async function taBortProdukt(id: string) {
    const supabase = createClient();
    await supabase.from('produkter').delete().eq('id', id);
    setProdukter(prev => prev.filter(p => p.id !== id));
  }

  async function sparaKund() {
    if (!user) return;
    setKundSaving(true); setKundError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('kunder').insert({
        user_id: user.id,
        namn: kundForm.namn,
        email: kundForm.email || null,
        telefon: kundForm.telefon || null,
        adress: kundForm.adress || null,
        postnummer: kundForm.postnummer || null,
        ort: kundForm.ort || null,
        land: kundForm.land || null,
        org_nr: kundForm.org_nr || null,
      }).select('id,namn,email,org_nr,ort').single();
      if (error) throw error;
      setKunder(prev => [...prev, data].sort((a, b) => a.namn.localeCompare(b.namn)));
      setShowNyKund(false);
      setKundForm({ namn: '', email: '', telefon: '', adress: '', postnummer: '', ort: '', land: 'Sverige', org_nr: '' });
    } catch { setKundError('Något gick fel. Försök igen.'); }
    finally { setKundSaving(false); }
  }

  function setPrisMode(mode: PrisMode) {
    if (!produktForm.pris) { setProduktForm(f => ({ ...f, prisMode: mode })); return; }
    const n = parseFloat(produktForm.pris) || 0;
    let nytt: number;
    if (mode === 'inkl' && produktForm.prisMode === 'exkl') nytt = n * (1 + produktForm.momssats / 100);
    else if (mode === 'exkl' && produktForm.prisMode === 'inkl') nytt = n / (1 + produktForm.momssats / 100);
    else nytt = n;
    setProduktForm(f => ({ ...f, prisMode: mode, pris: nytt.toFixed(2).replace(/\.00$/, '') }));
  }

  async function sparaProdukt() {
    if (!user) return;
    setProduktSaving(true); setProduktError(null);
    try {
      const supabase = createClient();
      const enhet = produktForm.enhet === '_egen' ? (produktForm.enhetEgen.trim() || 'st') : produktForm.enhet;
      const { data, error } = await supabase.from('produkter').insert({
        user_id: user.id,
        namn: produktForm.namn,
        beskrivning: produktForm.beskrivning || null,
        pris_exkl_moms: getPrisExkl(produktForm.pris, produktForm.momssats, produktForm.prisMode),
        momssats: produktForm.momssats,
        enhet,
      }).select('id,namn,beskrivning,pris_exkl_moms,momssats,enhet').single();
      if (error) throw error;
      setProdukter(prev => [...prev, data].sort((a, b) => a.namn.localeCompare(b.namn)));
      setShowNyProdukt(false);
      setProduktForm({ namn: '', beskrivning: '', pris: '', prisMode: 'exkl', momssats: 25, enhet: 'st', enhetEgen: '' });
    } catch { setProduktError('Något gick fel. Försök igen.'); }
    finally { setProduktSaving(false); }
  }

  if (loading || !user) return null;

  const prisInkl = getPrisInkl(produktForm.pris, produktForm.momssats, produktForm.prisMode);
  const prisExkl = getPrisExkl(produktForm.pris, produktForm.momssats, produktForm.prisMode);

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Header */}
      <div className="px-8 pt-12 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Kunder & produkter</h1>
          <p className="text-slate-400 text-sm mt-2">Hantera dina kunder och produkter</p>
        </div>
        {tab === 'kunder' ? (
          <button
            onClick={() => setShowNyKund(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl mt-1 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: NAV_BG }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Ny kund
          </button>
        ) : (
          <button
            onClick={() => setShowNyProdukt(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl mt-1 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: NAV_BG }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Ny produkt
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-8 flex gap-1 mb-6">
        {(['kunder', 'produkter'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{ backgroundColor: tab === t ? NAV_BG : 'transparent', color: tab === t ? 'white' : '#94a3b8' }}>
            {t === 'kunder' ? `Kunder (${kunder.length})` : `Produkter (${produkter.length})`}
          </button>
        ))}
      </div>

      <div className="px-8 pb-12">

        {/* ── Kunder ── */}
        {tab === 'kunder' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {fetching ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : kunder.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F1F5F9' }}>
                  <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="font-bold text-slate-700 mb-1">Inga sparade kunder</p>
                <p className="text-sm text-slate-400 max-w-xs mb-6 leading-relaxed">
                  Spara kunder för att snabbt fylla i dem på nya fakturor
                </p>
                <button onClick={() => setShowNyKund(true)}
                  className="px-5 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: NAV_BG }}>
                  Lägg till kund
                </button>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-700">Sparade kunder</p>
                </div>
                {kunder.map(k => (
                  <div key={k.id} className="flex items-center gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: CORAL }}>
                      {k.namn[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{k.namn}</p>
                      <p className="text-xs text-slate-400 truncate">{[k.email, k.org_nr, k.ort].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`/kunder-produkter/kund/${k.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Redigera
                      </a>
                      <button onClick={() => taBortKund(k.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 bg-slate-100 hover:text-red-500 hover:bg-red-50 transition-all" title="Ta bort">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── Produkter ── */}
        {tab === 'produkter' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {fetching ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : produkter.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F1F5F9' }}>
                  <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <p className="font-bold text-slate-700 mb-1">Inga produkter än</p>
                <p className="text-sm text-slate-400 max-w-xs mb-6 leading-relaxed">
                  Lägg till dina produkter och tjänster för att snabbt välja dem på fakturor
                </p>
                <button onClick={() => setShowNyProdukt(true)}
                  className="px-5 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: NAV_BG }}>
                  Lägg till produkt
                </button>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-700">Sparade produkter & tjänster</p>
                </div>
                <div
                  className="grid px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100"
                  style={{ gridTemplateColumns: '1fr 110px 110px 70px 120px' }}>
                  <span>Namn</span>
                  <span className="text-right">Exkl. moms</span>
                  <span className="text-right">Inkl. moms</span>
                  <span className="text-center">Moms</span>
                  <span />
                </div>
                {produkter.map(p => {
                  const inkl = p.pris_exkl_moms * (1 + p.momssats / 100);
                  return (
                    <div
                      key={p.id}
                      className="grid px-6 py-4 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors group"
                      style={{ gridTemplateColumns: '1fr 110px 110px 70px 120px' }}>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{p.namn}</p>
                        <p className="text-xs text-slate-400">{[p.beskrivning, p.enhet].filter(Boolean).join(' · ')}</p>
                      </div>
                      <span className="text-sm text-slate-500 text-right tabular-nums">
                        {p.pris_exkl_moms.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                      </span>
                      <span className="text-sm font-semibold text-slate-700 text-right tabular-nums">
                        {inkl.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                      </span>
                      <span className="text-xs text-center text-slate-400">{p.momssats}%</span>
                      <div className="flex items-center justify-end gap-2">
                        <a href={`/kunder-produkter/produkt/${p.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Redigera
                        </a>
                        <button onClick={() => taBortProdukt(p.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 bg-slate-100 hover:text-red-500 hover:bg-red-50 transition-all" title="Ta bort">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Ny kund ── */}
      {showNyKund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNyKund(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-lg">Ny kund</h2>
              <button onClick={() => setShowNyKund(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Namn *</label>
                  <input type="text" value={kundForm.namn} onChange={e => setKundForm(f => ({ ...f, namn: e.target.value }))}
                    placeholder="Kundnamn eller företagsnamn" autoFocus className={inputCls} style={ringStyle} />
                </div>
                <div>
                  <label className={labelCls}>E-post</label>
                  <input type="email" value={kundForm.email} onChange={e => setKundForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="kund@example.com" className={inputCls} style={ringStyle} />
                </div>
                <div>
                  <label className={labelCls}>Telefon</label>
                  <input type="text" value={kundForm.telefon} onChange={e => setKundForm(f => ({ ...f, telefon: e.target.value }))}
                    placeholder="070-000 00 00" className={inputCls} style={ringStyle} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Adress</label>
                  <input type="text" value={kundForm.adress} onChange={e => setKundForm(f => ({ ...f, adress: e.target.value }))}
                    placeholder="Gatuadress" className={inputCls} style={ringStyle} />
                </div>
                <div>
                  <label className={labelCls}>Postnummer</label>
                  <input type="text" value={kundForm.postnummer} onChange={e => setKundForm(f => ({ ...f, postnummer: e.target.value }))}
                    placeholder="123 45" className={inputCls} style={ringStyle} />
                </div>
                <div>
                  <label className={labelCls}>Ort</label>
                  <input type="text" value={kundForm.ort} onChange={e => setKundForm(f => ({ ...f, ort: e.target.value }))}
                    placeholder="Stockholm" className={inputCls} style={ringStyle} />
                </div>
                <div>
                  <label className={labelCls}>Org-nr / personnummer</label>
                  <input type="text" value={kundForm.org_nr} onChange={e => setKundForm(f => ({ ...f, org_nr: e.target.value }))}
                    placeholder="556000-0000" className={inputCls} style={ringStyle} />
                </div>
                <div>
                  <label className={labelCls}>Land</label>
                  <input type="text" value={kundForm.land} onChange={e => setKundForm(f => ({ ...f, land: e.target.value }))}
                    placeholder="Sverige" className={inputCls} style={ringStyle} />
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
          </div>
        </div>
      )}

      {/* ── Modal: Ny produkt ── */}
      {showNyProdukt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNyProdukt(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-lg">Ny produkt</h2>
              <button onClick={() => setShowNyProdukt(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Namn *</label>
                  <input type="text" value={produktForm.namn} onChange={e => setProduktForm(f => ({ ...f, namn: e.target.value }))}
                    placeholder="T.ex. Konsulttjänst, Webbdesign, Produkt X" autoFocus className={inputCls} style={ringStyle} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Beskrivning</label>
                  <input type="text" value={produktForm.beskrivning} onChange={e => setProduktForm(f => ({ ...f, beskrivning: e.target.value }))}
                    placeholder="Kort beskrivning (valfritt)" className={inputCls} style={ringStyle} />
                </div>

                {/* Pris med toggle och tooltip */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className={labelCls} style={{ marginBottom: 0 }}>Pris</label>
                      <Tooltip align="start">
                        <div className="space-y-2">
                          <div>
                            <p className="font-bold text-white mb-0.5">Inkl. moms</p>
                            <p className="text-slate-300">Vanligt vid försäljning till privatpersoner. Kunden ser slutpriset — t.ex. 99 kr.</p>
                          </div>
                          <div>
                            <p className="font-bold text-white mb-0.5">Exkl. moms</p>
                            <p className="text-slate-300">Vanligt vid försäljning till företag. Kunden faktureras utan moms och drar av den själv.</p>
                          </div>
                        </div>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                      {(['exkl', 'inkl'] as PrisMode[]).map(mode => (
                        <button key={mode} type="button" onClick={() => setPrisMode(mode)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                          style={{
                            backgroundColor: produktForm.prisMode === mode ? 'white' : 'transparent',
                            color: produktForm.prisMode === mode ? NAV_BG : '#94a3b8',
                            boxShadow: produktForm.prisMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          }}>
                          {mode === 'exkl' ? 'Exkl. moms' : 'Inkl. moms'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <input type="number" min="0" step="1" value={produktForm.pris}
                      onChange={e => setProduktForm(f => ({ ...f, pris: e.target.value }))}
                      placeholder="0" className={inputCls + ' pr-10'} style={ringStyle} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">kr</span>
                  </div>
                  {produktForm.pris && (
                    <p className="mt-1.5 text-xs text-slate-400">
                      {produktForm.prisMode === 'exkl'
                        ? <>Inkl. moms: <span className="font-semibold text-slate-600">{prisInkl.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr</span></>
                        : <>Exkl. moms: <span className="font-semibold text-slate-600">{prisExkl.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr</span></>
                      }
                    </p>
                  )}
                </div>

                {/* Momssats med tooltip */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <label className={labelCls} style={{ marginBottom: 0 }}>Momssats</label>
                    <Tooltip>
                      <div className="space-y-1.5">
                        <p><span className="font-bold text-white">25%</span> <span className="text-slate-300">— Standard (kläder, elektronik, tjänster)</span></p>
                        <p><span className="font-bold text-white">12%</span> <span className="text-slate-300">— Restaurang, hotell</span></p>
                        <p><span className="font-bold text-white">6%</span> <span className="text-slate-300">— Livsmedel, böcker, tidningar, kollektivtrafik</span></p>
                        <p><span className="font-bold text-white">0%</span> <span className="text-slate-300">— Export, försäkring, finanstjänster</span></p>
                      </div>
                    </Tooltip>
                  </div>
                  <select value={produktForm.momssats} onChange={e => setProduktForm(f => ({ ...f, momssats: Number(e.target.value) }))}
                    className={inputCls} style={ringStyle}>
                    {MOMSSATSER.map(s => <option key={s} value={s}>{s}%</option>)}
                  </select>
                </div>

                {/* Enhet med "Egen" */}
                <div>
                  <label className={labelCls}>Enhet</label>
                  <select value={produktForm.enhet} onChange={e => setProduktForm(f => ({ ...f, enhet: e.target.value }))}
                    className={inputCls} style={ringStyle}>
                    {STANDARD_ENHETER.map(e => <option key={e} value={e}>{e}</option>)}
                    <option value="_egen">Egen...</option>
                  </select>
                  {produktForm.enhet === '_egen' && (
                    <input type="text" value={produktForm.enhetEgen}
                      onChange={e => setProduktForm(f => ({ ...f, enhetEgen: e.target.value }))}
                      placeholder="Skriv din enhet" className={inputCls + ' mt-2'} style={ringStyle} />
                  )}
                </div>
              </div>

              {produktError && <p className="mt-3 text-xs text-red-500">{produktError}</p>}
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowNyProdukt(false)}
                  className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                  Avbryt
                </button>
                <button onClick={sparaProdukt} disabled={produktForm.namn.trim().length < 2 || produktSaving}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: NAV_BG }}>
                  {produktSaving ? 'Sparar...' : 'Spara produkt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
