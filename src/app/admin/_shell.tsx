'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ADMIN_CODE = 'Erik0511';

const NAV = [
  { href: '/admin', label: 'Översikt', exact: true },
  { href: '/admin/bestallningar', label: 'Beställningar' },
  { href: '/admin/inmail', label: 'Inmail' },
  { href: '/admin/funnel', label: 'Funnel' },
  { href: '/admin/ab', label: 'A/B' },
];

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
  const pathname = usePathname();

  useEffect(() => {
    if (sessionStorage.getItem('admin_unlocked') === '1') setUnlocked(true);
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!unlocked) return <CodeGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="min-h-screen bg-navy-800">
      <nav className="bg-navy-900/80 border-b border-navy-600 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 h-14">
            <span className="text-white font-bold text-sm mr-3 shrink-0">Admin</span>
            <div className="flex items-center gap-1 overflow-x-auto flex-1">
              {NAV.map(({ href, label, exact }) => {
                const isActive = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      isActive ? 'bg-gold-500 text-navy-900' : 'text-warm-300 hover:text-white hover:bg-navy-700'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
            <button
              onClick={() => { sessionStorage.removeItem('admin_unlocked'); setUnlocked(false); }}
              className="ml-2 px-3 py-1.5 text-xs text-warm-500 hover:text-warm-300 transition shrink-0"
            >
              Logga ut
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
