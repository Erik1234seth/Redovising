'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { Person } from '@/lib/admin-types';
import { STAGES, shortDate } from './_pipeline';
import { formatPhone } from '@/lib/sms/phone';

type Filter = 'alla' | 'prospekt' | 'kunder';

function StageDots({ stage }: { stage: number | null }) {
  if (!stage) return <span className="text-warm-600 text-xs">—</span>;
  return (
    <div className="flex items-center gap-1" title={STAGES[stage - 1]?.label}>
      {STAGES.map((s) => (
        <span
          key={s.step}
          className={`w-1.5 h-1.5 rounded-full ${s.step <= stage ? 'bg-gold-500' : 'bg-navy-600'}`}
        />
      ))}
    </div>
  );
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('alla');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/people')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else { setPeople(data.people ?? []); setError(''); }
        setLoading(false);
      })
      .catch(() => { setError('Kunde inte hämta personerna'); setLoading(false); });
  };

  useEffect(load, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (filter === 'kunder' && !p.isCustomer) return false;
      if (filter === 'prospekt' && p.isCustomer) return false;
      if (!q) return true;
      return [p.name, p.email, p.phone, p.company, p.source]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [people, query, filter]);

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/admin/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) { setError(data.error); return; }
    setAdding(false);
    setForm({ name: '', email: '', phone: '' });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Personer</h1>
          <p className="text-warm-400 mt-1 text-sm">
            {loading ? 'Laddar...' : `${visible.length} av ${people.length}`}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="px-4 py-2 bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white rounded-xl text-sm font-medium transition"
        >
          + Lägg till
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök namn, mejl eller telefon"
          className="flex-1 px-4 py-2.5 bg-navy-700/50 border border-navy-600 text-white placeholder-warm-600 rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition text-sm"
        />
        <div className="flex gap-1 bg-navy-700/50 border border-navy-600 rounded-xl p-1">
          {(['alla', 'prospekt', 'kunder'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                filter === f ? 'bg-gold-500 text-navy-900' : 'text-warm-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-warm-400">Laddar...</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-warm-400">
            {people.length === 0 ? 'Inga personer ännu' : 'Ingen träff'}
          </div>
        ) : (
          visible.map((p) => (
            <Link
              key={p.key}
              href={`/admin/person/${encodeURIComponent(p.key)}`}
              className="flex items-center gap-4 px-4 py-3 border-b border-navy-600/50 last:border-0 hover:bg-navy-700/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm truncate">
                    {p.name || p.email || (p.phone ? formatPhone(p.phone) : '—')}
                  </span>
                  {p.isCustomer && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-400 shrink-0">Kund</span>
                  )}
                  {p.optedOut && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 shrink-0">Avreg</span>
                  )}
                </div>
                <div className="text-xs text-warm-500 truncate">
                  {[p.email, p.phone && formatPhone(p.phone), p.source].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[11px] shrink-0 w-20 justify-end">
                {p.emailCount > 0 && <span className="text-blue-400">✉ {p.emailCount}</span>}
                {p.smsCount > 0 && <span className="text-green-400">💬 {p.smsCount}</span>}
              </div>

              <div className="shrink-0 w-16 flex justify-center"><StageDots stage={p.stage} /></div>

              <div className="text-warm-500 text-[11px] shrink-0 w-14 text-right">
                {shortDate(p.lastActivity)}
              </div>
            </Link>
          ))
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-navy-800 border border-navy-600 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-white mb-5">Lägg till person</h2>
            <div className="space-y-3">
              {([
                { key: 'name', label: 'Namn' },
                { key: 'email', label: 'Mejl' },
                { key: 'phone', label: 'Telefon' },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm text-warm-300 mb-1">{label}</label>
                  <input
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-700 border border-navy-600 text-white rounded-lg focus:ring-2 focus:ring-gold-500 outline-none transition text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setAdding(false)} className="flex-1 py-2.5 bg-navy-700 text-warm-300 hover:text-white rounded-xl transition text-sm font-medium">
                Avbryt
              </button>
              <button
                onClick={save}
                disabled={saving || !form.email.includes('@')}
                className="flex-1 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-bold rounded-xl transition text-sm disabled:opacity-50"
              >
                {saving ? 'Sparar...' : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
