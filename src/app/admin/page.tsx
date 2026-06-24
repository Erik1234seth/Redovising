'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminOverviewPage() {
  const [ordersData, setOrdersData] = useState<{ orders: any[]; contactRequests: any[]; stepCounts: Record<string, number> } | null>(null);
  const [inmailData, setInmailData] = useState<{ threads: any[]; prospects: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/orders').then(r => r.json()),
      fetch('/api/admin/inmail').then(r => r.json()),
    ]).then(([o, i]) => {
      if (!o.error) setOrdersData(o);
      if (!i.error) setInmailData(i);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-20 text-warm-400">Laddar...</div>;

  const now = new Date();
  const pendingOrders = ordersData?.orders.filter(o => o.status === 'pending') ?? [];
  const activeProspects = inmailData?.prospects.filter(p => !p.used_at && new Date(p.expires_at) > now) ?? [];
  const pendingDelete = inmailData?.threads.filter(t => t.state?.startsWith('pending_delete:')) ?? [];

  const alerts = [
    pendingOrders.length > 0 && {
      type: 'warning',
      label: `${pendingOrders.length} beställning${pendingOrders.length > 1 ? 'ar' : ''} väntar på åtgärd`,
      href: '/admin/bestallningar',
    },
    activeProspects.length > 0 && {
      type: 'info',
      label: `${activeProspects.length} prospekt${activeProspects.length > 1 ? 's' : ''} med aktiv registreringslänk`,
      href: '/admin/inmail',
    },
    pendingDelete.length > 0 && {
      type: 'warning',
      label: `${pendingDelete.length} e-posttråd${pendingDelete.length > 1 ? 'ar' : ''} väntar på bekräftelse (radering)`,
      href: '/admin/inmail',
    },
  ].filter(Boolean) as { type: string; label: string; href: string }[];

  const totalOrders = (ordersData?.orders.length ?? 0) + (ordersData?.contactRequests.length ?? 0);
  const completedOrders = ordersData?.orders.filter(o => o.status === 'completed').length ?? 0;
  const funnelEntry = ordersData?.stepCounts['qualification'] ?? 0;

  const recentOrders = [
    ...(ordersData?.orders ?? []),
    ...(ordersData?.contactRequests ?? []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  const recentThreads = inmailData?.threads.slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Översikt</h1>
        <p className="text-warm-400 mt-1 text-sm">
          {now.toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Alerts */}
      <div className="space-y-2">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-green-500/10 border-green-500/30 text-green-300">
            <span>✓</span>
            <span className="text-sm font-medium">Allt ser bra ut — inget kräver åtgärd just nu</span>
          </div>
        ) : alerts.map((alert, i) => (
          <Link key={i} href={alert.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:opacity-80 ${
            alert.type === 'warning'
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          }`}>
            <span>{alert.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span className="text-sm font-medium">{alert.label}</span>
            <span className="ml-auto text-xs opacity-60">Gå dit →</span>
          </Link>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Totala beställningar', value: totalOrders, color: 'text-gold-500' },
          { label: 'Avslutade', value: completedOrders, color: 'text-green-400' },
          { label: 'Aktiva prospekts', value: activeProspects.length, color: 'text-blue-400' },
          { label: 'Funnel-besökare', value: funnelEntry, color: 'text-purple-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-navy-700/50 border border-navy-600 rounded-xl p-5">
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-sm text-warm-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-warm-400 uppercase tracking-widest">Senaste beställningar</h2>
            <Link href="/admin/bestallningar" className="text-xs text-gold-500 hover:text-gold-400 transition">Visa alla →</Link>
          </div>
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-warm-500 text-sm">Inga beställningar ännu</div>
            ) : recentOrders.map((row: any) => (
              <div key={row.id} className="flex items-center justify-between px-4 py-3 border-b border-navy-600/50 last:border-0">
                <div>
                  <div className="text-white text-sm font-medium">
                    {row.profiles?.full_name || row.guest_name || row.name || row.profiles?.email || row.guest_email || row.email || '—'}
                  </div>
                  <div className="text-xs text-warm-500">{new Date(row.created_at).toLocaleDateString('sv-SE')}</div>
                </div>
                <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                  row.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  row.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-navy-600 text-warm-400'
                }`}>{row.status || 'kontakt'}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-warm-400 uppercase tracking-widest">Senaste e-post</h2>
            <Link href="/admin/inmail" className="text-xs text-gold-500 hover:text-gold-400 transition">Visa alla →</Link>
          </div>
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
            {recentThreads.length === 0 ? (
              <div className="text-center py-8 text-warm-500 text-sm">Inga e-posttrådar ännu</div>
            ) : recentThreads.map((t: any) => {
              const isProspect = t.state?.startsWith('prospect:');
              const isPendingDelete = t.state?.startsWith('pending_delete:');
              const email = t.profiles?.email || (isProspect ? t.state?.replace('prospect:', '') : '—');
              return (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 border-b border-navy-600/50 last:border-0">
                  <div>
                    <div className="text-white text-sm font-medium">{email}</div>
                    <div className="text-xs text-warm-500">{new Date(t.updated_at).toLocaleDateString('sv-SE')}</div>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                    isPendingDelete ? 'bg-red-500/20 text-red-400' :
                    isProspect ? 'bg-purple-500/20 text-purple-400' :
                    'bg-navy-600 text-warm-400'
                  }`}>
                    {isPendingDelete ? 'Väntar' : isProspect ? 'Prospekt' : 'Aktiv'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
