'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { RegelmasterRad } from '@/lib/kontering/regelverk';

/**
 * De generella reglerna i en kontoplan (/api/admin/regler): byråns principer
 * (var kontoplan har sina, går att ändra här), regelmasterns gränsvärden (samma
 * för båda) och det som skrivits i flödesschemat för alla kunder (bara löpande).
 * Kundspecifika regler hör inte hit.
 */

interface Data {
  principer: { inledning: string; lista: string[]; updatedAt: string | null };
  regelmaster: { kalla: string; regler: RegelmasterRad[] };
  flodesschema: { id: string; typ: 'kontext' | 'regel'; steg: string; namn: string | null; galler: string | null; text: string; created_at: string }[];
}

const OPERATOR: Record<string, string> = {
  '<': 'under', '<=': 'högst', '>': 'över', '>=': 'minst', equals: 'lika med',
  multiply: 'gånger', deduct: 'avdrag', select: 'väljs', customer_setting: 'kundens val',
};

const DATUM = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium' });

function varde(r: RegelmasterRad) {
  const p = r.parameter;
  if (!p) return r.parameterId;
  const v = typeof p.varde === 'number' ? p.varde.toLocaleString('sv-SE') : p.varde;
  return `${OPERATOR[r.operator] ?? r.operator} ${v} ${p.enhet}`;
}

function period(r: RegelmasterRad) {
  if (!r.gallerFran && !r.gallerTill) return 'Gäller tills vidare';
  if (!r.gallerTill) return `Från ${r.gallerFran}`;
  return `${r.gallerFran ?? '…'} – ${r.gallerTill}`;
}

export default function Regler() {
  const variant = useParams().variant === 'bokslut' ? 'bokslut' : 'lopande';
  const [data, setData] = useState<Data | null>(null);
  const [fel, setFel] = useState('');
  const [sok, setSok] = useState('');

  const ladda = useCallback(() => {
    fetch(`/api/admin/regler?variant=${variant}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((err) => setFel(err instanceof Error ? err.message : String(err)));
  }, [variant]);
  useEffect(() => { ladda(); }, [ladda]);

  const regler = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return (data?.regelmaster.regler ?? []).filter((r) => !q
      || r.namn.toLowerCase().includes(q)
      || r.konton.some((k) => k.startsWith(q))
      || r.anteckning.toLowerCase().includes(q));
  }, [data, sok]);

  if (fel) return <p className="text-sm text-red-600">{fel}</p>;
  if (!data) return <p className="text-sm text-slate-500">Laddar…</p>;

  return (
    <div className="space-y-8 pb-10">
      <p className="text-xs text-slate-500">
        Reglerna här gäller alla kunder. Kundspecifika regler, som periodisk sammanställning, väljs per transaktion
        och skrivs i flödesschemat. De visas inte här.
      </p>

      <Principer variant={variant} principer={data.principer} onSparad={ladda} />

      {variant === 'lopande' && <section>
        <h2 className="font-semibold text-slate-900">Skrivet i flödesschemat för alla kunder</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">
          Regler och kontext som byrån lagt till på ett steg med omfånget &quot;alla kunder&quot;.
        </p>
        {data.flodesschema.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-3">Inga just nu.</p>
        ) : (
          <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {data.flodesschema.map((i) => (
              <li key={i.id} className="px-4 py-3 text-sm text-slate-800">
                <p className="text-xs text-slate-500">
                  {i.typ === 'regel' ? 'Regel' : 'Kontext'} · skriven på {i.steg} · {DATUM.format(new Date(i.created_at))}
                </p>
                {i.namn && <p className="font-medium text-slate-900">{i.namn}</p>}
                {i.galler && <p><span className="text-slate-500">Gäller när:</span> {i.galler}</p>}
                <p>{i.typ === 'regel' && <span className="text-slate-500">Gör så här: </span>}{i.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>}

      <section>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div className="mr-auto">
            <h2 className="font-semibold text-slate-900">Regelmastern: gränsvärden och regler</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.regelmaster.regler.length} regler ur {data.regelmaster.kalla} (k1.json), samma för löpande bokföring och bokslut.
              &quot;Prövas i kod&quot; betyder att beloppet jämförs med gränsen innan AI:n svarar. De andra står i kontotexten som AI:n läser.
            </p>
          </div>
          <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Sök regel eller konto…"
            className="w-full sm:w-64 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
        </div>
        {!regler.length && <p className="text-sm text-slate-500">Inga regler matchar.</p>}
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {regler.map((r) => (
            <li key={r.id}>
              <details className="group">
                <summary className="px-4 py-2.5 cursor-pointer hover:bg-slate-50 flex flex-wrap gap-x-3 gap-y-0.5 items-baseline list-none">
                  <span className="text-sm font-medium text-slate-900">{r.namn}</span>
                  <span className="text-sm text-slate-600">{varde(r)}</span>
                  {r.provasIKod && <span className="text-[11px] text-emerald-700">prövas i kod</span>}
                  <span className="ml-auto text-xs text-slate-400">{period(r)}</span>
                </summary>
                <dl className="px-4 pb-3 pt-1 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
                  {r.parameter && (<><dt className="text-slate-500">Värde</dt><dd className="text-slate-800">{r.parameter.namn}{r.parameter.senastKontrollerad ? ` · kontrollerat ${r.parameter.senastKontrollerad}` : ''}</dd></>)}
                  {r.omfattning && (<><dt className="text-slate-500">Omfattning</dt><dd className="text-slate-800">{r.omfattning}</dd></>)}
                  {r.moms && (<><dt className="text-slate-500">Moms</dt><dd className="text-slate-800">{r.moms}</dd></>)}
                  {r.anteckning && (<><dt className="text-slate-500">Anteckning</dt><dd className="text-slate-800">{r.anteckning}</dd></>)}
                  <dt className="text-slate-500">Konton</dt>
                  <dd className="text-slate-800 font-mono text-xs pt-0.5">{r.konton.length ? r.konton.join(', ') : '—'}</dd>
                  <dt className="text-slate-500">Id</dt>
                  <dd className="text-slate-400 font-mono text-xs pt-0.5">{r.id}</dd>
                </dl>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Byråns principer i kontoplanen. "Ändra" gör listan redigerbar: en ruta per princip. */
function Principer({ variant, principer, onSparad }: {
  variant: 'lopande' | 'bokslut';
  principer: Data['principer'];
  onSparad: () => void;
}) {
  const [utkast, setUtkast] = useState<string[] | null>(null);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState('');

  async function spara() {
    if (!utkast) return;
    setSparar(true);
    setFel('');
    try {
      const d = await (await fetch('/api/admin/regler', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant, principer: utkast }),
      })).json();
      if (d.error) throw new Error(d.error);
      setUtkast(null);
      onSparad();
    } catch (err) {
      setFel(err instanceof Error ? err.message : String(err));
    } finally {
      setSparar(false);
    }
  }

  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="font-semibold text-slate-900">Byråns principer</h2>
        {!utkast && (
          <button onClick={() => setUtkast([...principer.lista])} className="ml-auto text-sm text-blue-700 hover:underline">Ändra</button>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">
        {variant === 'lopande' ? 'Konterings-AI:n läser dem alltid, från nästa kontering. ' : ''}
        {principer.inledning}
        {principer.updatedAt ? ` Senast ändrade ${DATUM.format(new Date(principer.updatedAt))}.` : ''}
      </p>
      {!utkast ? (
        <ol className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {principer.lista.map((p, i) => (
            <li key={i} className="px-4 py-3 flex gap-3 text-sm text-slate-800">
              <span className="font-mono text-slate-400 w-5 shrink-0">{i + 1}.</span>
              <span>{p}</span>
            </li>
          ))}
          {!principer.lista.length && <li className="px-4 py-3 text-sm text-slate-500">Inga principer.</li>}
        </ol>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          {utkast.map((p, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="font-mono text-sm text-slate-400 w-5 shrink-0 pt-1.5">{i + 1}.</span>
              <textarea value={p} rows={3} onChange={(e) => setUtkast((u) => u!.map((x, j) => (j === i ? e.target.value : x)))}
                className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-900 bg-white" />
              <button onClick={() => setUtkast((u) => u!.filter((_, j) => j !== i))}
                className="text-sm text-slate-400 hover:text-red-600 pt-1.5" title="Ta bort principen">Ta bort</button>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={() => setUtkast((u) => [...u!, ''])} className="text-sm text-blue-700 hover:underline">+ Lägg till princip</button>
            {fel && <span className="text-sm text-red-600">{fel}</span>}
            <button onClick={() => { setUtkast(null); setFel(''); }} className="ml-auto text-sm text-slate-600 px-3 py-1.5">Avbryt</button>
            <button onClick={spara} disabled={sparar} className="bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded disabled:opacity-40">
              {sparar ? 'Sparar…' : 'Spara principerna'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
