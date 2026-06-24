'use client';

import { useState, useEffect } from 'react';

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

export default function FunnelPage() {
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/orders')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setStepCounts(data.stepCounts || {});
        setLoading(false);
      });
  }, []);

  const maxCount = Math.max(...Object.values(stepCounts), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Funnel</h1>
        <p className="text-warm-400 mt-1 text-sm">Unika besökare per steg</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-warm-400">Laddar...</div>
      ) : (
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6">
          {Object.keys(stepCounts).length === 0 ? (
            <div className="text-center py-12 text-warm-400">Ingen data ännu — börjar samlas in när användare besöker flödet</div>
          ) : (
            <div className="space-y-5">
              {FLOW_STEPS.map((step, index) => {
                const count = stepCounts[step.key] || 0;
                const pct = Math.round((count / maxCount) * 100);
                const prevCount = index > 0 ? stepCounts[FLOW_STEPS[index - 1].key] : null;
                const dropPct = prevCount ? Math.round((1 - count / prevCount) * 100) : null;
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
  );
}
