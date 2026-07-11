'use client';

import { useState, useEffect } from 'react';

// Labels for the QR codes you hand out. Add rows here when you print new letters.
const QR_CODES = [
  { code: 'brev-a', label: 'Brev A', url: 'enklabokslut.se/?ref=brev-a' },
  { code: 'brev-b', label: 'Brev B', url: 'enklabokslut.se/?ref=brev-b' },
];

export default function QrPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/qr-stats')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setCounts(data.counts || {});
        setLoading(false);
      });
  }, []);

  const maxCount = Math.max(...QR_CODES.map(q => counts[q.code] || 0), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">QR-koder</h1>
        <p className="text-warm-400 mt-1 text-sm">Antal besök per QR-kod</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-warm-400">Laddar...</div>
      ) : (
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6 space-y-5">
          {QR_CODES.map((qr) => {
            const count = counts[qr.code] || 0;
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={qr.code}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex flex-col">
                    <span className="text-sm text-warm-200 font-medium">{qr.label}</span>
                    <span className="text-xs text-warm-500">{qr.url}</span>
                  </div>
                  <span className="text-lg font-bold text-white">{count}</span>
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

          {/* Any codes seen in the data that aren't in the list above */}
          {Object.keys(counts)
            .filter(code => !QR_CODES.some(q => q.code === code))
            .map(code => (
              <div key={code} className="flex items-center justify-between border-t border-navy-600 pt-3">
                <span className="text-sm text-warm-400">{code} (okänd)</span>
                <span className="text-sm font-bold text-white">{counts[code]}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
