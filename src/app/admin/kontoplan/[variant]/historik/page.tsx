'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

/**
 * Allt som ändrats i kontoplanen, nyast först (`kontoplan_historik`): konton,
 * principer och regelmasterns regler och värden (konto null, data.slag 'regel'
 * eller 'parameter'). Klick på en rad visar texten som den var efter
 * ändringen — för något borttaget texten det hade. Konton som är borttagna nu
 * kan tas tillbaka härifrån; regler kommer tillbaka med en ny import.
 */

interface Handelse {
  id: number;
  konto: string | null;
  handling: string;
  data: Record<string, unknown>;
  kalla: string | null;
  created_at: string;
}

const HANDLING: Record<string, { text: string; farg: string }> = {
  sparad: { text: 'Ändrat', farg: 'text-blue-700' },
  importerad: { text: 'Ändrat vid import', farg: 'text-blue-700' },
  tillagd: { text: 'Tillagt', farg: 'text-emerald-700' },
  tillbaka: { text: 'Tillbaka', farg: 'text-emerald-700' },
  aterstalld: { text: 'Återställt till originalet', farg: 'text-slate-600' },
  borttagen: { text: 'Borttaget', farg: 'text-amber-700' },
  principer: { text: 'Principerna ändrade', farg: 'text-violet-700' },
};

const FALT: [string, string][] = [
  ['beskrivning', 'Beskrivning'], ['anvandNar', 'Använd när'], ['anvandInteNar', 'Använd INTE när'],
  ['beslutsregler', 'Beslutsregler'], ['varningar', 'Varningar'], ['exempel', 'Exempel'],
  ['granskningNar', 'Kräver manuell granskning när'], ['nyckelord', 'Sökord'],
];

const REGELFALT: [string, string][] = [
  ['parameterId', 'Värde'], ['operator', 'Jämförelse'], ['omfattning', 'Omfattning'], ['moms', 'Moms'],
  ['gallerFran', 'Gäller från'], ['gallerTill', 'Gäller till'], ['konton', 'Konton'], ['anteckning', 'Anteckning'], ['version', 'Version'],
];
const PARAMETERFALT: [string, string][] = [
  ['varde', 'Värde'], ['enhet', 'Enhet'], ['basParameter', 'Baseras på'], ['multiplikator', 'Multiplikator'],
  ['gallerFran', 'Gäller från'], ['gallerTill', 'Gäller till'], ['typ', 'Typ'], ['senastKontrollerad', 'Kontrollerat'], ['version', 'Version'],
];

/** Vad raden gäller: ett konto, en regel, ett värde eller principerna. */
function rubrik(h: Handelse): string {
  if (h.konto) return `${h.konto} ${String(h.data.namn ?? '')}`;
  if (h.data.slag === 'regel') return `Regel: ${String(h.data.namn ?? h.data.id ?? '')}`;
  if (h.data.slag === 'parameter') return `Värde: ${String(h.data.namn ?? h.data.id ?? '')}`;
  return 'Byråns principer';
}

const TID = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });

export default function Historik() {
  const variant = useParams().variant === 'bokslut' ? 'bokslut' : 'lopande';
  const [historik, setHistorik] = useState<Handelse[] | null>(null);
  const [borttagna, setBorttagna] = useState<Set<string>>(new Set());
  const [fel, setFel] = useState('');
  const [bara, setBara] = useState<'alla' | 'borttagna'>('alla');
  const [sok, setSok] = useState('');
  const [oppen, setOppen] = useState<Handelse | null>(null);

  const ladda = useCallback(() => {
    fetch(`/api/admin/k1-konto?variant=${variant}&historik=1`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setHistorik(d.historik); setBorttagna(new Set(d.borttagna)); })
      .catch((err) => setFel(err instanceof Error ? err.message : String(err)));
  }, [variant]);
  useEffect(() => { ladda(); }, [ladda]);

  const synliga = useMemo(() => {
    const q = sok.trim().toLowerCase();
    const sedda = new Set<string>();
    return (historik ?? []).filter((h) => {
      if (bara === 'borttagna') {
        // Den senaste borttagningen per konto som fortfarande är borttaget
        if (h.handling !== 'borttagen' || !h.konto || !borttagna.has(h.konto) || sedda.has(h.konto)) return false;
        sedda.add(h.konto);
      }
      return !q || (h.konto ?? '').startsWith(q) || rubrik(h).toLowerCase().includes(q) || String(h.data.id ?? '').toLowerCase().includes(q)
        || (h.kalla ?? '').toLowerCase().includes(q);
    });
  }, [historik, borttagna, bara, sok]);

  async function taTillbaka(konto: string) {
    const d = await (await fetch('/api/admin/k1-konto', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant, konto, tillbaka: true }),
    })).json();
    if (d.error) { alert(d.error); return; }
    setOppen(null);
    ladda();
  }

  if (fel) return <p className="text-sm text-red-600">{fel}</p>;
  if (!historik) return <p className="text-sm text-slate-500">Laddar…</p>;

  return (
    <div className="pb-10">
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Sök konto, regel eller fil…"
          className="w-full sm:w-80 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
        {(['alla', 'borttagna'] as const).map((f) => (
          <button key={f} onClick={() => setBara(f)}
            className={`text-sm px-3 py-1 rounded-full ${bara === f ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-600'}`}>
            {f === 'alla' ? 'Allt' : `Borttagna konton (${borttagna.size})`}
          </button>
        ))}
      </div>

      {!synliga.length && (
        <p className="text-sm text-slate-500">{historik.length ? 'Inget matchar.' : 'Inget har ändrats sedan historiken började sparas.'}</p>
      )}

      <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {synliga.map((h) => {
          const typ = HANDLING[h.handling] ?? { text: h.handling, farg: 'text-slate-600' };
          return (
            <li key={h.id}>
              <button onClick={() => setOppen(h)} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
                <span className="text-xs text-slate-400 w-36 shrink-0">{TID.format(new Date(h.created_at))}</span>
                <span className={`text-xs w-40 shrink-0 ${typ.farg}`}>{typ.text}</span>
                <span className="min-w-0 flex-1 text-sm text-slate-900">
                  {h.konto ? <><span className="font-mono">{h.konto}</span> {String(h.data.namn ?? '')}</> : rubrik(h)}
                  {h.konto && borttagna.has(h.konto) && h.handling !== 'borttagen' && <span className="ml-2 text-[11px] text-amber-700">borttaget nu</span>}
                </span>
                {h.kalla && <span className="text-xs text-slate-400 truncate max-w-[14rem]">{h.kalla}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {oppen && <Visa h={oppen} borttagenNu={!!oppen.konto && borttagna.has(oppen.konto)} onTillbaka={taTillbaka} onStang={() => setOppen(null)} />}
    </div>
  );
}

function Visa({ h, borttagenNu, onTillbaka, onStang }: {
  h: Handelse; borttagenNu: boolean; onTillbaka: (konto: string) => void; onStang: () => void;
}) {
  const typ = HANDLING[h.handling]?.text ?? h.handling;
  const lista = (v: unknown) => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onStang}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline gap-3 px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{h.konto ? `Konto ${rubrik(h)}` : rubrik(h)}</h2>
          <span className="text-xs text-slate-500">{typ} {TID.format(new Date(h.created_at))}{h.kalla ? ` · ${h.kalla}` : ''}</span>
          <button onClick={onStang} className="ml-auto text-slate-400 hover:text-slate-700 text-xl leading-none" aria-label="Stäng">×</button>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-slate-800">
          <p className="text-xs text-slate-500">
            {h.handling === 'borttagen' ? 'Texten kontot hade när det togs bort.' : 'Texten efter ändringen.'}
          </p>
          {Array.isArray(h.data.falt) && h.data.falt.length > 0 && (
            <p className="text-xs text-blue-700">Ändrat: {(h.data.falt as string[]).join(', ')}</p>
          )}
          {!h.konto && (h.data.slag === 'regel' || h.data.slag === 'parameter') ? (
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
              <dt className="text-slate-500">Id</dt><dd className="font-mono text-xs pt-0.5">{String(h.data.id ?? '')}</dd>
              {(h.data.slag === 'regel' ? REGELFALT : PARAMETERFALT).map(([f, namn]) => {
                const v = h.data[f];
                if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return null;
                return [<dt key={`${f}-t`} className="text-slate-500">{namn}</dt>, <dd key={f}>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>];
              })}
            </dl>
          ) : h.konto ? FALT.map(([f, rubrik]) => {
            const rader = lista(h.data[f]);
            if (!rader.length) return null;
            return (
              <div key={f}>
                <p className="font-medium text-slate-700">{rubrik}</p>
                {f === 'beskrivning' ? <p>{rader[0]}</p> : (
                  <ul className="list-disc pl-5 space-y-0.5">{rader.map((r, i) => <li key={i}>{r}</li>)}</ul>
                )}
              </div>
            );
          }) : (
            <ol className="list-decimal pl-5 space-y-1">{lista(h.data.principer).map((p, i) => <li key={i}>{p}</li>)}</ol>
          )}
        </div>
        {h.konto && borttagenNu && (
          <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-200">
            <span className="text-sm text-amber-700">Kontot är borttaget ur kontoplanen.</span>
            <button onClick={() => onTillbaka(h.konto!)} className="ml-auto bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded">
              Ta tillbaka kontot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
