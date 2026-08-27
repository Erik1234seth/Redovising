'use client';

import { useState, useEffect } from 'react';
import { formatPhone } from '@/lib/sms/phone';

/**
 * Bekräftelserutan för att radera en eller flera personer.
 *
 * Raderingen går inte att ångra och tar med sig inloggningen, så rutan hämtar
 * först en torrkörning från API:t och visar exakt hur många rader som
 * försvinner, tabell för tabell. Den räkningen är hela skyddet — därför öppnas
 * rutan aldrig med knappen färdig att klickas på förrän siffrorna är på plats.
 */

interface Target {
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface Preview {
  tables: { table: string; rows: number }[];
  total: number;
  authUsers: number;
  activeSubscription: boolean;
}

/** Tabellnamnen som de heter på svenska, så rutan går att läsa. */
const TABLE_LABEL: Record<string, string> = {
  contact_requests: 'Kontaktförfrågningar',
  contact_files: 'Filer på förfrågan',
  meetings: 'Bokade möten',
  pending_registrations: 'Registreringslänkar',
  email_log: 'Loggade mejl',
  sms_messages: 'SMS',
  files: 'Uppladdade filer',
  user_accounting_documents: 'Bokföringsdokument',
  orders: 'Beställningar',
  fakturor: 'Fakturor',
  kunder: 'Kunder i faktureringen',
  produkter: 'Produkter',
  lagertillgangar: 'Lager och inventarier',
  bokforing_transaktioner: 'Bokförda händelser',
  manual_transactions: 'Manuella transaktioner',
  parsed_transactions: 'Kontoutdragsrader',
  funnel_events: 'Spårade sidbesök',
  sie_files: 'SIE-filer',
  email_threads: 'AI-mejltrådar',
  profiles: 'Profil',
};

const nameOf = (p: Target) =>
  p.name || p.email || (p.phone ? formatPhone(p.phone) : p.key);

export default function DeletePerson({
  people,
  onClose,
  onDeleted,
}: {
  people: Target[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const keys = people.map((p) => p.key);
  const many = people.length > 1;

  useEffect(() => {
    fetch('/api/admin/people', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys, dryRun: true }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setPreview(data.preview);
      })
      .catch(() => setError('Kunde inte räkna ut vad som skulle raderas'));
    // Nycklarna är det enda som styr uträkningen, och de ändras inte medan
    // rutan är öppen — stängs den och öppnas igen monteras allt om ändå.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(',')]);

  const remove = async () => {
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/people', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) { setError(data.error); return; }
    onDeleted();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-navy-800 border border-navy-600 rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-white">
          {many ? `Radera ${people.length} personer` : `Radera ${nameOf(people[0])}`}
        </h2>
        <p className="text-warm-400 text-sm mt-1.5">
          Allt nedan försvinner ur databasen. Det går inte att ångra.
        </p>

        {many && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {people.map((p) => (
              <span
                key={p.key}
                className="px-2 py-1 rounded-lg bg-navy-700 border border-navy-600 text-warm-300 text-xs"
              >
                {nameOf(p)}
              </span>
            ))}
          </div>
        )}

        {preview === null && !error && (
          <p className="text-warm-500 text-sm mt-5">Räknar ut vad som berörs...</p>
        )}

        {preview && (
          <>
            <div className="mt-5 bg-navy-700/50 border border-navy-600 rounded-xl divide-y divide-navy-600/60">
              {preview.tables.length === 0 ? (
                <p className="px-3 py-3 text-warm-500 text-sm">
                  Inget att radera — {many ? 'de finns' : 'personen finns'} inte kvar i någon tabell.
                </p>
              ) : (
                preview.tables.map(({ table, rows }) => (
                  <div key={table} className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <span className="text-warm-300 text-sm">{TABLE_LABEL[table] ?? table}</span>
                    <span className="text-warm-500 text-xs shrink-0">
                      {rows} {rows === 1 ? 'rad' : 'rader'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {preview.authUsers > 0 && (
              <p className="mt-3 text-sm text-red-400">
                {preview.authUsers === 1
                  ? 'En inloggning tas bort. Personen kan inte längre logga in på sitt konto.'
                  : `${preview.authUsers} inloggningar tas bort. De kan inte längre logga in på sina konton.`}
              </p>
            )}

            {preview.activeSubscription && (
              <p className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {many ? 'Någon av dem' : 'Personen'} har ett aktivt abonnemang i Stripe. Det sägs{' '}
                <strong>inte</strong> upp av att du raderar här — avsluta det i Stripe först, annars
                fortsätter faktureringen mot ett konto som inte finns.
              </p>
            )}

            <p className="mt-4 text-warm-600 text-xs">
              Ett eventuellt STOPP på SMS ligger kvar, så vi inte börjar messa numret igen.
            </p>
          </>
        )}

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
            onClick={remove}
            disabled={busy || !preview}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition text-sm disabled:opacity-40 disabled:hover:bg-red-600"
          >
            {busy ? 'Raderar...' : preview ? `Radera ${preview.total} rader` : 'Radera'}
          </button>
        </div>
      </div>
    </div>
  );
}
