'use client';

import { useMemo, useState } from 'react';
import { kundNamn, type Kund } from './kunder';

/**
 * Sök- och klicklista för att välja kund. Används av både Underlag-fliken
 * (kontexten till AI:n) och SIE4-fliken (koppla en fil till en kund).
 */
export default function KundValjare({
  kunder,
  value,
  onChange,
  visaVerksamhet = true,
  visaKontext = false,
  kompakt = false,
}: {
  kunder: Kund[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Visa verksamhetstexten under vald kund och i listan */
  visaVerksamhet?: boolean;
  /** Erbjud "Visa vad AI:n får" med hela kontextblocket */
  visaKontext?: boolean;
  /** Lägre lista, för trängre lägen */
  kompakt?: boolean;
}) {
  const [sök, setSök] = useState('');
  const [baraMedVerksamhet, setBaraMedVerksamhet] = useState(visaKontext);
  const [öppetKontext, setÖppetKontext] = useState(false);

  const vald = kunder.find((k) => k.id === value) ?? null;

  const synliga = useMemo(() => {
    const q = sök.trim().toLowerCase();
    return kunder
      .filter((k) => (baraMedVerksamhet ? Boolean(k.verksamhet) : true))
      .filter((k) =>
        q ? [k.company_name, k.full_name, k.email, k.verksamhet, k.ort].join(' ').toLowerCase().includes(q) : true
      );
  }, [kunder, sök, baraMedVerksamhet]);

  if (vald) {
    return (
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{kundNamn(vald)}</p>
            {vald.ort && <p className="text-xs text-slate-400">{vald.ort}</p>}
          </div>
          <button
            onClick={() => onChange(null)}
            className="shrink-0 text-xs text-slate-400 underline transition hover:text-white"
          >
            Byt
          </button>
        </div>

        {visaVerksamhet && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
            {vald.verksamhet || (
              <span className="text-amber-300">Ingen verksamhetsbeskrivning ifylld på den här kunden.</span>
            )}
          </p>
        )}

        {visaKontext && (
          <>
            <button
              onClick={() => setÖppetKontext((v) => !v)}
              className="mt-3 text-xs text-slate-400 underline transition hover:text-white"
            >
              {öppetKontext ? 'Dölj kontexten' : 'Visa vad AI:n får'}
            </button>
            {öppetKontext && (
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs text-slate-300">
                {vald.kontext || '(inga uppgifter — inget kontext skickas)'}
              </pre>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <input
        value={sök}
        onChange={(e) => setSök(e.target.value)}
        placeholder="Sök kund…"
        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
      />
      <div className={`mt-2 overflow-auto rounded-lg border border-white/10 ${kompakt ? 'max-h-40' : 'max-h-64'}`}>
        {synliga.length === 0 && <p className="px-3 py-4 text-center text-xs text-slate-500">Inga kunder matchar.</p>}
        {synliga.map((k) => (
          <button
            key={k.id}
            onClick={() => onChange(k.id)}
            className="block w-full border-b border-white/5 px-3 py-2 text-left transition last:border-0 hover:bg-white/10"
          >
            <span className="block truncate text-sm">{kundNamn(k)}</span>
            {visaVerksamhet && k.verksamhet && (
              <span className="block truncate text-xs text-slate-400">{k.verksamhet}</span>
            )}
          </button>
        ))}
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={baraMedVerksamhet}
          onChange={(e) => setBaraMedVerksamhet(e.target.checked)}
        />
        Bara kunder med verksamhetstext ({kunder.filter((k) => k.verksamhet).length} av {kunder.length})
      </label>
    </>
  );
}
