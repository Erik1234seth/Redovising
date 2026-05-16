'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const ENHETER = ['st', 'tim', 'dag', 'm²', 'm', 'kg', 'paket', 'mån'];
const MOMSSATSER = [25, 12, 6, 0];

interface Rad {
  id: string;
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

function datePlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

let _radCounter = 0;
function nyRad(): Rad {
  return { id: String(Date.now()) + String(++_radCounter), beskrivning: '', antal: '1', enhet: 'st', apris: '', momssats: 25 };
}

export default function NyFakturaPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [sparadeKunder, setSparadeKunder] = useState<SparadKund[]>([]);
  const [valdKundId, setValdKundId] = useState<string>(''); // '' = manuell
  const [kund, setKund] = useState<KundForm>({ namn: '', email: '', adress: '', postnummer: '', ort: '', land: 'Sverige', org_nr: '' });

  const [fakturaNr, setFakturaNr] = useState('');
  const [fakturaDatum, setFakturaDatum] = useState(datePlus(0));
  const [leveransDatum, setLeveransDatum] = useState(datePlus(0));
  const [forfalloTyp, setForfalloTyp] = useState<'30' | '15' | '10' | 'custom'>('30');
  const [forfalloDatum, setForfalloDatum] = useState(datePlus(30));

  const [rader, setRader] = useState<Rad[]>([nyRad()]);
  const [betalningsinfo, setBetalningsinfo] = useState('');
  const [meddelande, setMeddelande] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function init() {
      const supabase = createClient();
      const [kRes, fRes] = await Promise.all([
        supabase.from('kunder').select('id,namn,email,adress,postnummer,ort,land,org_nr').order('namn'),
        supabase.from('fakturor').select('id', { count: 'exact', head: true }),
      ]);
      if (kRes.data) setSparadeKunder(kRes.data);
      const count = fRes.count ?? 0;
      const year = new Date().getFullYear();
      setFakturaNr(`${year}-${String(count + 1).padStart(3, '0')}`);
    }
    init();
  }, [user]);

  // Sync förfallodatum when faktura datum or typ changes
  useEffect(() => {
    if (forfalloTyp === 'custom') return;
    const base = new Date(fakturaDatum);
    base.setDate(base.getDate() + Number(forfalloTyp));
    setForfalloDatum(base.toISOString().split('T')[0]);
  }, [fakturaDatum, forfalloTyp]);

  function veljaKund(id: string) {
    setValdKundId(id);
    if (!id) {
      setKund({ namn: '', email: '', adress: '', postnummer: '', ort: '', land: 'Sverige', org_nr: '' });
      return;
    }
    const k = sparadeKunder.find(k => k.id === id);
    if (k) setKund({ namn: k.namn, email: k.email ?? '', adress: k.adress ?? '', postnummer: k.postnummer ?? '', ort: k.ort ?? '', land: k.land ?? 'Sverige', org_nr: k.org_nr ?? '' });
  }

  function uppdateraRad(id: string, field: keyof Rad, value: string | number) {
    setRader(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function taBortRad(id: string) {
    setRader(prev => prev.filter(r => r.id !== id));
  }

  // Beräkningar
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
    if (!kund.namn.trim()) { setError('Fyll i kundnamn'); return; }
    if (rader.some(r => !r.beskrivning.trim() || !r.apris)) { setError('Alla rader måste ha beskrivning och pris'); return; }

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: inserted, error: dbErr } = await supabase.from('fakturor').insert({
        user_id: user.id,
        faktura_nr: fakturaNr,
        kund_id: valdKundId || null,
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
        betalningsinfo: betalningsinfo || null,
        meddelande: meddelande || null,
        status: 'obetald',
      }).select('id').single();
      if (dbErr) throw dbErr;
      router.push(`/fakturor/${inserted.id}`);
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return null;

  const inputCls = 'w-full px-3 py-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition';
  const ringStyle = { '--tw-ring-color': NAV_BG } as React.CSSProperties;
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Header */}
      <div className="px-8 pt-10 pb-4 flex items-center gap-4">
        <button onClick={() => router.push('/fakturor')} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
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
          {sparadeKunder.length > 0 && (
            <div className="mb-4">
              <label className={labelCls}>Välj sparad kund</label>
              <select
                value={valdKundId}
                onChange={e => veljaKund(e.target.value)}
                className={inputCls}
                style={ringStyle}
              >
                <option value="">— Fyll i manuellt —</option>
                {sparadeKunder.map(k => (
                  <option key={k.id} value={k.id}>{k.namn}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Namn *</label>
              <input type="text" value={kund.namn} onChange={e => setKund(f => ({ ...f, namn: e.target.value }))}
                placeholder="Kundnamn eller företagsnamn" className={inputCls} style={ringStyle} />
            </div>
            <div>
              <label className={labelCls}>E-post</label>
              <input type="email" value={kund.email} onChange={e => setKund(f => ({ ...f, email: e.target.value }))}
                placeholder="kund@example.com" className={inputCls} style={ringStyle} />
            </div>
            <div>
              <label className={labelCls}>Org-nr / personnummer</label>
              <input type="text" value={kund.org_nr} onChange={e => setKund(f => ({ ...f, org_nr: e.target.value }))}
                placeholder="556000-0000" className={inputCls} style={ringStyle} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Adress</label>
              <input type="text" value={kund.adress} onChange={e => setKund(f => ({ ...f, adress: e.target.value }))}
                placeholder="Gatuadress" className={inputCls} style={ringStyle} />
            </div>
            <div>
              <label className={labelCls}>Postnummer</label>
              <input type="text" value={kund.postnummer} onChange={e => setKund(f => ({ ...f, postnummer: e.target.value }))}
                placeholder="123 45" className={inputCls} style={ringStyle} />
            </div>
            <div>
              <label className={labelCls}>Ort</label>
              <input type="text" value={kund.ort} onChange={e => setKund(f => ({ ...f, ort: e.target.value }))}
                placeholder="Stockholm" className={inputCls} style={ringStyle} />
            </div>
          </div>
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
        <Section title="Artiklar och tjänster">
          <div className="flex flex-col gap-2">
            {/* Kolumnhuvud */}
            <div className="grid text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1 gap-2"
              style={{ gridTemplateColumns: '1fr 60px 80px 90px 80px 70px 28px' }}>
              <span>Beskrivning</span>
              <span className="text-center">Antal</span>
              <span>Enhet</span>
              <span className="text-right">À-pris</span>
              <span className="text-right">Moms</span>
              <span className="text-right">Summa</span>
              <span />
            </div>

            {rader.map((rad, i) => {
              const antal = parseFloat(rad.antal) || 0;
              const apris = parseFloat(rad.apris) || 0;
              const summa = antal * apris * (1 + rad.momssats / 100);
              return (
                <div key={rad.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 60px 80px 90px 80px 70px 28px' }}>
                  <input type="text" value={rad.beskrivning} onChange={e => uppdateraRad(rad.id, 'beskrivning', e.target.value)}
                    placeholder={`Artikel/tjänst ${i + 1}`}
                    className="px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                    style={ringStyle} />
                  <input type="number" value={rad.antal} onChange={e => uppdateraRad(rad.id, 'antal', e.target.value)}
                    min="0" step="0.5" placeholder="1"
                    className="px-2 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 text-center transition"
                    style={ringStyle} />
                  <select value={rad.enhet} onChange={e => uppdateraRad(rad.id, 'enhet', e.target.value)}
                    className="px-2 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                    style={ringStyle}>
                    {ENHETER.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <input type="number" value={rad.apris} onChange={e => uppdateraRad(rad.id, 'apris', e.target.value)}
                    min="0" step="1" placeholder="0"
                    className="px-2 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 text-right transition"
                    style={ringStyle} />
                  <select value={rad.momssats} onChange={e => uppdateraRad(rad.id, 'momssats', Number(e.target.value))}
                    className="px-2 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition"
                    style={ringStyle}>
                    {MOMSSATSER.map(s => <option key={s} value={s}>{s}%</option>)}
                  </select>
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
          <label className={labelCls}>Bankgiro / Plusgiro / IBAN</label>
          <textarea rows={2} value={betalningsinfo} onChange={e => setBetalningsinfo(e.target.value)}
            placeholder={`T.ex.\nBankgiro: 123-4567\nIBAN: SE00 0000 0000 0000 0000 0000`}
            className="w-full px-3 py-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 resize-none transition"
            style={ringStyle} />
          <p className="text-xs text-slate-400 mt-1.5">Visas på fakturan så kunden vet hur de ska betala</p>
        </Section>

        {/* ── Meddelande ── */}
        <Section title="Meddelande till kunden" optional>
          <textarea rows={3} value={meddelande} onChange={e => setMeddelande(e.target.value)}
            placeholder="T.ex. tack för ordern! Skriv fakturanumret som referens vid betalning."
            className="w-full px-3 py-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 resize-none transition"
            style={ringStyle} />
        </Section>

        {/* Säljare (från profil) */}
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
