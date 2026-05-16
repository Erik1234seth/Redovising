'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';

interface KundForm {
  namn: string; email: string; telefon: string; adress: string;
  postnummer: string; ort: string; land: string; org_nr: string;
}

export default function RedigeraKundPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState<KundForm>({
    namn: '', email: '', telefon: '', adress: '', postnummer: '', ort: '', land: 'Sverige', org_nr: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from('kunder').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setForm({
          namn: data.namn ?? '',
          email: data.email ?? '',
          telefon: data.telefon ?? '',
          adress: data.adress ?? '',
          postnummer: data.postnummer ?? '',
          ort: data.ort ?? '',
          land: data.land ?? 'Sverige',
          org_nr: data.org_nr ?? '',
        });
      }
      setLoading(false);
    });
  }, [user, id]);

  async function spara() {
    if (!user) return;
    setSaving(true); setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('kunder').update({
        namn: form.namn,
        email: form.email || null,
        telefon: form.telefon || null,
        adress: form.adress || null,
        postnummer: form.postnummer || null,
        ort: form.ort || null,
        land: form.land || null,
        org_nr: form.org_nr || null,
      }).eq('id', id);
      if (error) throw error;
      router.push('/kunder-produkter');
    } catch { setError('Något gick fel. Försök igen.'); }
    finally { setSaving(false); }
  }

  const inputCls = 'w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition';
  const ringStyle = { '--tw-ring-color': NAV_BG } as React.CSSProperties;
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

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
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Redigera kund</h1>
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
                placeholder="Kundnamn eller företagsnamn"
                className={inputCls} style={ringStyle}
              />
            </div>
            <div>
              <label className={labelCls}>E-post</label>
              <input
                type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="kund@example.com"
                className={inputCls} style={ringStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input
                type="text" value={form.telefon}
                onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
                placeholder="070-000 00 00"
                className={inputCls} style={ringStyle}
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Adress</label>
              <input
                type="text" value={form.adress}
                onChange={e => setForm(f => ({ ...f, adress: e.target.value }))}
                placeholder="Gatuadress"
                className={inputCls} style={ringStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Postnummer</label>
              <input
                type="text" value={form.postnummer}
                onChange={e => setForm(f => ({ ...f, postnummer: e.target.value }))}
                placeholder="123 45"
                className={inputCls} style={ringStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Ort</label>
              <input
                type="text" value={form.ort}
                onChange={e => setForm(f => ({ ...f, ort: e.target.value }))}
                placeholder="Stockholm"
                className={inputCls} style={ringStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Org-nr / personnummer</label>
              <input
                type="text" value={form.org_nr}
                onChange={e => setForm(f => ({ ...f, org_nr: e.target.value }))}
                placeholder="556000-0000"
                className={inputCls} style={ringStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Land</label>
              <input
                type="text" value={form.land}
                onChange={e => setForm(f => ({ ...f, land: e.target.value }))}
                placeholder="Sverige"
                className={inputCls} style={ringStyle}
              />
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
