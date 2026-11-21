'use client';

/**
 * Bankrader som kunden ser dem: datum, motpart, vad raden är kopplad till och
 * beloppet. Används på startsidan (de senast kopplade) och i kontovyn (alla).
 */

export interface Bankrad {
  kontoHash: string;
  transaktionId: string;
  bokforingsdag: string;
  beloppOre: number;
  valuta: string;
  text: string | null;
  motpart: string | null;
  falt: {
    kopdag?: string;
    ocr?: string;
    utlandskt_belopp?: { belopp: number; valuta: string; kurs?: number };
    motpart_konto?: string;
    typ?: string;
    branschkod?: string;
  };
  koppling: { text: string; slag: 'underlag' | 'faktura' | 'dagskassa'; sakerhet?: 'saker' | 'trolig' | 'forslag' } | null;
}

export function formatKr(belopp: number, valuta = 'SEK') {
  return belopp.toLocaleString('sv-SE', { style: 'currency', currency: valuta || 'SEK', maximumFractionDigits: Math.abs(belopp) >= 1000 ? 0 : 2 });
}

/** "SE45 …4521" — landskoden och de sista siffrorna räcker för att känna igen kontot. */
export function kortIban(iban: string | null) {
  if (!iban) return null;
  const s = iban.replace(/\s/g, '');
  return s.length > 8 ? `${s.slice(0, 4)} …${s.slice(-4)}` : s;
}

const datum = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });

function Status({ k }: { k: Bankrad['koppling'] }) {
  if (!k) return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">Saknar underlag</span>;
  if (k.sakerhet === 'forslag') return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 whitespace-nowrap">Kanske</span>;
  if (k.sakerhet === 'trolig') return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 whitespace-nowrap">Trolig</span>;
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 whitespace-nowrap">Kopplad</span>;
}

function Ikon({ slag }: { slag: NonNullable<Bankrad['koppling']>['slag'] }) {
  const d = slag === 'faktura'
    ? 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    : slag === 'dagskassa'
      ? 'M3 3h18v4H3zM5 7v13h14V7M9 11h6'
      : 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13';
  return (
    <svg className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

export function BankradLista({ rader, visaDetaljer = false }: { rader: Bankrad[]; visaDetaljer?: boolean }) {
  return (
    <ul className="mt-2 divide-y divide-slate-100">
      {rader.map((r) => {
        const namn = r.motpart || r.text || '–';
        const detaljer = visaDetaljer ? [
          r.falt.kopdag && r.falt.kopdag !== r.bokforingsdag ? `Köpdag ${datum(r.falt.kopdag)}` : null,
          r.falt.typ ?? null,
          r.motpart && r.text && r.text !== r.motpart ? r.text : null,
          r.falt.ocr ? `OCR ${r.falt.ocr}` : null,
          r.falt.utlandskt_belopp ? formatKr(r.falt.utlandskt_belopp.belopp, r.falt.utlandskt_belopp.valuta) : null,
        ].filter(Boolean) : [];
        return (
          <li key={`${r.kontoHash}:${r.transaktionId}`} className="py-3 flex items-center gap-3">
            <span className="w-14 text-xs text-slate-400 tabular-nums flex-shrink-0">{datum(r.bokforingsdag)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 truncate">{namn}</p>
              {r.koppling && (
                <p className="text-xs text-slate-500 truncate flex items-center"><Ikon slag={r.koppling.slag} />{r.koppling.text}</p>
              )}
              {detaljer.length > 0 && <p className="text-xs text-slate-400 truncate">{detaljer.join(' · ')}</p>}
            </div>
            <Status k={r.koppling} />
            <span className={`w-24 text-right text-sm tabular-nums flex-shrink-0 ${r.beloppOre > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
              {r.beloppOre > 0 ? '+' : ''}{formatKr(r.beloppOre / 100, r.valuta)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
