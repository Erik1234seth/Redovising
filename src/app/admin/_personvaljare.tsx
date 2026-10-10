'use client';

import { useMemo, useState } from 'react';
import type { Person } from '@/lib/admin-types';

/**
 * Sökfält för att välja en person — på namn, företag, mejl eller telefon.
 * Valet blir en bricka med kryss. Enter väljer första träffen och skickar
 * aldrig formuläret runt omkring.
 */

export interface ValdPerson { personKey: string; personNamn: string | null }

const visningsnamn = (p: Person) => p.name || p.company || p.email || p.phone || p.key;

export function PersonValjare({ personer, valt, onVal, className = '' }: {
  personer: Person[];
  valt: ValdPerson | null;
  onVal: (p: ValdPerson | null) => void;
  className?: string;
}) {
  const [sok, setSok] = useState('');
  const [oppen, setOppen] = useState(false);

  const traffar = useMemo(() => {
    const q = sok.trim().toLowerCase();
    if (!q) return [];
    return personer
      .filter((p) => [p.name, p.company, p.email, p.phone].some((f) => f?.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.isCustomer) - Number(a.isCustomer))
      .slice(0, 8);
  }, [sok, personer]);

  const valj = (p: Person) => {
    onVal({ personKey: p.email || p.phone || p.key, personNamn: p.name || p.company || null });
    setSok('');
    setOppen(false);
  };

  if (valt) {
    return (
      <div className={`flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm ${className}`}>
        <span className="text-slate-900 truncate">{valt.personNamn || valt.personKey}</span>
        {valt.personNamn && <span className="text-slate-400 text-xs truncate">{valt.personKey}</span>}
        <button type="button" onClick={() => onVal(null)} title="Ta bort kunden" className="ml-auto text-slate-400 hover:text-red-600">✕</button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <input
        value={sok}
        onChange={(e) => { setSok(e.target.value); setOppen(true); }}
        onFocus={() => setOppen(true)}
        onBlur={() => setTimeout(() => setOppen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (traffar[0]) valj(traffar[0]);
          }
          if (e.key === 'Escape') setOppen(false);
        }}
        placeholder="Kund (valfritt) — sök namn, mejl eller telefon"
        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
      />
      {oppen && traffar.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-72 overflow-y-auto">
          {traffar.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); valj(p); }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2"
              >
                <span className="text-sm text-slate-900 truncate">{visningsnamn(p)}</span>
                {p.isCustomer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Kund</span>}
                <span className="ml-auto text-xs text-slate-400 truncate">{p.email || p.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {oppen && sok.trim() && traffar.length === 0 && (
        <p className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs text-slate-500">
          Ingen träff
        </p>
      )}
    </div>
  );
}
