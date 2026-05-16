'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';
const TODAY = new Date().toISOString().split('T')[0];

type Typ = 'inventarie' | 'lager';

interface Item {
  id: string;
  typ: Typ;
  namn: string;
  beskrivning: string | null;
  anskaffningsdatum: string;
  anskaffningsvarde: number;
  avskrivning_ar: number | null;
  antal: number | null;
  enhetspris: number | null;
}

interface FormState {
  typ: Typ;
  namn: string;
  beskrivning: string;
  anskaffningsdatum: string;
  anskaffningsvarde: string;
  avskrivning_ar: string;
  antal: string;
  enhetspris: string;
}

const EMPTY_FORM: FormState = {
  typ: 'inventarie',
  namn: '',
  beskrivning: '',
  anskaffningsdatum: TODAY,
  anskaffningsvarde: '',
  avskrivning_ar: '5',
  antal: '',
  enhetspris: '',
};

// ── Beräkna bokfört värde ─────────────────────────────────────────────────────
function bokfortVarde(item: Item): number {
  if (item.typ === 'lager') {
    return (item.antal ?? 0) * (item.enhetspris ?? 0);
  }
  if (!item.avskrivning_ar || item.avskrivning_ar <= 0) return item.anskaffningsvarde;
  const start = new Date(item.anskaffningsdatum);
  const now = new Date();
  const arForflutet = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const arskostnad = item.anskaffningsvarde / item.avskrivning_ar;
  return Math.max(0, item.anskaffningsvarde - arskostnad * arForflutet);
}

// ── Confirm delete modal ───────────────────────────────────────────────────────
function ConfirmModal({ namn, onConfirm, onCancel }: { namn: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#FEF2F2' }}>
          <svg className="w-7 h-7" fill="none" stroke={CORAL} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h2 className="text-lg font-extrabold text-slate-800 mb-1">Ta bort?</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Är du säker på att du vill ta bort <span className="font-semibold text-slate-600">"{namn}"</span>?
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Avbryt</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl" style={{ backgroundColor: CORAL }}>Ta bort</button>
        </div>
      </div>
    </div>
  );
}

// ── Add modal ─────────────────────────────────────────────────────────────────
function AddModal({ onSave, onClose }: { onSave: (form: FormState) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const isValid = form.namn.trim().length > 0 && form.anskaffningsdatum.length === 10 &&
    Number(form.anskaffningsvarde) > 0 &&
    (form.typ === 'inventarie' || (Number(form.antal) > 0 && Number(form.enhetspris) >= 0));

  async function submit() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-0 sm:pb-0">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-slate-800">Lägg till</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Typ */}
        <div className="flex gap-2 mb-5 p-1 bg-slate-100 rounded-xl">
          {(['inventarie', 'lager'] as Typ[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('typ', t)}
              className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-150"
              style={form.typ === t ? { backgroundColor: NAV_BG, color: 'white' } : { color: '#64748b' }}
            >
              {t === 'inventarie' ? 'Inventarie / Maskin' : 'Lager / Produkt'}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Namn" required>
            <input
              autoFocus
              type="text"
              value={form.namn}
              onChange={e => set('namn', e.target.value)}
              placeholder={form.typ === 'inventarie' ? 'T.ex. bärbar dator, bil, symaskin' : 'T.ex. hårgele, träklossar, tyg'}
              className={inputCls}
            />
          </Field>

          <Field label="Beskrivning (valfritt)">
            <input type="text" value={form.beskrivning} onChange={e => set('beskrivning', e.target.value)} placeholder="Kort beskrivning" className={inputCls} />
          </Field>

          <Field label="Inköpsdatum" required>
            <input type="date" value={form.anskaffningsdatum} onChange={e => set('anskaffningsdatum', e.target.value)} className={inputCls} />
          </Field>

          <Field label="Inköpspris (kr inkl. moms)" required>
            <input type="number" min="0" value={form.anskaffningsvarde} onChange={e => set('anskaffningsvarde', e.target.value)} placeholder="0" className={inputCls} />
          </Field>

          {form.typ === 'inventarie' && (
            <Field label="Hur många år ska den hålla?" required>
              <select value={form.avskrivning_ar} onChange={e => set('avskrivning_ar', e.target.value)} className={inputCls}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20].map(y => (
                  <option key={y} value={y}>{y} år</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1.5">T.ex. en dator håller ca 3 år, en bil 5 år, en maskin 10 år</p>
            </Field>
          )}

          {form.typ === 'lager' && (
            <>
              <Field label="Antal" required>
                <input type="number" min="0" value={form.antal} onChange={e => set('antal', e.target.value)} placeholder="0" className={inputCls} />
              </Field>
              <Field label="Inköpspris per styck (kr)" required>
                <input type="number" min="0" step="0.01" value={form.enhetspris} onChange={e => set('enhetspris', e.target.value)} placeholder="0" className={inputCls} />
              </Field>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!isValid || saving}
          className="w-full mt-6 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: NAV_BG }}
        >
          {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>}
          {saving ? 'Sparar...' : 'Spara'}
        </button>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LagerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<Typ>('inventarie');
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetchItems();
  }, [user]);

  async function fetchItems() {
    const supabase = createClient();
    const { data } = await supabase
      .from('lagertillgangar')
      .select('*')
      .eq('user_id', user!.id)
      .order('anskaffningsdatum', { ascending: false });
    setItems(data ?? []);
    setLoadingData(false);
  }

  async function handleSave(form: FormState) {
    const supabase = createClient();
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    await supabase.from('lagertillgangar').insert({
      user_id: u.id,
      typ: form.typ,
      namn: form.namn.trim(),
      beskrivning: form.beskrivning.trim() || null,
      anskaffningsdatum: form.anskaffningsdatum,
      anskaffningsvarde: Number(form.anskaffningsvarde),
      avskrivning_ar: form.typ === 'inventarie' ? Number(form.avskrivning_ar) : null,
      antal: form.typ === 'lager' ? Number(form.antal) : null,
      enhetspris: form.typ === 'lager' ? Number(form.enhetspris) : null,
    });
    setShowAdd(false);
    await fetchItems();
  }

  async function handleDelete(item: Item) {
    const supabase = createClient();
    await supabase.from('lagertillgangar').delete().eq('id', item.id);
    setDeleteTarget(null);
    await fetchItems();
  }

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filtered = items.filter(i => i.typ === activeTab);
  const totalInventarier = items.filter(i => i.typ === 'inventarie').reduce((s, i) => s + bokfortVarde(i), 0);
  const totalLager = items.filter(i => i.typ === 'lager').reduce((s, i) => s + bokfortVarde(i), 0);

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      {showAdd && <AddModal onSave={handleSave} onClose={() => setShowAdd(false)} />}
      {deleteTarget && <ConfirmModal namn={deleteTarget.namn} onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />}

      {/* Topp */}
      <div className="px-8 pt-12 pb-2">
        <p className="text-sm font-medium text-slate-400 mb-1">Lager & Tillgångar</p>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Vad äger företaget?</h1>
        <p className="text-slate-400 text-sm mt-2">Håll koll på dina inventarier, maskiner och lagervärde.</p>
      </div>

      {/* Summakort */}
      <div className="px-8 py-6 grid grid-cols-2 gap-4 max-w-4xl">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
              <svg className="w-5 h-5" fill="none" stroke="#2563EB" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-600">Inventarier & Maskiner</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">{totalInventarier.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr</p>
          <p className="text-xs text-slate-400 mt-1">Bokfört restvärde</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#ECFDF5' }}>
              <svg className="w-5 h-5" fill="none" stroke="#059669" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-600">Lager</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">{totalLager.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr</p>
          <p className="text-xs text-slate-400 mt-1">Totalt lagervärde</p>
        </div>
      </div>

      {/* Tabs + lägg till */}
      <div className="px-8 max-w-4xl w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
            {(['inventarie', 'lager'] as Typ[]).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150"
                style={activeTab === t ? { backgroundColor: NAV_BG, color: 'white' } : { color: '#64748b' }}
              >
                {t === 'inventarie' ? 'Inventarier & Maskiner' : 'Lager'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
            style={{ backgroundColor: CORAL }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Lägg till
          </button>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-10">
          {loadingData ? (
            <div className="flex items-center justify-center py-14">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-8 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F1F5F9' }}>
                {activeTab === 'inventarie' ? (
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )}
              </div>
              <p className="font-semibold text-slate-600 mb-1">
                {activeTab === 'inventarie' ? 'Inga inventarier registrerade' : 'Inget lager registrerat'}
              </p>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                {activeTab === 'inventarie'
                  ? 'Lägg till datorer, maskiner, bilar eller annan utrustning du köpt till företaget.'
                  : 'Lägg till de produkter du har i lager och deras inköpsvärde.'}
              </p>
            </div>
          ) : (
            <>
              {/* Tabellrubrik */}
              {activeTab === 'inventarie' ? (
                <div className="grid px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100" style={{ gridTemplateColumns: '1fr 110px 120px 120px 40px' }}>
                  <span>Namn</span>
                  <span>Inköpt</span>
                  <span className="text-right">Inköpspris</span>
                  <span className="text-right">Restvärde</span>
                  <span />
                </div>
              ) : (
                <div className="grid px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100" style={{ gridTemplateColumns: '1fr 80px 110px 120px 40px' }}>
                  <span>Namn</span>
                  <span className="text-right">Antal</span>
                  <span className="text-right">Pris/st</span>
                  <span className="text-right">Lagervärde</span>
                  <span />
                </div>
              )}

              {/* Rader */}
              {filtered.map(item => {
                const bv = bokfortVarde(item);
                const avskriven = item.typ === 'inventarie' && bv === 0;
                return (
                  <div
                    key={item.id}
                    className="grid px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors items-center"
                    style={{ gridTemplateColumns: item.typ === 'inventarie' ? '1fr 110px 120px 120px 40px' : '1fr 80px 110px 120px 40px' }}
                  >
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.namn}</p>
                        {avskriven && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ backgroundColor: '#F1F5F9', color: '#94a3b8' }}>
                            Fullt avskriven
                          </span>
                        )}
                      </div>
                      {item.beskrivning && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.beskrivning}</p>}
                      {item.typ === 'inventarie' && item.avskrivning_ar && (
                        <p className="text-xs text-slate-400 mt-0.5">{item.avskrivning_ar} års avskrivning</p>
                      )}
                    </div>

                    {item.typ === 'inventarie' ? (
                      <>
                        <span className="text-sm text-slate-400">{new Date(item.anskaffningsdatum).toLocaleDateString('sv-SE')}</span>
                        <span className="text-sm text-slate-600 text-right">{item.anskaffningsvarde.toLocaleString('sv-SE')} kr</span>
                        <span className={`text-sm font-semibold text-right ${avskriven ? 'text-slate-400' : 'text-slate-800'}`}>
                          {bv.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-slate-700 text-right">{item.antal}</span>
                        <span className="text-sm text-slate-600 text-right">{(item.enhetspris ?? 0).toLocaleString('sv-SE')} kr</span>
                        <span className="text-sm font-semibold text-slate-800 text-right">{bv.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr</span>
                      </>
                    )}

                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all ml-auto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
