'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const STANDARD_ENHETER = ['st', 'tim', 'paket'];
const MOMSSATSER = [25, 12, 6, 0];

type PrisMode = 'exkl' | 'inkl';

interface ProduktForm {
  namn: string;
  beskrivning: string;
  pris: string;
  prisMode: PrisMode;
  momssats: number;
  enhet: string;
  enhetEgen: string;
}

function getPrisExkl(pris: string, momssats: number, mode: PrisMode): number {
  const n = parseFloat(pris) || 0;
  return mode === 'exkl' ? n : n / (1 + momssats / 100);
}

function getPrisInkl(pris: string, momssats: number, mode: PrisMode): number {
  const n = parseFloat(pris) || 0;
  return mode === 'inkl' ? n : n * (1 + momssats / 100);
}

function Tooltip({ children, align = 'center' }: { children: React.ReactNode; align?: 'center' | 'start' }) {
  const boxCls = align === 'start'
    ? 'left-0'
    : 'left-1/2 -translate-x-1/2';
  const arrowCls = align === 'start'
    ? 'left-2'
    : 'left-1/2 -translate-x-1/2';
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

export default function RedigeraProduktPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState<ProduktForm>({
    namn: '', beskrivning: '', pris: '', prisMode: 'exkl', momssats: 25, enhet: 'st', enhetEgen: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from('produkter').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        const isStandard = STANDARD_ENHETER.includes(data.enhet);
        setForm({
          namn: data.namn ?? '',
          beskrivning: data.beskrivning ?? '',
          pris: String(data.pris_exkl_moms ?? ''),
          prisMode: 'exkl',
          momssats: data.momssats ?? 25,
          enhet: isStandard ? data.enhet : '_egen',
          enhetEgen: isStandard ? '' : (data.enhet ?? ''),
        });
      }
      setLoading(false);
    });
  }, [user, id]);

  function setPrisMode(mode: PrisMode) {
    if (!form.pris) { setForm(f => ({ ...f, prisMode: mode })); return; }
    const n = parseFloat(form.pris) || 0;
    let nytt: number;
    if (mode === 'inkl' && form.prisMode === 'exkl') {
      nytt = n * (1 + form.momssats / 100);
    } else if (mode === 'exkl' && form.prisMode === 'inkl') {
      nytt = n / (1 + form.momssats / 100);
    } else {
      nytt = n;
    }
    setForm(f => ({ ...f, prisMode: mode, pris: nytt.toFixed(2).replace(/\.00$/, '') }));
  }

  async function spara() {
    if (!user) return;
    setSaving(true); setError(null);
    try {
      const supabase = createClient();
      const enhet = form.enhet === '_egen' ? (form.enhetEgen.trim() || 'st') : form.enhet;
      const { error } = await supabase.from('produkter').update({
        namn: form.namn,
        beskrivning: form.beskrivning || null,
        pris_exkl_moms: getPrisExkl(form.pris, form.momssats, form.prisMode),
        momssats: form.momssats,
        enhet,
      }).eq('id', id);
      if (error) throw error;
      router.push('/kunder-produkter');
    } catch { setError('Något gick fel. Försök igen.'); }
    finally { setSaving(false); }
  }

  const inputCls = 'w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition';
  const ringStyle = { '--tw-ring-color': NAV_BG } as React.CSSProperties;
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  const prisExkl = getPrisExkl(form.pris, form.momssats, form.prisMode);
  const prisInkl = getPrisInkl(form.pris, form.momssats, form.prisMode);

  if (loading) return (
    <div className="flex items-center justify-center min-h-full">
      <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      <div className="px-8 pt-12 pb-6">
        <Link href="/kunder-produkter" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kunder & produkter
        </Link>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Redigera produkt</h1>
        <p className="text-slate-400 text-sm mt-2">{form.namn}</p>
      </div>

      <div className="px-8 pb-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2">
              <label className={labelCls}>Namn *</label>
              <input
                type="text" value={form.namn}
                onChange={e => setForm(f => ({ ...f, namn: e.target.value }))}
                placeholder="T.ex. Konsulttjänst, Webbdesign, Produkt X"
                className={inputCls} style={ringStyle}
              />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Beskrivning</label>
              <input
                type="text" value={form.beskrivning}
                onChange={e => setForm(f => ({ ...f, beskrivning: e.target.value }))}
                placeholder="Kort beskrivning (valfritt)"
                className={inputCls} style={ringStyle}
              />
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
                  <button
                    type="button"
                    onClick={() => setPrisMode('exkl')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                    style={{
                      backgroundColor: form.prisMode === 'exkl' ? 'white' : 'transparent',
                      color: form.prisMode === 'exkl' ? NAV_BG : '#94a3b8',
                      boxShadow: form.prisMode === 'exkl' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    Exkl. moms
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrisMode('inkl')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                    style={{
                      backgroundColor: form.prisMode === 'inkl' ? 'white' : 'transparent',
                      color: form.prisMode === 'inkl' ? NAV_BG : '#94a3b8',
                      boxShadow: form.prisMode === 'inkl' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    Inkl. moms
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="number" min="0" step="1" value={form.pris}
                  onChange={e => setForm(f => ({ ...f, pris: e.target.value }))}
                  placeholder="0"
                  className={inputCls + ' pr-10'} style={ringStyle}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">kr</span>
              </div>
              {form.pris && (
                <p className="mt-1.5 text-xs text-slate-400">
                  {form.prisMode === 'exkl'
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
              <select
                value={form.momssats}
                onChange={e => setForm(f => ({ ...f, momssats: Number(e.target.value) }))}
                className={inputCls} style={ringStyle}>
                {MOMSSATSER.map(s => <option key={s} value={s}>{s}%</option>)}
              </select>
            </div>

            {/* Enhet med "Egen" */}
            <div>
              <label className={labelCls}>Enhet</label>
              <select
                value={form.enhet}
                onChange={e => setForm(f => ({ ...f, enhet: e.target.value }))}
                className={inputCls} style={ringStyle}>
                {STANDARD_ENHETER.map(e => <option key={e} value={e}>{e}</option>)}
                <option value="_egen">Egen...</option>
              </select>
              {form.enhet === '_egen' && (
                <input
                  type="text" value={form.enhetEgen}
                  onChange={e => setForm(f => ({ ...f, enhetEgen: e.target.value }))}
                  placeholder="Skriv din enhet"
                  className={inputCls + ' mt-2'} style={ringStyle}
                />
              )}
            </div>

          </div>

          {error && <p className="mt-4 text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 mt-8">
            <Link href="/kunder-produkter"
              className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors text-center">
              Avbryt
            </Link>
            <button
              onClick={spara}
              disabled={form.namn.trim().length < 2 || saving}
              className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
              style={{ backgroundColor: NAV_BG }}>
              {saving ? 'Sparar...' : 'Spara ändringar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
