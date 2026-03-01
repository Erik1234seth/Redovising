'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'funnel'>('orders');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/orders');
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setOrders(data.orders || []);
          setStepCounts(data.stepCounts || {});
        }
      } catch (err) {
        setError('Kunde inte hämta data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-warm-400 mt-1">Beställningar och funnel-statistik</p>
          </div>
          <Link
            href="/admin/upload-pdf"
            className="px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200 text-sm"
          >
            Ladda upp PDF →
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-5">
            <div className="text-3xl font-bold text-gold-500">{orders.length}</div>
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
              {orders.filter(o => o.status === 'pending').length}
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
        {!loading && activeTab === 'orders' && (
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
            {orders.length === 0 ? (
              <div className="text-center py-16 text-warm-400">Inga beställningar ännu</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-600 text-warm-400 text-left">
                      <th className="px-4 py-3 font-medium">Datum</th>
                      <th className="px-4 py-3 font-medium">Namn</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Telefon</th>
                      <th className="px-4 py-3 font-medium">Företag</th>
                      <th className="px-4 py-3 font-medium">Paket</th>
                      <th className="px-4 py-3 font-medium">Bank</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-navy-600/50 hover:bg-navy-700/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-warm-400 whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString('sv-SE')}
                        </td>
                        <td className="px-4 py-3 text-white font-medium">{getName(order)}</td>
                        <td className="px-4 py-3 text-warm-300">{getEmail(order)}</td>
                        <td className="px-4 py-3 text-warm-300">{getPhone(order)}</td>
                        <td className="px-4 py-3 text-warm-300">{getCompany(order)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${packageColor(order.package_type)}`}>
                            {order.package_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-warm-300 capitalize">{order.bank || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${statusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

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
