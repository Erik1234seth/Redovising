'use client';

import { useState, useEffect } from 'react';

interface AbStats {
  shown: number;
  hidden: number;
  clicks: number;
  conversionRate: string;
  orderedWithPopup: number;
  orderedWithoutPopup: number;
  orderConversionWithPopup: string;
  orderConversionWithoutPopup: string;
  bookedWithPopup: number;
  bookedWithoutPopup: number;
  recentEvents: { step: string; session_id: string; created_at: string }[];
}

export default function AbPage() {
  const [stats, setStats] = useState<AbStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/ab-stats')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setStats(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">A/B Popup</h1>
        <p className="text-warm-400 mt-1 text-sm">Konverteringstest för popup</p>
      </div>

      {loading || !stats ? (
        <div className="text-center py-20 text-warm-400">{loading ? 'Laddar...' : 'Ingen data'}</div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Såg popup', value: stats.shown, color: 'text-blue-400' },
              { label: 'Ingen popup', value: stats.hidden, color: 'text-warm-400' },
              { label: 'CTA-klick', value: stats.clicks, color: 'text-gold-500' },
              { label: 'Konvertering (popup)', value: `${stats.conversionRate}%`, color: 'text-green-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-navy-700/50 border border-navy-600 rounded-xl p-5">
                <div className={`text-3xl font-bold ${color}`}>{value}</div>
                <div className="text-sm text-warm-400 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Order correlation */}
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6">
            <h3 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-4">Beställningar per variant</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-navy-800/60 rounded-xl p-4 text-center">
                <p className="text-xs text-warm-400 mb-1">Med popup</p>
                <p className="text-3xl font-bold text-blue-400">{stats.orderedWithPopup}</p>
                <p className="text-xs text-warm-500 mt-1">{stats.orderConversionWithPopup}% konv.</p>
              </div>
              <div className="bg-navy-800/60 rounded-xl p-4 text-center">
                <p className="text-xs text-warm-400 mb-1">Utan popup</p>
                <p className="text-3xl font-bold text-warm-300">{stats.orderedWithoutPopup}</p>
                <p className="text-xs text-warm-500 mt-1">{stats.orderConversionWithoutPopup}% konv.</p>
              </div>
            </div>
          </div>

          {/* Booking correlation */}
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6">
            <h3 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-4">Bokade möten per variant</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-navy-800/60 rounded-xl p-4 text-center">
                <p className="text-xs text-warm-400 mb-1">Med popup</p>
                <p className="text-3xl font-bold text-blue-400">{stats.bookedWithPopup}</p>
              </div>
              <div className="bg-navy-800/60 rounded-xl p-4 text-center">
                <p className="text-xs text-warm-400 mb-1">Utan popup</p>
                <p className="text-3xl font-bold text-warm-300">{stats.bookedWithoutPopup}</p>
              </div>
            </div>
          </div>

          {/* Distribution bars */}
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6">
            <h3 className="text-xs font-semibold text-warm-400 uppercase tracking-widest mb-5">Fördelning</h3>
            <div className="space-y-4">
              {[
                { label: 'Popup visad', value: stats.shown, color: 'bg-blue-500' },
                { label: 'Ingen popup', value: stats.hidden, color: 'bg-navy-500' },
                { label: 'CTA-klick', value: stats.clicks, color: 'bg-gold-500' },
              ].map(({ label, value, color }) => {
                const total = stats.shown + stats.hidden || 1;
                const pct = Math.round((value / total) * 100);
                return (
                  <div key={label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm text-warm-200">{label}</span>
                      <span className="text-sm font-bold text-white">{value} <span className="text-warm-500 font-normal text-xs">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-navy-800 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent events */}
          <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-navy-600">
              <h3 className="text-xs font-semibold text-warm-400 uppercase tracking-widest">Senaste händelser</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-600">
                    <th className="text-left px-6 py-3 text-warm-400 font-medium">Händelse</th>
                    <th className="text-left px-6 py-3 text-warm-400 font-medium">Session</th>
                    <th className="text-left px-6 py-3 text-warm-400 font-medium">Tid</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentEvents.map((e, i) => (
                    <tr key={i} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                      <td className="px-6 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          e.step === 'ab_popup_popup' ? 'bg-blue-500/20 text-blue-400' :
                          e.step === 'ab_popup_cta_click' ? 'bg-gold-500/20 text-gold-400' :
                          'bg-navy-600 text-warm-400'
                        }`}>
                          {e.step === 'ab_popup_popup' ? 'Popup visad' : e.step === 'ab_popup_no-popup' ? 'Ingen popup' : 'CTA-klick'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-warm-400 font-mono text-xs">{e.session_id?.slice(0, 8)}...</td>
                      <td className="px-6 py-3 text-warm-400">{new Date(e.created_at).toLocaleString('sv-SE')}</td>
                    </tr>
                  ))}
                  {stats.recentEvents.length === 0 && (
                    <tr><td colSpan={3} className="px-6 py-8 text-center text-warm-500">Ingen data ännu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
