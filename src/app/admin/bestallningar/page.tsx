'use client';

import React, { useState, useEffect } from 'react';

const BANKS = ['seb', 'swedbank', 'handelsbanken', 'nordea', 'danske', 'lansforsakringar', 'sparbanken', 'annan'];
const STATUSES = ['pending', 'completed', 'in_progress'];
const PACKAGES = ['komplett'];

const PIPELINE_STAGES = [
  { step: 1, label: 'Mail' },
  { step: 2, label: 'Bestämt möte' },
  { step: 3, label: 'Skickat in filer' },
  { step: 4, label: 'Skickat NE-bilaga' },
  { step: 5, label: 'Lämnat in NE-bilaga' },
];

interface OrderFormData {
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_company: string;
  package_type: string;
  bank: string;
  status: string;
}

const EMPTY_FORM: OrderFormData = {
  guest_name: '',
  guest_email: '',
  guest_phone: '',
  guest_company: '',
  package_type: 'komplett',
  bank: 'seb',
  status: 'pending',
};

interface Order {
  id: string;
  package_type: string;
  bank: string;
  status: string;
  created_at: string;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_company: string | null;
  guest_org_nr: string | null;
  user_id: string | null;
  profiles: { email: string; full_name: string; phone: string } | null;
}

function OrderModal({ title, form, setForm, onSave, onClose, saving }: {
  title: string;
  form: OrderFormData;
  setForm: (f: OrderFormData) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-navy-800 border border-navy-600 rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold text-white mb-5">{title}</h2>
        <div className="space-y-4">
          {([
            { key: 'guest_name', label: 'Namn' },
            { key: 'guest_email', label: 'Email' },
            { key: 'guest_phone', label: 'Telefon' },
            { key: 'guest_company', label: 'Företag' },
          ] as { key: keyof OrderFormData; label: string }[]).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-warm-300 mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm"
              />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'package_type', label: 'Paket', options: PACKAGES },
              { key: 'bank', label: 'Bank', options: BANKS },
              { key: 'status', label: 'Status', options: STATUSES },
            ].map(({ key, label, options }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-warm-300 mb-1">{label}</label>
                <select
                  value={form[key as keyof OrderFormData]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm"
                >
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-navy-700 text-warm-300 hover:text-white rounded-xl transition text-sm font-medium">
            Avbryt
          </button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition text-sm disabled:opacity-50">
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BestallningarPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [contactRequests, setContactRequests] = useState<{ id: string; email: string; phone: string | null; package_type: string; created_at: string; stage: number; name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState<OrderFormData>(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<OrderFormData>(EMPTY_FORM);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [createContactForm, setCreateContactForm] = useState({ name: '', email: '', phone: '', package_type: 'komplett' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/orders')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); } else {
          setOrders(data.orders || []);
          setContactRequests(data.contactRequests || []);
        }
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta data'); setLoading(false); });
  }, []);

  const handleDelete = async (id: string, isContact = false) => {
    if (!confirm('Är du säker?')) return;
    setDeletingId(id);
    await fetch('/api/admin/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, table: isContact ? 'contact_requests' : 'orders' }),
    });
    if (isContact) setContactRequests(prev => prev.filter(c => c.id !== id));
    else setOrders(prev => prev.filter(o => o.id !== id));
    setDeletingId(null);
  };

  const handleEditSave = async () => {
    if (!editingOrder) return;
    setSaving(true);
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingOrder.id, ...editForm }),
    });
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, ...editForm } : o));
      setEditingOrder(null);
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    setSaving(true);
    const res = await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    if (data.order) { setOrders(prev => [data.order, ...prev]); setShowCreate(false); setCreateForm(EMPTY_FORM); }
    setSaving(false);
  };

  const handleUpdateStage = async (id: string, stage: number) => {
    setContactRequests(prev => prev.map(c => c.id === id ? { ...c, stage } : c));
    await fetch('/api/admin/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stage }),
    });
  };

  const handleCreateContact = async () => {
    setSaving(true);
    const res = await fetch('/api/admin/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createContactForm),
    });
    const data = await res.json();
    if (data.contact) { setContactRequests(prev => [data.contact, ...prev]); setShowCreateContact(false); setCreateContactForm({ name: '', email: '', phone: '', package_type: 'komplett' }); }
    setSaving(false);
  };

  const allRows = [
    ...contactRequests.map(c => ({ ...c, isContact: true as const, name: c.name || '—', status: 'kontakt', bank: '—', stage: c.stage ?? 1, _order: undefined as Order | undefined })),
    ...orders.map(o => ({ id: o.id, created_at: o.created_at, name: o.profiles?.full_name || o.guest_name || '—', email: o.profiles?.email || o.guest_email || '—', phone: o.profiles?.phone || o.guest_phone || '—', company: o.guest_company || '—', org_nr: o.guest_org_nr || '—', package_type: o.package_type, bank: o.bank || '—', status: o.status, stage: null as number | null, isContact: false as const, _order: o })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const packageColor = (pkg: string) => pkg === 'komplett' ? 'bg-gold-500/20 text-gold-400' : 'bg-blue-500/20 text-blue-400';
  const statusColor = (s: string) => s === 'completed' ? 'bg-green-500/20 text-green-400' : s === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-navy-600 text-warm-400';

  return (
    <>
      {/* Modals */}
      {editingOrder && (
        <OrderModal title="Redigera beställning" form={editForm} setForm={setEditForm} onSave={handleEditSave} onClose={() => setEditingOrder(null)} saving={saving} />
      )}
      {showCreate && (
        <OrderModal title="Ny beställning" form={createForm} setForm={setCreateForm} onSave={handleCreate} onClose={() => setShowCreate(false)} saving={saving} />
      )}
      {showCreateContact && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-navy-800 border border-navy-600 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-5">Ny kontaktförfrågan</h2>
            <div className="space-y-4">
              {[{ key: 'name', label: 'Namn' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'phone', label: 'Telefon' }].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-warm-300 mb-1">{label}</label>
                  <input type={type || 'text'} value={(createContactForm as any)[key]} onChange={e => setCreateContactForm({ ...createContactForm, [key]: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateContact(false)} className="flex-1 py-2.5 bg-navy-700 text-warm-300 hover:text-white rounded-xl transition text-sm font-medium">Avbryt</button>
              <button onClick={handleCreateContact} disabled={saving || !createContactForm.email} className="flex-1 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-bold rounded-xl transition text-sm disabled:opacity-50">
                {saving ? 'Sparar...' : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Beställningar</h1>
            <p className="text-warm-400 mt-1 text-sm">{allRows.length} totalt</p>
          </div>
          <button onClick={() => setShowCreateContact(true)} className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white font-semibold rounded-xl transition text-sm border border-navy-600">
            + Ny
          </button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">{error}</div>}

        {loading ? (
          <div className="text-center py-20 text-warm-400">Laddar...</div>
        ) : (
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
            {allRows.length === 0 ? (
              <div className="text-center py-16 text-warm-400">Inga beställningar ännu</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-600 text-warm-400 text-left">
                      <th className="px-4 py-3 font-medium">Datum</th>
                      <th className="px-4 py-3 font-medium">Kund</th>
                      <th className="px-4 py-3 font-medium">Telefon</th>
                      <th className="px-4 py-3 font-medium">Paket</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map(row => {
                      const stages = PIPELINE_STAGES.filter(s => s.step < 5 || row.package_type === 'komplett');
                      const currentStage = row.stage ?? 1;
                      return (
                        <React.Fragment key={row.id}>
                          <tr className="border-b border-navy-600/50 hover:bg-navy-700/20 transition-colors">
                            <td className="px-4 py-3 text-warm-400 whitespace-nowrap">
                              {new Date(row.created_at).toLocaleDateString('sv-SE')}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">{row.name !== '—' ? row.name : row.email}</div>
                              {row.name !== '—' && <div className="text-xs text-warm-500">{row.email}</div>}
                            </td>
                            <td className="px-4 py-3 text-warm-300">{row.phone}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-md text-xs font-semibold ${packageColor(row.package_type)}`}>
                                {row.package_type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-md text-xs font-semibold ${statusColor(row.status)}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                {!row.isContact && row._order && (
                                  <button onClick={() => { setEditingOrder(row._order!); setEditForm({ guest_name: row._order!.guest_name || row._order!.profiles?.full_name || '', guest_email: row._order!.guest_email || row._order!.profiles?.email || '', guest_phone: row._order!.guest_phone || row._order!.profiles?.phone || '', guest_company: row._order!.guest_company || '', package_type: row._order!.package_type, bank: row._order!.bank || 'seb', status: row._order!.status }); }}
                                    className="px-2 py-1 text-xs bg-navy-600 hover:bg-navy-500 text-warm-300 rounded-lg transition">
                                    Redigera
                                  </button>
                                )}
                                <button onClick={() => handleDelete(row.id, row.isContact)} disabled={deletingId === row.id}
                                  className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition disabled:opacity-50">
                                  {deletingId === row.id ? '...' : 'Ta bort'}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {row.isContact && (
                            <tr className="border-b border-navy-600/50 bg-navy-800/60">
                              <td colSpan={6} className="px-6 py-5">
                                <div className="flex items-start gap-0">
                                  {stages.map((s, i) => {
                                    const done = currentStage > s.step;
                                    const active = currentStage === s.step;
                                    return (
                                      <div key={s.step} className="flex items-center flex-1 min-w-0">
                                        <button onClick={() => handleUpdateStage(row.id, s.step)} className="flex flex-col items-center gap-1.5 group flex-shrink-0">
                                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${done ? 'bg-gold-500 border-gold-500 text-navy-900' : active ? 'bg-gold-500/20 border-gold-500 text-gold-400 ring-4 ring-gold-500/20' : 'bg-navy-700 border-navy-500 text-warm-500 group-hover:border-warm-400'}`}>
                                            {done ? '✓' : s.step}
                                          </div>
                                          <span className={`text-xs max-w-[64px] text-center leading-tight ${active ? 'text-gold-400' : done ? 'text-gold-500/70' : 'text-warm-500'}`}>{s.label}</span>
                                        </button>
                                        {i < stages.length - 1 && <div className={`flex-1 h-0.5 mx-1 mb-5 ${done ? 'bg-gold-500' : 'bg-navy-600'}`} />}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
