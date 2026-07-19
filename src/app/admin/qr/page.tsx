'use client';

import { useState, useEffect } from 'react';
import { questions } from '@/data/kvalificera-questions';

// Labels for the codes you hand out. Add rows here when you print new letters
// or launch new ads.
const QR_CODES = [
  { code: 'brev-a', label: 'Brev A', url: 'enklabokslut.se/?ref=brev-a' },
  { code: 'brev-b', label: 'Brev B', url: 'enklabokslut.se/?ref=brev-b' },
  { code: 'brev-c', label: 'Brev C', url: 'enklabokslut.se/?ref=brev-c' },
  { code: 'brev-d', label: 'Brev D', url: 'enklabokslut.se/?ref=brev-d' },
  { code: 'fb-pris', label: 'FB — Allt ingår för 299', url: 'enklabokslut.se/?ref=fb-pris' },
  { code: 'fb-b', label: 'FB B', url: 'enklabokslut.se/?ref=fb-b' },
  { code: 'fb-c', label: 'FB C', url: 'enklabokslut.se/?ref=fb-c' },
  { code: 'fb-d', label: 'FB D', url: 'enklabokslut.se/?ref=fb-d' },
];

// Order visitors move through the popup in — matches AdFunnel's `Stage` type.
const STAGE_LABELS: Record<string, string> = {
  hook: 'Öppnade',
  how: 'Så funkar det',
  questions: 'Frågor',
  contact: 'Kontaktuppgifter',
  done: 'Skickade in',
  fail: 'Passade inte',
};
const STAGE_ORDER = ['hook', 'how', 'questions', 'contact', 'done', 'fail'];

// Hur långt in i kontaktformuläret besökaren hann innan de försvann.
const PROGRESS_LABELS: Record<string, string> = {
  opened: 'Rörde inget',
  name: 'Fyllde namn',
  email: 'Fyllde e-post',
  method: 'Valde kontaktsätt',
  phone: 'Fyllde telefon',
  notes: 'Skrev anteckning',
};
const PROGRESS_ORDER = ['opened', 'name', 'email', 'method', 'phone', 'notes'];

interface QuestionStats { stalledOn: Record<string, number>; failedOn: Record<string, number>; }
interface ContactStats {
  total: number;
  progress: Record<string, number>;
  mobile: number;
  failedSubmit: number;
  medianViewportH: number | null;
}

export default function QrPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [funnels, setFunnels] = useState<Record<string, Record<string, number>>>({});
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
  const [contact, setContact] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/qr-stats')
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setCounts(data.counts || {});
          setFunnels(data.funnels || {});
          setQuestionStats(data.questions || null);
          setContact(data.contact || null);
        }
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
                <FunnelBreakdown funnel={funnels[qr.code]} />
              </div>
            );
          })}

          {/* Any codes seen in the data that aren't in the list above
              (e.g. "organic", "valkommen" — visitors who came without a
              printed/ad code) */}
          {Object.keys(counts)
            .filter(code => !QR_CODES.some(q => q.code === code))
            .map(code => (
              <div key={code} className="border-t border-navy-600 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-warm-400">{code} (okänd)</span>
                  <span className="text-sm font-bold text-white">{counts[code]}</span>
                </div>
                <FunnelBreakdown funnel={funnels[code]} />
              </div>
            ))}
        </div>
      )}

      {!loading && <QuestionDropoff stats={questionStats} />}
      {!loading && <ContactDropoff stats={contact} />}
    </div>
  );
}

// Vilken fråga som tappar folk — de som stannade mitt i, och de som blev
// diskvalificerade (vilket säger vilket kriterium annonsen drar fel publik på).
function QuestionDropoff({ stats }: { stats: QuestionStats | null }) {
  if (!stats) return null;
  const rows = questions.map((q, i) => ({
    text: q.text,
    stalled: stats.stalledOn[String(i)] || 0,
    failed: stats.failedOn[String(i)] || 0,
  }));
  if (rows.every(r => r.stalled === 0 && r.failed === 0)) return null;

  return (
    <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6">
      <h2 className="text-sm font-bold text-white mb-1">Var frågorna tappar folk</h2>
      <p className="text-xs text-warm-500 mb-4">
        &quot;Stannade&quot; = slutade svara på den frågan. &quot;Passade inte&quot; = frågan diskvalificerade dem.
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-start justify-between gap-4">
            <span className="text-xs text-warm-400 flex-1">
              <span className="text-warm-600">{i + 1}.</span> {r.text}
            </span>
            <span className="text-xs whitespace-nowrap">
              <span className="text-warm-500">Stannade: </span>
              <span className="text-warm-200 font-semibold">{r.stalled}</span>
              <span className="text-warm-600"> · </span>
              <span className="text-warm-500">Passade inte: </span>
              <span className="text-warm-200 font-semibold">{r.failed}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Vad de som nådde kontaktformuläret men aldrig skickade in hann göra först.
function ContactDropoff({ stats }: { stats: ContactStats | null }) {
  if (!stats || stats.total === 0) return null;

  return (
    <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-6">
      <h2 className="text-sm font-bold text-white mb-1">Avhopp i kontaktformuläret</h2>
      <p className="text-xs text-warm-500 mb-4">
        {stats.total} nådde formuläret utan att skicka in. Längsta punkt de kom till:
      </p>
      <div className="space-y-2 mb-4">
        {PROGRESS_ORDER.filter(p => stats.progress[p]).map(p => {
          const n = stats.progress[p];
          return (
            <div key={p} className="flex items-center justify-between gap-4">
              <span className="text-xs text-warm-400">{PROGRESS_LABELS[p]}</span>
              <span className="text-xs">
                <span className="text-warm-200 font-semibold">{n}</span>
                <span className="text-warm-600"> ({Math.round((n / stats.total) * 100)}%)</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-navy-600 pt-3">
        <span className="text-xs text-warm-500">
          På mobil: <span className="text-warm-300 font-semibold">{stats.mobile}</span>
          <span className="text-warm-600"> av {stats.total}</span>
        </span>
        <span className="text-xs text-warm-500">
          Tryckte skicka utan att lyckas:{' '}
          <span className="text-warm-300 font-semibold">{stats.failedSubmit}</span>
        </span>
        {stats.medianViewportH !== null && (
          <span className="text-xs text-warm-500">
            Median skärmhöjd: <span className="text-warm-300 font-semibold">{stats.medianViewportH}px</span>
          </span>
        )}
      </div>
    </div>
  );
}

// Shows how many visitors for a given code reached each popup stage — a
// mini funnel so you can see where people drop off (e.g. 40 "Öppnade" but
// only 5 "Skickade in").
function FunnelBreakdown({ funnel }: { funnel?: Record<string, number> }) {
  if (!funnel) return null;
  const stages = STAGE_ORDER.filter(s => funnel[s]);
  if (stages.length === 0) return null;
  const opened = funnel.hook || Math.max(...stages.map(s => funnel[s]));

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pl-1">
      {stages.map((s) => (
        <span key={s} className="text-xs text-warm-500">
          {STAGE_LABELS[s]}: <span className="text-warm-300 font-semibold">{funnel[s]}</span>
          {opened > 0 && s !== 'hook' && (
            <span className="text-warm-600"> ({Math.round((funnel[s] / opened) * 100)}%)</span>
          )}
        </span>
      ))}
    </div>
  );
}
