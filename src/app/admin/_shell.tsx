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
 *
 * Inloggningen tar tre steg: lösenord, vem man är, och sms-koden som skickas
 * till den personen. Lösenordet hålls kvar här och skickas med i varje steg,
 * så servern aldrig behöver komma ihåg ett halvfärdigt försök.
 */
function CodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [people, setPeople] = useState<string[] | null>(null);
  const [person, setPerson] = useState<number | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ...body }),
    }).catch(() => null);
    setBusy(false);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) setError(data?.error || 'Något gick fel, försök igen');
    return res?.ok ? data : null;
  };

  const startOver = () => {
    setPeople(null);
    setPerson(null);
    setSmsCode('');
    setCode('');
  };

  const sendSms = async (index: number) => {
    const data = await post({ person: index });
    if (!data) return;
    setPerson(index);
    setSentTo(data.sentTo);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (person !== null) {
      const data = await post({ person, smsCode });
      if (data) onUnlock();
      else setSmsCode('');
      return;
    }

    const data = await post({});
    if (!data) { setCode(''); return; }
    setPeople(data.people);
    // Finns bara en person finns inget att välja — skicka koden direkt
    if (data.people.length === 1) await sendSms(0);
  };

  const inputClass =
    'w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition mb-4';
  const buttonClass =
    'w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Admin</h1>

        {people === null && (
          <>
            <label className="block text-sm font-medium text-slate-700 mb-2">Kod</label>
            <input
              type="password"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(''); }}
              autoFocus
              className={inputClass}
            />
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <button type="submit" disabled={busy || !code} className={buttonClass}>
              {busy ? 'Kontrollerar...' : 'Fortsätt'}
            </button>
          </>
        )}

        {people !== null && person === null && (
          <>
            <p className="text-sm text-slate-700 mb-3">Vem är du? Du får en kod på sms.</p>
            <div className="flex flex-col gap-2 mb-4">
              {people.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  disabled={busy}
                  onClick={() => sendSms(index)}
                  className="w-full py-3 border border-slate-200 rounded-xl text-slate-900 font-medium hover:bg-slate-50 transition disabled:opacity-50"
                >
                  {name}
                </button>
              ))}
            </div>
            {busy && <p className="text-slate-500 text-sm mb-3">Skickar sms...</p>}
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          </>
        )}

        {person !== null && (
          <>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Sms-kod skickad till {sentTo}
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={smsCode}
              onChange={(e) => { setSmsCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              autoFocus
              className={`${inputClass} tracking-[0.5em] text-center text-lg`}
            />
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <button type="submit" disabled={busy || smsCode.length !== 6} className={buttonClass}>
              {busy ? 'Loggar in...' : 'Logga in'}
            </button>
            <div className="flex justify-between mt-3 text-xs">
              <button type="button" disabled={busy} onClick={() => sendSms(person)} className="text-slate-500 hover:text-slate-700">
                Skicka ny kod
              </button>
              <button type="button" disabled={busy} onClick={startOver} className="text-slate-500 hover:text-slate-700">
                Börja om
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

/** Sidor med lista till vänster och detaljer till höger behöver hela bredden. */
const BREDA = ['/admin/inlamning', '/admin/kalender', '/admin/inkorg'];

/** Flödesschemat ritas över hela fönstrets bredd. */
const HELA_FONSTRET = ['/admin/flodesschema'];

/** Översikten är startsidan och får också hela bredden — men bara på exakt /admin. */
const BRED_EXAKT = ['/admin'];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bredd = HELA_FONSTRET.some((b) => pathname?.startsWith(b))
    ? 'max-w-none'
    : BREDA.some((b) => pathname?.startsWith(b)) || BRED_EXAKT.includes(pathname ?? '') ? 'max-w-[1400px]' : 'max-w-5xl';
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
