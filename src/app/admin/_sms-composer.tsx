'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Person } from '@/lib/admin-types';
import { normalizePhone, formatPhone } from '@/lib/sms/phone';
import { segments } from './_pipeline';

/**
 * Rutan där du skriver ett SMS för hand och skickar det direkt.
 *
 * Allt annat vi messar är antingen en mall (välkomst-SMS) eller AI:ns förslag
 * som godkänns på /admin/sms. Den här är för det som inte passar i någotdera:
 * en påminnelse, ett svar på något som sagts i telefon, en knuff till någon som
 * fastnat i flödet. Det finns inget utkaststeg — texten går ut när du trycker.
 *
 * Öppnas rutan från en persons sida är mottagaren given. Öppnas den från
 * SMS-sidan får du söka fram någon, eller knappa in ett nummer som inte finns i
 * databasen — därför ett fritextfält och inte en ren lista.
 */

interface Target {
  phone: string;
  name: string | null;
  optedOut?: boolean;
}

/** Hur många träffar sökningen visar. Fler blir en lista att bläddra i. */
const MAX_MATCHES = 6;

const nameOf = (p: Person) => p.name || p.email || formatPhone(p.phone ?? '');

export default function SmsComposer({
  to,
  onClose,
  onSent,
}: {
  /** Färdig mottagare när rutan öppnas från en person. Utan den får du söka. */
  to?: Target | null;
  onClose: () => void;
  /** Anropas efter ett lyckat utskick, så tidslinjen bakom kan hämtas om. */
  onSent?: () => void;
}) {
  const fixed = to?.phone ? normalizePhone(to.phone) : null;

  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Person | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Personerna behövs bara när mottagaren inte redan är bestämd.
  useEffect(() => {
    if (fixed) return;
    fetch('/api/admin/people')
      .then((r) => r.json())
      .then((data) => setPeople((data.people ?? []).filter((p: Person) => p.phone)))
      .catch(() => { /* sökningen är en genväg — fritextfältet fungerar ändå */ });
  }, [fixed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (fixed || picked || !q) return [];
    const digits = q.replace(/\D/g, '');
    return people
      .filter((p) =>
        [p.name, p.email, p.company].some((v) => v?.toLowerCase().includes(q)) ||
        (digits.length >= 3 && p.phone?.includes(digits)),
      )
      .slice(0, MAX_MATCHES);
  }, [people, query, picked, fixed]);

  const target = fixed ?? picked?.phone ?? normalizePhone(query);
  const targetName = to?.name ?? (picked ? nameOf(picked) : null);
  const optedOut = fixed
    ? to?.optedOut ?? false
    : picked?.optedOut ?? people.find((p) => p.phone === target)?.optedOut ?? false;

  const count = segments(text);
  const empty = !text.trim();

  const send = async () => {
    if (!target || empty || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/sms-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: target, body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || 'Det gick inte att skicka');
      else {
        setSentTo(data.phone ?? target);
        onSent?.();
      }
    } catch {
      setError('Det gick inte att nå servern');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-navy-800 border border-navy-600 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {sentTo ? (
          <>
            <h2 className="text-lg font-bold text-white">SMS skickat</h2>
            <p className="text-warm-400 text-sm mt-1.5">
              Gick i väg till {formatPhone(sentTo)}
              {targetName ? ` (${targetName})` : ''}. Det ligger nu i personens historik, och
              kommer det ett svar dyker AI:ns förslag upp bland utkasten.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setSentTo(null);
                  setText('');
                  if (!fixed) { setPicked(null); setQuery(''); }
                }}
                className="flex-1 py-2.5 bg-navy-700 text-warm-300 hover:text-white rounded-xl transition text-sm font-medium"
              >
                Skriv ett till
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all text-sm"
              >
                Klart
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-white">Nytt SMS</h2>
            <p className="text-warm-400 text-sm mt-1.5">
              Texten går ut direkt när du trycker Skicka — det här är inget utkast.
            </p>

            <label className="block text-xs font-semibold text-warm-400 uppercase tracking-widest mt-5 mb-2">
              Till
            </label>

            {fixed ? (
              <div className="bg-navy-700/50 border border-navy-600 rounded-xl px-4 py-3 text-sm text-white">
                {to?.name ? <span>{to.name} · </span> : null}
                <span className="text-warm-300">{formatPhone(fixed)}</span>
              </div>
            ) : (
              <>
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPicked(null); setError(''); }}
                  placeholder="Sök namn eller skriv ett nummer"
                  autoFocus
                  className="w-full px-4 py-2.5 bg-navy-700/50 border border-navy-600 text-white placeholder-warm-600 rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition text-sm"
                />

                {matches.length > 0 && (
                  <div className="mt-2 bg-navy-700/50 border border-navy-600 rounded-xl divide-y divide-navy-600/60 overflow-hidden">
                    {matches.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => { setPicked(p); setQuery(nameOf(p)); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-navy-600/60 transition"
                      >
                        <span className="text-white text-sm">{nameOf(p)}</span>
                        <span className="text-warm-500 text-xs ml-2">{formatPhone(p.phone ?? '')}</span>
                        {p.optedOut && <span className="text-red-400 text-[11px] ml-2">avregistrerad</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Numret som faktiskt skickas till, så en feltolkad inknappning
                    syns innan SMS:et går i väg. */}
                <p className="text-warm-600 text-[11px] mt-1.5">
                  {!query.trim() ? (
                    'Går även bra att skriva in ett nummer som inte finns i listan.'
                  ) : target ? (
                    <>Skickas till {formatPhone(target)}{targetName ? ` · ${targetName}` : ''}</>
                  ) : (
                    <span className="text-red-400">Inget giltigt telefonnummer ännu</span>
                  )}
                </p>
              </>
            )}

            {optedOut && (
              <p className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-400 text-xs">
                Numret har avregistrerat sig från SMS. Utskicket går inte igenom.
              </p>
            )}

            <label className="block text-xs font-semibold text-warm-400 uppercase tracking-widest mt-5 mb-2">
              Meddelande
            </label>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(''); }}
              rows={6}
              autoFocus={!!fixed}
              placeholder="Skriv meddelandet här"
              className="w-full bg-navy-700/50 border border-navy-600 text-warm-100 placeholder-warm-600 text-sm rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition resize-y"
            />
            <p className="text-warm-600 text-[11px] mt-1.5">
              {text.length} tecken · {count} SMS{count > 1 ? ' (delas upp och debiteras styckvis)' : ''}
            </p>

            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                disabled={busy}
                className="flex-1 py-2.5 bg-navy-700 text-warm-300 hover:text-white rounded-xl transition text-sm font-medium disabled:opacity-50"
              >
                Avbryt
              </button>
              <button
                onClick={send}
                disabled={busy || empty || !target || optedOut}
                className="flex-1 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Skickar...' : 'Skicka'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
