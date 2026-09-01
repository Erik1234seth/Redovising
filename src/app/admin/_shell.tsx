'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import NotificationBell from './_bell';
import DraftBadge from './_draft-badge';
import UnderlagBadge from './_underlag-badge';

/**
 * Koden kontrolleras på servern, i `/api/admin/login`. Att jämföra den här
 * inne vore verkningslöst: allt som ligger i en klientkomponent går att läsa i
 * webbläsaren, och det är ändå middleware som avgör om API:t svarar.
 */
function CodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    setBusy(false);

    if (res?.ok) { onUnlock(); return; }
    const data = await res?.json().catch(() => null);
    setError(data?.error || 'Fel kod, försök igen');
    setCode('');
  };

  return (
    <div className="min-h-screen bg-navy-800 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-navy-700/50 border border-navy-600 rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Admin</h1>
        <label className="block text-sm font-medium text-warm-300 mb-2">Kod</label>
        <input
          type="password"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          autoFocus
          className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition mb-4"
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={busy || !code}
          className="w-full py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200 disabled:opacity-50"
        >
          {busy ? 'Loggar in...' : 'Logga in'}
        </button>
      </form>
    </div>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  // Kakan är HttpOnly och går inte att läsa härifrån — servern får svara på
  // om den fortfarande duger.
  useEffect(() => {
    fetch('/api/admin/login')
      .then((r) => setUnlocked(r.ok))
      .catch(() => setUnlocked(false))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null;
  if (!unlocked) return <CodeGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="min-h-screen bg-navy-800">
      <nav className="bg-navy-900/80 border-b border-navy-600 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-white font-bold text-sm hover:text-gold-500 transition">
              Admin
            </Link>
            <DraftBadge />
            <UnderlagBadge />
            <Link href="/admin/status" className="text-warm-400 text-sm hover:text-gold-500 transition">
              Systemstatus
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={async () => {
                await fetch('/api/admin/login', { method: 'DELETE' }).catch(() => null);
                setUnlocked(false);
              }}
              className="px-3 py-1.5 text-xs text-warm-500 hover:text-warm-300 transition"
            >
              Logga ut
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
