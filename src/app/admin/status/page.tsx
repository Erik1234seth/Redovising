'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { StatusCheck, StatusLevel, StatusReport } from '@/lib/admin-types';
import { fullDate } from '../_pipeline';

/**
 * Systemstatus: en sida att titta på när man undrar "går allt fram just nu?".
 *
 * Bocken är sanningen i sidan, så den betyder samma sak överallt: senaste
 * försöket lyckades, eller tjänsten svarar just nu. Ett streck betyder att det
 * inte finns något att gå på — aldrig att det är bra. Det är skillnaden som gör
 * sidan värd att lita på.
 */

const LEVEL_STYLE: Record<StatusLevel, { ring: string; text: string; mark: string }> = {
  ok: { ring: 'bg-green-500/15 text-green-400', text: 'text-green-400', mark: '✓' },
  fail: { ring: 'bg-red-500/15 text-red-400', text: 'text-red-400', mark: '✕' },
  unknown: { ring: 'bg-navy-600 text-warm-500', text: 'text-warm-500', mark: '–' },
};

function CheckRow({ check }: { check: StatusCheck }) {
  const style = LEVEL_STYLE[check.level];

  return (
    <div className="flex items-start gap-3 py-3 border-b border-navy-700 last:border-0">
      <span className={`shrink-0 w-6 h-6 rounded-full grid place-items-center text-sm font-bold ${style.ring}`}>
        {style.mark}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-white font-medium">{check.label}</p>
          {check.at && (
            <span className="shrink-0 text-[11px] text-warm-600 tabular-nums">{fullDate(check.at)}</span>
          )}
        </div>
        <p className="text-xs text-warm-400 mt-0.5 break-words">{check.detail}</p>
        {check.level !== 'ok' && check.hint && (
          <p className="text-xs text-warm-600 mt-1 break-words">{check.hint}</p>
        )}
      </div>
    </div>
  );
}

export default function StatusPage() {
  const [report, setReport] = useState<StatusReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((data: StatusReport & { error?: string }) => {
        if (data.error) setError(data.error);
        else { setReport(data); setError(''); }
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta statusen'); setLoading(false); });
  }, []);

  useEffect(load, [load]);

  const all = report?.groups.flatMap((g) => g.checks) ?? [];
  const failing = all.filter((c) => c.level === 'fail');
  const allGood = all.length > 0 && failing.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-gold-500 hover:text-gold-400 text-sm transition">← Alla personer</Link>

        <div className="flex items-start justify-between gap-4 mt-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Systemstatus</h1>
            <p className="text-warm-400 text-sm mt-1.5">
              {loading && 'Kollar...'}
              {!loading && allGood && 'Alla flöden går fram.'}
              {!loading && !allGood && failing.length > 0 && `${failing.length} kontroller behöver ses över.`}
              {!loading && !allGood && failing.length === 0 && 'Ingen status att visa.'}
            </p>
            {report && (
              <p className="text-warm-600 text-xs mt-1">Kollat {fullDate(report.checkedAt)}</p>
            )}
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 disabled:opacity-50 text-warm-300 rounded-lg transition shrink-0"
          >
            {loading ? 'Kollar...' : 'Kolla igen'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {allGood && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 grid place-items-center text-lg font-bold">✓</span>
          <p className="text-green-400 text-sm font-medium">
            Lead in, välkomstmejl, välkomst-SMS och AI-svaren fungerar.
          </p>
        </div>
      )}

      {report?.groups.map((group) => (
        <div key={group.title} className="bg-navy-700/50 border border-navy-600 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-warm-400 uppercase tracking-widest">{group.title}</h2>
          <p className="text-xs text-warm-600 mt-1.5 mb-3">{group.note}</p>
          <div>
            {group.checks.map((check) => <CheckRow key={check.id} check={check} />)}
          </div>
        </div>
      ))}

      {!loading && !report && !error && (
        <p className="text-warm-500 text-sm">Ingen status att visa.</p>
      )}
    </div>
  );
}
