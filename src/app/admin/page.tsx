'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const BANKS = ['seb', 'swedbank', 'handelsbanken', 'nordea', 'danske', 'lansforsakringar', 'sparbanken', 'annan'];
const STATUSES = ['pending', 'completed', 'in_progress'];
const PACKAGES = ['komplett', 'ne-bilaga'];

const PIPELINE_STAGES = [
  { step: 1, label: 'Mail', color: 'border-blue-500/40 bg-blue-500/5' },
  { step: 2, label: 'Bestämt möte', color: 'border-purple-500/40 bg-purple-500/5' },
  { step: 3, label: 'Skickat in filer', color: 'border-yellow-500/40 bg-yellow-500/5' },
  { step: 4, label: 'Skickat NE-bilaga', color: 'border-orange-500/40 bg-orange-500/5' },
  { step: 5, label: 'Lämnat in NE-bilaga', color: 'border-green-500/40 bg-green-500/5' },
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

function OrderModal({
  title,
  form,
  setForm,
  onSave,
  onClose,
  saving,
}: {
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
          {(
            [
              { key: 'guest_name', label: 'Namn' },
              { key: 'guest_email', label: 'Email' },
              { key: 'guest_phone', label: 'Telefon' },
              { key: 'guest_company', label: 'Företag' },
            ] as { key: keyof OrderFormData; label: string }[]
          ).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-warm-300 mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition text-sm"
              />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-warm-300 mb-1">Paket</label>
              <select
                value={form.package_type}
                onChange={(e) => setForm({ ...form, package_type: e.target.value })}
                className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm"
              >
                {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-300 mb-1">Bank</label>
              <select
                value={form.bank}
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
                className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm"
              >
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-300 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-navy-700 text-warm-300 hover:text-white rounded-xl transition text-sm font-medium"
          >
            Avbryt
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition text-sm disabled:opacity-50"
          >
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ADMIN_CODE = 'Erik0511';

function CodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ADMIN_CODE) {
      sessionStorage.setItem('admin_unlocked', '1');
      onUnlock();
    } else {
      setError(true);
      setCode('');
    }
  };

  return (
    <div className="min-h-screen bg-navy-800 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-navy-700/50 border border-navy-600 rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Admin</h1>
        <label className="block text-sm font-medium text-warm-300 mb-2">Kod</label>
        <input
          type="password"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(false); }}
          autoFocus
          className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition mb-4"
        />
        {error && <p className="text-red-400 text-sm mb-3">Fel kod, försök igen</p>}
        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200"
        >
          Logga in
        </button>
      </form>
    </div>
  );
}

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
  user_id: string | null;
  profiles: {
    email: string;
    full_name: string;
    phone: string;
  } | null;
}

const FLOW_STEPS = [
  { key: 'qualification', label: 'Kvalificering' },
  { key: 'bank-selection', label: 'Bankval' },
  { key: 'download-guide', label: 'Ladda ner guide' },
  { key: 'upload-statement', label: 'Ladda upp kontoutdrag' },
  { key: 'review-transactions', label: 'Granska transaktioner' },
  { key: 'add-transactions', label: 'Lägg till transaktioner' },
  { key: 'upload-previous', label: 'Tidigare NE-bilaga' },
  { key: 'delegation-guide', label: 'Delegeringsguide' },
  { key: 'contact-info', label: 'Kontaktinfo' },
  { key: 'review-and-accept', label: 'Granska & godkänn' },
  { key: 'confirmation', label: 'Bekräftelse' },
];

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [contactRequests, setContactRequests] = useState<{ id: string; email: string; phone: string | null; package_type: string; created_at: string; stage: number; name: string | null }[]>([]);
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'funnel'>('orders');

  // Edit/create/delete state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState<OrderFormData>(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<OrderFormData>(EMPTY_FORM);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [createContactForm, setCreateContactForm] = useState({ name: '', email: '', phone: '', package_type: 'ne-bilaga' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Expanded rows + files
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contactFiles, setContactFiles] = useState<Record<string, { id: string; stage: number; file_name: string; file_url: string; file_path: string; file_size: number | null }[]>>({});
  const [uploadingStep, setUploadingStep] = useState<number | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem('admin_unlocked') === '1') {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/orders');
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setOrders(data.orders || []);
          setStepCounts(data.stepCounts || {});
          setContactRequests(data.contactRequests || []);
        }
      } catch (err) {
        setError('Kunde inte hämta data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [unlocked]);

  const handleDelete = async (id: string, isContact = false) => {
    if (!confirm('Är du säker på att du vill ta bort denna rad?')) return;
    setDeletingId(id);
    await fetch('/api/admin/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, table: isContact ? 'contact_requests' : 'orders' }),
    });
    if (isContact) {
      setContactRequests((prev) => prev.filter((c) => c.id !== id));
    } else {
      setOrders((prev) => prev.filter((o) => o.id !== id));
    }
    setDeletingId(null);
  };

  const handleEditOpen = (order: Order) => {
    setEditingOrder(order);
    setEditForm({
      guest_name: order.guest_name || order.profiles?.full_name || '',
      guest_email: order.guest_email || order.profiles?.email || '',
      guest_phone: order.guest_phone || order.profiles?.phone || '',
      guest_company: order.guest_company || '',
      package_type: order.package_type,
      bank: order.bank || 'seb',
      status: order.status,
    });
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
      setOrders((prev) =>
        prev.map((o) =>
          o.id === editingOrder.id
            ? { ...o, ...editForm }
            : o
        )
      );
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
    if (data.order) {
      setOrders((prev) => [data.order, ...prev]);
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
    }
    setSaving(false);
  };

  const handleToggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!contactFiles[id]) {
      const res = await fetch(`/api/admin/contact-files?contact_id=${id}`);
      const data = await res.json();
      setContactFiles((prev) => ({ ...prev, [id]: data.files || [] }));
    }
  };

  const handleFileUpload = async (contactId: string, stage: number, file: File) => {
    setUploadingStep(stage);
    const form = new FormData();
    form.append('file', file);
    form.append('contact_id', contactId);
    form.append('stage', String(stage));
    const res = await fetch('/api/admin/contact-files', { method: 'POST', body: form });
    const data = await res.json();
    if (data.file) {
      setContactFiles((prev) => ({ ...prev, [contactId]: [...(prev[contactId] || []), data.file] }));
    }
    setUploadingStep(null);
  };

  const handleFileDelete = async (contactId: string, fileId: string, filePath: string) => {
    await fetch('/api/admin/contact-files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fileId, file_path: filePath }),
    });
    setContactFiles((prev) => ({ ...prev, [contactId]: prev[contactId].filter((f) => f.id !== fileId) }));
  };

  const handleUpdateStage = async (id: string, stage: number) => {
    setContactRequests((prev) => prev.map((c) => c.id === id ? { ...c, stage } : c));
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
    if (data.contact) {
      setContactRequests((prev) => [data.contact, ...prev]);
      setShowCreateContact(false);
      setCreateContactForm({ name: '', email: '', phone: '', package_type: 'ne-bilaga' });
    }
    setSaving(false);
  };

  if (!unlocked) {
    return <CodeGate onUnlock={() => setUnlocked(true)} />;
  }

  const maxCount = Math.max(...Object.values(stepCounts), 1);

  const getEmail = (order: Order) =>
    order.profiles?.email || order.guest_email || '—';
  const getName = (order: Order) =>
    order.profiles?.full_name || order.guest_name || '—';
  const getPhone = (order: Order) =>
    order.profiles?.phone || order.guest_phone || '—';
  const getCompany = (order: Order) => order.guest_company || '—';

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-navy-600 text-warm-400 border-navy-500';
    }
  };

  const packageColor = (pkg: string) => {
    return pkg === 'komplett'
      ? 'bg-gold-500/20 text-gold-400'
      : 'bg-blue-500/20 text-blue-400';
  };

  return (
    <div className="min-h-screen bg-navy-800 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Modals */}
        {editingOrder && (
          <OrderModal
            title="Redigera beställning"
            form={editForm}
            setForm={setEditForm}
            onSave={handleEditSave}
            onClose={() => setEditingOrder(null)}
            saving={saving}
          />
        )}
        {showCreate && (
          <OrderModal
            title="Ny beställning"
            form={createForm}
            setForm={setCreateForm}
            onSave={handleCreate}
            onClose={() => setShowCreate(false)}
            saving={saving}
          />
        )}
        {showCreateContact && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-navy-800 border border-navy-600 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-5">Ny kontaktförfrågan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-warm-300 mb-1">Namn</label>
                  <input
                    type="text"
                    value={createContactForm.name}
                    onChange={(e) => setCreateContactForm({ ...createContactForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-warm-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={createContactForm.email}
                    onChange={(e) => setCreateContactForm({ ...createContactForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-warm-300 mb-1">Telefon</label>
                  <input
                    type="text"
                    value={createContactForm.phone}
                    onChange={(e) => setCreateContactForm({ ...createContactForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-warm-300 mb-1">Paket</label>
                  <select
                    value={createContactForm.package_type}
                    onChange={(e) => setCreateContactForm({ ...createContactForm, package_type: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm"
                  >
                    {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateContact(false)}
                  className="flex-1 py-2.5 bg-navy-700 text-warm-300 hover:text-white rounded-xl transition text-sm font-medium"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleCreateContact}
                  disabled={saving || !createContactForm.email}
                  className="flex-1 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition text-sm disabled:opacity-50"
                >
                  {saving ? 'Sparar...' : 'Spara'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-warm-400 mt-1">Beställningar och funnel-statistik</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateContact(true)}
              className="px-5 py-2.5 bg-navy-700 hover:bg-navy-600 text-white font-bold rounded-xl transition-all duration-200 text-sm border border-navy-600"
            >
              + Ny beställning
            </button>
            <Link
              href="/admin/upload-pdf"
              className="px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200 text-sm"
            >
              Ladda upp PDF →
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-5">
            <div className="text-3xl font-bold text-gold-500">{orders.length + contactRequests.length}</div>
            <div className="text-sm text-warm-400 mt-1">Totala beställningar</div>
          </div>
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-5">
            <div className="text-3xl font-bold text-green-400">
              {orders.filter(o => o.status === 'completed').length}
            </div>
            <div className="text-sm text-warm-400 mt-1">Avslutade</div>
          </div>
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-5">
            <div className="text-3xl font-bold text-yellow-400">
              {orders.filter(o => o.status === 'pending').length + contactRequests.length}
            </div>
            <div className="text-sm text-warm-400 mt-1">Väntande</div>
          </div>
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-5">
            <div className="text-3xl font-bold text-blue-400">
              {stepCounts['qualification'] || 0}
            </div>
            <div className="text-sm text-warm-400 mt-1">Besökare i flödet</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'orders'
                ? 'bg-gold-500 text-navy-900'
                : 'bg-navy-700 text-warm-300 hover:text-white'
            }`}
          >
            Beställningar
          </button>
          <button
            onClick={() => setActiveTab('funnel')}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'funnel'
                ? 'bg-gold-500 text-navy-900'
                : 'bg-navy-700 text-warm-300 hover:text-white'
            }`}
          >
            Funnel
          </button>
        </div>

        {loading && (
          <div className="text-center py-20 text-warm-400">Laddar...</div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 mb-6">
            {error}
          </div>
        )}

        {/* Orders tab */}
        {!loading && activeTab === 'orders' && (() => {
          const contactRows = contactRequests.map((c) => ({
            id: c.id,
            created_at: c.created_at,
            name: c.name || '—',
            email: c.email,
            phone: c.phone || '—',
            company: '—',
            package_type: c.package_type,
            bank: '—',
            status: 'kontakt',
            stage: c.stage ?? 1,
            isContact: true as const,
            _order: undefined as Order | undefined,
          }));
          const orderRows = orders.map((o) => ({
            id: o.id,
            created_at: o.created_at,
            name: o.profiles?.full_name || o.guest_name || '—',
            email: o.profiles?.email || o.guest_email || '—',
            phone: o.profiles?.phone || o.guest_phone || '—',
            company: o.guest_company || '—',
            package_type: o.package_type,
            bank: o.bank || '—',
            status: o.status,
            stage: null as number | null,
            isContact: false as const,
            _order: o,
          }));
          const allRows = [...contactRows, ...orderRows].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          return (
            <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
              {allRows.length === 0 ? (
                <div className="text-center py-16 text-warm-400">Inga beställningar ännu</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-600 text-warm-400 text-left">
                        <th className="px-4 py-3 font-medium">Datum</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Telefon</th>
                        <th className="px-4 py-3 font-medium">Paket</th>
                        <th className="px-4 py-3 font-medium">Steg</th>
                        <th className="px-4 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.map((row) => {
                        const isExpanded = expandedId === row.id;
                        const isKomplett = row.package_type === 'komplett';
                        const stages = PIPELINE_STAGES.filter((s) => s.step < 5 || isKomplett);
                        const currentStage = row.stage ?? 1;
                        const files = contactFiles[row.id] || [];

                        return (
                          <React.Fragment key={row.id}>
                            <tr
                              className={`border-b border-navy-600/50 transition-colors ${isExpanded ? 'bg-navy-700/40' : 'hover:bg-navy-700/20'}`}
                            >
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
                                {row.isContact ? (
                                  <span className="text-xs text-warm-300">
                                    {currentStage}. {PIPELINE_STAGES.find(s => s.step === currentStage)?.label}
                                  </span>
                                ) : (
                                  <span className="text-warm-500 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2 items-center">
                                  {row.isContact && (
                                    <button
                                      onClick={() => handleToggleExpand(row.id)}
                                      className={`px-2 py-1 text-xs rounded-lg transition border ${
                                        isExpanded
                                          ? 'bg-gold-500/20 border-gold-500/40 text-gold-400'
                                          : 'bg-navy-600 border-navy-500 text-warm-200 hover:text-white'
                                      }`}
                                    >
                                      {isExpanded ? '▲ Stäng' : '▼ Detaljer'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDelete(row.id, row.isContact)}
                                    disabled={deletingId === row.id}
                                    className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition disabled:opacity-50"
                                  >
                                    {deletingId === row.id ? '...' : 'Ta bort'}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded pipeline + files */}
                            {isExpanded && row.isContact && (
                              <tr className="border-b border-navy-600/50 bg-navy-800/60">
                                <td colSpan={6} className="px-6 py-6">
                                  {/* Progress bar */}
                                  <div className="flex items-start gap-0 mb-6">
                                    {stages.map((s, i) => {
                                      const done = currentStage > s.step;
                                      const active = currentStage === s.step;
                                      const isLast = i === stages.length - 1;
                                      return (
                                        <div key={s.step} className="flex items-center flex-1 min-w-0">
                                          <button
                                            onClick={() => handleUpdateStage(row.id, s.step)}
                                            className="flex flex-col items-center gap-1.5 group flex-shrink-0"
                                          >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2 ${
                                              done
                                                ? 'bg-gold-500 border-gold-500 text-navy-900'
                                                : active
                                                ? 'bg-gold-500/20 border-gold-500 text-gold-400 ring-4 ring-gold-500/20'
                                                : 'bg-navy-700 border-navy-500 text-warm-500 group-hover:border-warm-400 group-hover:text-warm-300'
                                            }`}>
                                              {done ? '✓' : s.step}
                                            </div>
                                            <span className={`text-xs font-medium max-w-[72px] text-center leading-tight ${
                                              active ? 'text-gold-400' : done ? 'text-gold-500/70' : 'text-warm-500'
                                            }`}>
                                              {s.label}
                                            </span>
                                          </button>
                                          {!isLast && (
                                            <div className={`flex-1 h-0.5 mx-1 mb-5 ${done ? 'bg-gold-500' : 'bg-navy-600'}`} />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Files per step */}
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                    {stages.map((s) => {
                                      const stepFiles = files.filter((f) => f.stage === s.step);
                                      return (
                                        <div key={s.step} className="bg-navy-700/50 border border-navy-600 rounded-xl p-3">
                                          <div className="text-xs font-bold text-warm-400 mb-2 uppercase tracking-wide">
                                            Steg {s.step} — {s.label}
                                          </div>
                                          <div className="space-y-1.5 mb-2 min-h-[24px]">
                                            {stepFiles.length === 0 ? (
                                              <div className="text-xs text-warm-600">Inga filer</div>
                                            ) : (
                                              stepFiles.map((f) => (
                                                <div key={f.id} className="flex items-center gap-1 group">
                                                  <a
                                                    href={f.file_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-blue-400 hover:text-blue-300 truncate flex-1"
                                                    title={f.file_name}
                                                  >
                                                    📎 {f.file_name}
                                                  </a>
                                                  <button
                                                    onClick={() => handleFileDelete(row.id, f.id, f.file_path)}
                                                    className="text-red-500/50 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                                                    title="Ta bort fil"
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              ))
                                            )}
                                          </div>
                                          <label className={`flex items-center justify-center gap-1 w-full py-1.5 text-xs rounded-lg border border-dashed cursor-pointer transition ${
                                            uploadingStep === s.step
                                              ? 'border-navy-500 text-warm-600'
                                              : 'border-navy-500 text-warm-500 hover:border-gold-500/50 hover:text-gold-400'
                                          }`}>
                                            {uploadingStep === s.step ? 'Laddar upp...' : '+ Lägg till fil'}
                                            <input
                                              type="file"
                                              className="hidden"
                                              disabled={uploadingStep !== null}
                                              onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) handleFileUpload(row.id, s.step, f);
                                                e.target.value = '';
                                              }}
                                            />
                                          </label>
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
          );
        })()}

        {/* Funnel tab */}
        {!loading && activeTab === 'funnel' && (
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-6">Antal unika besökare per steg</h2>
            {Object.keys(stepCounts).length === 0 ? (
              <div className="text-center py-12 text-warm-400">Ingen data ännu — börjar samlas in när användare besöker flödet</div>
            ) : (
              <div className="space-y-4">
                {FLOW_STEPS.map((step, index) => {
                  const count = stepCounts[step.key] || 0;
                  const pct = Math.round((count / maxCount) * 100);
                  const dropPct = index === 0
                    ? null
                    : stepCounts[FLOW_STEPS[index - 1].key]
                      ? Math.round((1 - count / (stepCounts[FLOW_STEPS[index - 1].key] || 1)) * 100)
                      : null;

                  return (
                    <div key={step.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-warm-500 w-5 text-right">{index + 1}</span>
                          <span className="text-sm text-warm-200 font-medium">{step.label}</span>
                          {dropPct !== null && dropPct > 0 && (
                            <span className="text-xs text-red-400">−{dropPct}%</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-white">{count}</span>
                      </div>
                      <div className="h-2 bg-navy-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-gold-500 to-gold-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
