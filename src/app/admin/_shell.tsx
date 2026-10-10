'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationBell from './_bell';
import NavMenu from './_nav-menu';

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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Admin</h1>
        <label className="block text-sm font-medium text-slate-700 mb-2">Kod</label>
        <input
          type="password"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          autoFocus
          className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition mb-4"
        />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={busy || !code}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50"
        >
          {busy ? 'Loggar in...' : 'Logga in'}
        </button>
      </form>
    </div>
  );
}

/** Sidor med lista till vänster och detaljer till höger behöver hela bredden. */
const BREDA = ['/admin/inlamning', '/admin/kalender', '/admin/inkorg'];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bredd = BREDA.some((b) => pathname?.startsWith(b)) ? 'max-w-[1400px]' : 'max-w-5xl';
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
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className={`${bredd} mx-auto px-4 flex items-center justify-between h-14`}>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-900 font-bold text-sm hover:text-blue-700 transition">
              Admin
            </Link>
            <NavMenu />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={async () => {
                await fetch('/api/admin/login', { method: 'DELETE' }).catch(() => null);
                setUnlocked(false);
              }}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition"
            >
              Logga ut
            </button>
          </div>
        </div>
      </nav>
      <main className={`${bredd} mx-auto px-4 sm:px-6 py-8`}>{children}</main>
    </div>
  );
}
