'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';

const MOMSSATSER = [25, 12, 6, 0];
const STANDARD_ENHETER = ['st', 'tim', 'paket'];

type PrisMode = 'exkl' | 'inkl';

interface NyKundForm {
  namn: string; email: string; telefon: string; adress: string;
  postnummer: string; ort: string; land: string; org_nr: string;
}

interface NyProduktForm {
  namn: string; beskrivning: string;
  pris: string; prisMode: PrisMode;
  momssats: number; enhet: string; enhetEgen: string;
}

function getPrisExkl(pris: string, momssats: number, mode: PrisMode) {
  const n = parseFloat(pris) || 0;
  return mode === 'exkl' ? n : n / (1 + momssats / 100);
}

interface Rad {
  id: string;
  produktId: string | null;
  beskrivning: string;
  antal: string;
  enhet: string;
  apris: string;
  momssats: number;
}

interface KundForm {
  namn: string;
  email: string;
  adress: string;
  postnummer: string;
  ort: string;
  land: string;
  org_nr: string;
}

interface SparadKund {
  id: string;
  namn: string;
  email: string | null;
  adress: string | null;
  postnummer: string | null;
  ort: string | null;
  land: string | null;
  org_nr: string | null;
}

interface SparadProdukt {
  id: string;
  namn: string;
  beskrivning: string | null;
  pris_exkl_moms: number;
  momssats: number;
  enhet: string;
}

function datePlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

let _radCounter = 0;
function nyRad(): Rad {
  return { id: String(Date.now()) + String(++_radCounter), produktId: null, beskrivning: '', antal: '1', enhet: 'st', apris: '', momssats: 25 };
}

export default function NyFakturaPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [sparadeKunder, setSparadeKunder] = useState<SparadKund[]>([]);
  const [sparadeProdukter, setSparadeProdukter] = useState<SparadProdukt[]>([]);
  const [produktDropdownRadId, setProduktDropdownRadId] = useState<string | null>(null);
  const [valdKundId, setValdKundId] = useState<string>('');
  const [kund, setKund] = useState<KundForm>({ namn: '', email: '', adress: '', postnummer: '', ort: '', land: 'Sverige', org_nr: '' });

  const [fakturaNr, setFakturaNr] = useState('');
  const [fakturaDatum, setFakturaDatum] = useState(datePlus(0));
  const [leveransDatum, setLeveransDatum] = useState(datePlus(0));
  const [forfalloTyp, setForfalloTyp] = useState<'30' | '15' | '10' | 'custom'>('30');
  const [forfalloDatum, setForfalloDatum] = useState(datePlus(30));

  const [rader, setRader] = useState<Rad[]>([nyRad()]);
  const [betalsatt, setBetalsatt] = useState<'bankgiro' | 'kontonummer' | 'swish' | 'anpassat'>('bankgiro');
  const [bankgiro, setBankgiro] = useState('');
  const [kontonummer, setKontonummer] = useState('');
  const [swish, setSwish] = useState('');
  const [anpassatBetal, setAnpassatBetal] = useState('');
  const [meddelande, setMeddelande] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNyKundModal, setShowNyKundModal] = useState(false);
  const [kundForm, setKundForm] = useState<NyKundForm>({ namn: '', email: '', telefon: '', adress: '', postnummer: '', ort: '', land: 'Sverige', org_nr: '' });
  const [kundSaving, setKundSaving] = useState(false);
  const [kundError, setKundError] = useState<string | null>(null);

  const [nyProduktForRadId, setNyProduktForRadId] = useState<string | null>(null);
  const [produktForm, setProduktForm] = useState<NyProduktForm>({ namn: '', beskrivning: '', pris: '', prisMode: 'exkl', momssats: 25, enhet: 'st', enhetEgen: '' });
  const [produktSaving, setProduktSaving] = useState(false);
  const [produktError, setProduktError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function init() {
      const supabase = createClient();
      const [kRes, fRes, pRes] = await Promise.all([
        supabase.from('kunder').select('id,namn,email,adress,postnummer,ort,land,org_nr').order('namn'),
        supabase.from('fakturor').select('id', { count: 'exact', head: true }),
        supabase.from('produkter').select('id,namn,beskrivning,pris_exkl_moms,momssats,enhet').order('namn'),
      ]);
      if (kRes.data) setSparadeKunder(kRes.data);
      if (pRes.data) setSparadeProdukter(pRes.data);
      const count = fRes.count ?? 0;
      const year = new Date().getFullYear();
      setFakturaNr(`${year}-${String(count + 1).padStart(3, '0')}`);
      const { data: profileData } = await supabase.from('profiles').select('bankgiro').eq('id', user!.id).single();
      if (profileData?.bankgiro) setBankgiro(profileData.bankgiro);
    }
    init();
  }, [user]);

  useEffect(() => {
    if (forfalloTyp === 'custom') return;
    const base = new Date(fakturaDatum);
    base.setDate(base.getDate() + Number(forfalloTyp));
    setForfalloDatum(base.toISOString().split('T')[0]);
  }, [fakturaDatum, forfalloTyp]);

  function veljaKund(id: string) {
    if (id === '_add') { setShowNyKundModal(true); return; }
    setValdKundId(id);
    if (!id) {
      setKund({ namn: '', email: '', adress: '', postnummer: '', ort: '', land: 'Sverige', org_nr: '' });
      return;
    }
    const k = sparadeKunder.find(k => k.id === id);
    if (k) setKund({ namn: k.namn, email: k.email ?? '', adress: k.adress ?? '', postnummer: k.postnummer ?? '', ort: k.ort ?? '', land: k.land ?? 'Sverige', org_nr: k.org_nr ?? '' });
  }

  async function sparaNyKund() {
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
      }).select('id,namn,email,adress,postnummer,ort,land,org_nr').single();
      if (error) throw error;
      setSparadeKunder(prev => [...prev, data].sort((a, b) => a.namn.localeCompare(b.namn)));
      setValdKundId(data.id);
      setKund({ namn: data.namn, email: data.email ?? '', adress: data.adress ?? '', postnummer: data.postnummer ?? '', ort: data.ort ?? '', land: data.land ?? 'Sverige', org_nr: data.org_nr ?? '' });
      setShowNyKundModal(false);
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

  async function sparaNyProdukt() {
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
      setSparadeProdukter(prev => [...prev, data].sort((a, b) => a.namn.localeCompare(b.namn)));
      if (nyProduktForRadId) veljaProdukt(nyProduktForRadId, data);
      setNyProduktForRadId(null);
      setProduktForm({ namn: '', beskrivning: '', pris: '', prisMode: 'exkl', momssats: 25, enhet: 'st', enhetEgen: '' });
    } catch { setProduktError('Något gick fel. Försök igen.'); }
    finally { setProduktSaving(false); }
  }

  function veljaProdukt(radId: string, produkt: SparadProdukt) {
    setRader(prev => prev.map(r => r.id === radId ? {
      ...r,
      produktId: produkt.id,
      beskrivning: produkt.namn + (produkt.beskrivning ? ` – ${produkt.beskrivning}` : ''),
      apris: String(produkt.pris_exkl_moms),
      momssats: produkt.momssats,
      enhet: produkt.enhet,
    } : r));
    setProduktDropdownRadId(null);
  }

  function uppdateraRad(id: string, field: keyof Rad, value: string | number) {
    setRader(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function taBortRad(id: string) {
    setRader(prev => prev.filter(r => r.id !== id));
  }

  const radSummor = rader.map(r => {
    const antal = parseFloat(r.antal) || 0;
    const apris = parseFloat(r.apris) || 0;
    const exkl = antal * apris;
    const moms = exkl * (r.momssats / 100);
    return { exkl, moms, inkl: exkl + moms, momssats: r.momssats };
  });

  const totalExkl = radSummor.reduce((s, r) => s + r.exkl, 0);
  const totalInkl = radSummor.reduce((s, r) => s + r.inkl, 0);
  const momsByRate = MOMSSATSER.filter(s => s > 0).map(s => ({
    sats: s,
    belopp: radSummor.filter(r => r.momssats === s).reduce((acc, r) => acc + r.moms, 0),
  })).filter(m => m.belopp > 0);

  async function spara() {
    if (!user) return;
    if (!valdKundId) { setError('Välj en kund'); return; }
    if (rader.some(r => !r.produktId)) { setError('Alla rader måste ha en produkt vald'); return; }

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: inserted, error: dbErr } = await supabase.from('fakturor').insert({
        user_id: user.id,
        faktura_nr: fakturaNr,
        kund_id: valdKundId,
        kund_namn: kund.namn,
        kund_email: kund.email || null,
        kund_adress: kund.adress || null,
        kund_postnummer: kund.postnummer || null,
        kund_ort: kund.ort || null,
        kund_land: kund.land || 'Sverige',
        kund_org_nr: kund.org_nr || null,
        faktura_datum: fakturaDatum,
        leverans_datum: leveransDatum || null,
        forfallo_datum: forfalloDatum,
        rader: rader.map(r => ({ beskrivning: r.beskrivning, antal: parseFloat(r.antal) || 0, enhet: r.enhet, apris: parseFloat(r.apris) || 0, momssats: r.momssats })),
        belopp_exkl_moms: totalExkl,
        moms_belopp: totalInkl - totalExkl,
        belopp_inkl_moms: totalInkl,
        betalningsinfo:
          betalsatt === 'bankgiro' && bankgiro ? `Bankgiro: ${bankgiro}` :
          betalsatt === 'kontonummer' && kontonummer ? `Kontonummer: ${kontonummer}` :
          betalsatt === 'swish' && swish ? `Swish: ${swish}` :
          betalsatt === 'anpassat' && anpassatBetal ? anpassatBetal :
          null,
        meddelande: meddelande || null,
        status: 'obetald',
      }).select('id').single();
      if (dbErr) throw dbErr;
      if (betalsatt === 'bankgiro' && bankgiro) {
        await supabase.from('profiles').update({ bankgiro }).eq('id', user.id);
      }
      router.push(`/fakturor/${inserted.id}`);
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return null;

  const inputCls = 'w-full px-3 py-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition';
  const readonlyCls = 'w-full px-3 py-2.5 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl';
  const ringStyle = { '--tw-ring-color': NAV_BG } as React.CSSProperties;
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Header */}
      <div className="px-8 pt-10 pb-4 flex items-center gap-4">
        <button onClick={() => router.push('/fakturor')} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
      </div>
      <div className="px-8 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Ny faktura</h1>
      </div>

      <div className="px-8 pb-16 max-w-3xl flex flex-col gap-5">

        {/* ── Kund ── */}
        <Section title="Kund">
          {sparadeKunder.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-sm text-slate-500 mb-4">Du har inga sparade kunder ännu.</p>
              <button
                onClick={() => setShowNyKundModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: NAV_BG }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Lägg till kund
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls} style={{ marginBottom: 0 }}>Välj kund</label>
                  <button
                    type="button"
                    onClick={() => setShowNyKundModal(true)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: NAV_BG }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Lägg till kund
                  </button>
                </div>
                <select
                  value={valdKundId}
                  onChange={e => veljaKund(e.target.value)}
                  className={inputCls}
                  style={ringStyle}
                >
                  <option value="">— Välj kund —</option>
                  {sparadeKunder.map(k => (
                    <option key={k.id} value={k.id}>{k.namn}</option>
                  ))}
                </select>
              </div>

              {valdKundId && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="col-span-2">
                    <label className={labelCls}>Namn</label>
                    <div className={readonlyCls}>{kund.namn || '—'}</div>
                  </div>
                  {kund.email && (
                    <div>
                      <label className={labelCls}>E-post</label>
                      <div className={readonlyCls}>{kund.email}</div>
                    </div>
                  )}
                  {kund.org_nr && (
                    <div>
                      <label className={labelCls}>Org-nr / personnummer</label>
                      <div className={readonlyCls}>{kund.org_nr}</div>
                    </div>
                  )}
                  {kund.adress && (
                    <div className="col-span-2">
                      <label className={labelCls}>Adress</label>
                      <div className={readonlyCls}>{kund.adress}</div>
                    </div>
                  )}
                  {(kund.postnummer || kund.ort) && (
                    <div className="col-span-2">
                      <label className={labelCls}>Ort</label>
                      <div className={readonlyCls}>{[kund.postnummer, kund.ort].filter(Boolean).join(' ')}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Section>

        {/* ── Fakturadetaljer ── */}
        <Section title="Fakturadetaljer">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Fakturanummer</label>
              <input type="text" value={fakturaNr} onChange={e => setFakturaNr(e.target.value)}
                className={inputCls} style={ringStyle} />
            </div>
            <div>
              <label className={labelCls}>Fakturadatum</label>
              <input type="date" value={fakturaDatum} onChange={e => setFakturaDatum(e.target.value)}
                className={inputCls} style={ringStyle} />
            </div>
            <div>
              <label className={labelCls}>Leveransdatum</label>
              <input type="date" value={leveransDatum} onChange={e => setLeveransDatum(e.target.value)}
                className={inputCls} style={ringStyle} />
            </div>
            <div>
              <label className={labelCls}>Betalningsvillkor</label>
              <select value={forfalloTyp} onChange={e => setForfalloTyp(e.target.value as typeof forfalloTyp)}
                className={inputCls} style={ringStyle}>
                <option value="10">10 dagar</option>
                <option value="15">15 dagar</option>
                <option value="30">30 dagar</option>
                <option value="custom">Anpassat</option>
              </select>
            </div>
            {forfalloTyp === 'custom' && (
              <div>
                <label className={labelCls}>Förfallodatum</label>
                <input type="date" value={forfalloDatum} onChange={e => setForfalloDatum(e.target.value)}
                  className={inputCls} style={ringStyle} />
              </div>
            )}
          </div>
          {forfalloTyp !== 'custom' && (
            <p className="text-xs text-slate-400 mt-2">Förfaller: {new Date(forfalloDatum).toLocaleDateString('sv-SE')}</p>
          )}
        </Section>

        {/* ── Rader ── */}
        <Section title="Produkter">
          {sparadeProdukter.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-sm text-slate-500 mb-4">Du har inga sparade produkter ännu.</p>
              <Link
                href="/kunder-produkter/ny-produkt"
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: NAV_BG }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Lägg till produkt
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {/* Kolumnhuvud */}
                <div className="grid text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1 gap-2"
                  style={{ gridTemplateColumns: '1fr 60px 90px 80px 28px' }}>
                  <span>Produkt</span>
                  <span className="text-center">Antal</span>
                  <span className="text-right">À-pris exkl.</span>
                  <span className="text-right">Summa inkl.</span>
                  <span />
                </div>

                {rader.map((rad) => {
                  const antal = parseFloat(rad.antal) || 0;
                  const apris = parseFloat(rad.apris) || 0;
                  const summa = antal * apris * (1 + rad.momssats / 100);
                  return (
                    <div key={rad.id} className="relative">
                      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 60px 90px 80px 28px' }}>

                        {/* Produkt — read-only med dropdown-knapp */}
                        <div className="relative min-w-0">
                          <button
                            type="button"
                            onClick={() => setProduktDropdownRadId(produktDropdownRadId === rad.id ? null : rad.id)}
                            className={`w-full px-3 py-2 pr-8 text-sm rounded-xl border text-left truncate transition-colors ${
                              rad.produktId
                                ? 'text-slate-700 bg-slate-50 border-slate-100'
                                : 'text-slate-400 bg-white border-dashed border-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {rad.beskrivning || 'Välj produkt…'}
                          </button>
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <svg className="w-3.5 h-3.5 transition-transform duration-150" style={{ transform: produktDropdownRadId === rad.id ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>

                          {produktDropdownRadId === rad.id && (
                            <div className="absolute left-0 top-full mt-1 z-20 w-full min-w-[280px] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                              <div className="px-4 py-2.5 border-b border-slate-100">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Välj produkt</p>
                              </div>
                              {sparadeProdukter.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => veljaProdukt(rad.id, p)}
                                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-slate-700">{p.namn}</p>
                                    <p className="text-xs text-slate-400">{p.enhet} · {p.momssats}% moms</p>
                                  </div>
                                  <span className="text-sm font-semibold text-slate-600 tabular-nums ml-4 flex-shrink-0">
                                    {p.pris_exkl_moms.toLocaleString('sv-SE')} kr
                                  </span>
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => { setNyProduktForRadId(rad.id); setProduktDropdownRadId(null); }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold border-t border-slate-100 hover:bg-slate-50 transition-colors"
                                style={{ color: NAV_BG }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                                Lägg till produkt
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Antal — redigerbart */}
                        <input type="number" value={rad.antal} onChange={e => uppdateraRad(rad.id, 'antal', e.target.value)}
                          min="0" step="0.5" placeholder="1"
                          className="px-2 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 text-center transition"
                          style={ringStyle} />

                        {/* À-pris — skrivskyddat */}
                        <div className="px-2 py-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl text-right tabular-nums">
                          {rad.apris ? `${Number(rad.apris).toLocaleString('sv-SE')} kr` : '—'}
                        </div>

                        {/* Summa inkl moms */}
                        <p className="text-sm font-semibold text-slate-700 text-right tabular-nums">
                          {summa > 0 ? summa.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}
                        </p>

                        <button onClick={() => taBortRad(rad.id)} disabled={rader.length === 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Enhet + moms info under raden */}
                      {rad.produktId && (
                        <p className="text-xs text-slate-400 mt-1 pl-1">{rad.enhet} · {rad.momssats}% moms</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button onClick={() => setRader(prev => [...prev, nyRad()])}
                className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Lägg till rad
              </button>
            </>
          )}
        </Section>

        {/* ── Summering ── */}
        <Section title="Summering">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Belopp exkl. moms</span>
              <span className="font-medium text-slate-700 tabular-nums">{totalExkl.toLocaleString('sv-SE', { minimumFractionDigits: 2 })} kr</span>
            </div>
            {momsByRate.map(m => (
              <div key={m.sats} className="flex justify-between text-sm text-slate-500">
                <span>Moms {m.sats}%</span>
                <span className="font-medium text-slate-700 tabular-nums">{m.belopp.toLocaleString('sv-SE', { minimumFractionDigits: 2 })} kr</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-slate-100 mt-1">
              <span className="font-bold text-slate-800">Totalt inkl. moms</span>
              <span className="font-bold text-slate-800 text-lg tabular-nums">{totalInkl.toLocaleString('sv-SE', { minimumFractionDigits: 2 })} kr</span>
            </div>
          </div>
        </Section>

        {/* ── Betalningsinfo ── */}
        <Section title="Betalningsinfo">
          <div className="grid grid-cols-4 gap-2 mb-4">
            {([
              { key: 'bankgiro', label: 'Bankgiro' },
              { key: 'kontonummer', label: 'Kontonummer' },
              { key: 'swish', label: 'Swish' },
              { key: 'anpassat', label: 'Anpassat' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setBetalsatt(key)}
                className="py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all"
                style={{
                  borderColor: betalsatt === key ? NAV_BG : '#e2e8f0',
                  backgroundColor: betalsatt === key ? NAV_BG : 'transparent',
                  color: betalsatt === key ? 'white' : '#475569',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {betalsatt === 'bankgiro' && (
            <>
              <input
                type="text"
                value={bankgiro}
                onChange={e => setBankgiro(e.target.value)}
                placeholder="123-4567"
                className={inputCls}
                style={ringStyle}
              />
              <p className="text-xs text-slate-400 mt-2">Sparas automatiskt och fylls i på nästa faktura</p>
            </>
          )}
          {betalsatt === 'kontonummer' && (
            <input
              type="text"
              value={kontonummer}
              onChange={e => setKontonummer(e.target.value)}
              placeholder="1234-12345"
              className={inputCls}
              style={ringStyle}
            />
          )}
          {betalsatt === 'swish' && (
            <input
              type="text"
              value={swish}
              onChange={e => setSwish(e.target.value)}
              placeholder="070-000 00 00"
              className={inputCls}
              style={ringStyle}
            />
          )}
          {betalsatt === 'anpassat' && (
            <textarea
              rows={3}
              value={anpassatBetal}
              onChange={e => setAnpassatBetal(e.target.value)}
              placeholder="Skriv din betalningsinfo här..."
              className="w-full px-3 py-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 resize-none transition"
              style={ringStyle}
            />
          )}
        </Section>

        {/* ── Meddelande ── */}
        <Section title="Meddelande till kunden" optional>
          <textarea rows={3} value={meddelande} onChange={e => setMeddelande(e.target.value)}
            placeholder="T.ex. tack för ordern! Skriv fakturanumret som referens vid betalning."
            className="w-full px-3 py-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 resize-none transition"
            style={ringStyle} />
        </Section>

        {profile && (
          <div className="bg-slate-100 rounded-2xl px-5 py-4 text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-600">Säljare: </span>
            {[profile.full_name, profile.company_name, profile.org_nr].filter(Boolean).join(' · ')}
          </div>
        )}

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <button onClick={spara} disabled={saving}
          className="w-full py-3.5 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-50"
          style={{ backgroundColor: NAV_BG }}>
          {saving ? 'Sparar...' : 'Spara faktura'}
        </button>
      </div>

      {/* ── Modal: Ny produkt ── */}
      {nyProduktForRadId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNyProduktForRadId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-lg">Ny produkt</h2>
              <button onClick={() => setNyProduktForRadId(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Namn *</label>
                  <input type="text" value={produktForm.namn} onChange={e => setProduktForm(f => ({ ...f, namn: e.target.value }))}
                    placeholder="T.ex. Konsulttjänst, Webbdesign, Produkt X" autoFocus
                    className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                    style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Beskrivning</label>
                  <input type="text" value={produktForm.beskrivning} onChange={e => setProduktForm(f => ({ ...f, beskrivning: e.target.value }))}
                    placeholder="Kort beskrivning (valfritt)"
                    className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                    style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Pris</label>
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
                      placeholder="0"
                      className="w-full px-4 py-2.5 pr-10 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">kr</span>
                  </div>
                  {produktForm.pris && (
                    <p className="mt-1.5 text-xs text-slate-400">
                      {produktForm.prisMode === 'exkl'
                        ? <>Inkl. moms: <span className="font-semibold text-slate-600">{(getPrisExkl(produktForm.pris, produktForm.momssats, 'exkl') * (1 + produktForm.momssats / 100)).toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr</span></>
                        : <>Exkl. moms: <span className="font-semibold text-slate-600">{getPrisExkl(produktForm.pris, produktForm.momssats, produktForm.prisMode).toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr</span></>
                      }
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Momssats</label>
                  <select value={produktForm.momssats} onChange={e => setProduktForm(f => ({ ...f, momssats: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                    style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}>
                    {MOMSSATSER.map(s => <option key={s} value={s}>{s}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Enhet</label>
                  <select value={produktForm.enhet} onChange={e => setProduktForm(f => ({ ...f, enhet: e.target.value }))}
                    className="w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                    style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}>
                    {STANDARD_ENHETER.map(e => <option key={e} value={e}>{e}</option>)}
                    <option value="_egen">Egen...</option>
                  </select>
                  {produktForm.enhet === '_egen' && (
                    <input type="text" value={produktForm.enhetEgen}
                      onChange={e => setProduktForm(f => ({ ...f, enhetEgen: e.target.value }))}
                      placeholder="Skriv din enhet"
                      className="w-full mt-2 px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties} />
                  )}
                </div>
              </div>
              {produktError && <p className="mt-3 text-xs text-red-500">{produktError}</p>}
              <div className="flex gap-3 mt-6">
                <button onClick={() => setNyProduktForRadId(null)}
                  className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                  Avbryt
                </button>
                <button onClick={sparaNyProdukt} disabled={produktForm.namn.trim().length < 2 || produktSaving}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: NAV_BG }}>
                  {produktSaving ? 'Sparar...' : 'Spara & välj produkt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Ny kund ── */}
      {showNyKundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNyKundModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-lg">Lägg till kund</h2>
              <button onClick={() => setShowNyKundModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Namn *</label>
                  <input type="text" value={kundForm.namn} onChange={e => setKundForm(f => ({ ...f, namn: e.target.value }))}
                    placeholder="Kundnamn eller företagsnamn" autoFocus
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
                <button onClick={() => setShowNyKundModal(false)}
                  className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                  Avbryt
                </button>
                <button onClick={sparaNyKund} disabled={kundForm.namn.trim().length < 2 || kundSaving}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: NAV_BG }}>
                  {kundSaving ? 'Sparar...' : 'Spara kund'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, optional }: { title: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-5">
        <h2 className="font-bold text-slate-800">{title}</h2>
        {optional && <span className="text-xs text-slate-400 font-medium">(valfritt)</span>}
      </div>
      {children}
    </div>
  );
}
