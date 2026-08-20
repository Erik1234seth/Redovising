'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const ADMIN_CODE = 'Erik0511';

function CodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ADMIN_CODE) {
      sessionStorage.setItem('admin_unlocked', '1');
      onUnlock();
    } else {
      setError(true);
      setCode('');
    }
  };

  return (
    <div className="min-h-screen bg-navy-800 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-navy-700/50 border border-navy-600 rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Admin</h1>
        <label className="block text-sm font-medium text-warm-300 mb-2">Kod</label>
        <input
          type="password"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(false); }}
          autoFocus
          className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition mb-4"
        />
        {error && <p className="text-red-400 text-sm mb-3">Fel kod, försök igen</p>}
        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200"
        >
          Logga in
        </button>
      </form>
    </div>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('admin_unlocked') === '1') setUnlocked(true);
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!unlocked) return <CodeGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="min-h-screen bg-navy-800">
      {/* Panelen har bara en vy, så ingen navigering behövs — logotypen leder hem */}
      <nav className="bg-navy-900/80 border-b border-navy-600 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/admin" className="text-white font-bold text-sm hover:text-gold-500 transition">
            Admin
          </Link>
          <button
            onClick={() => { sessionStorage.removeItem('admin_unlocked'); setUnlocked(false); }}
            className="px-3 py-1.5 text-xs text-warm-500 hover:text-warm-300 transition"
          >
            Logga ut
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
