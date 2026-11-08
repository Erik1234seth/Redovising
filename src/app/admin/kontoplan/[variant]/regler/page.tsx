'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Parameter, RegelmasterRad } from '@/lib/kontering/regelverk';

/**
 * De generella reglerna i en kontoplan (/api/admin/regler): byråns principer
 * (var kontoplan har sina, går att ändra här), gränsvärdena (gemensamma för
 * löpande och bokslut), regelmasterns regler (var kontoplan har sina) — båda
 * laddas ner och importeras här, se @/lib/kontering/regelmaster — och det som
 * skrivits i flödesschemat för alla kunder (bara löpande).
 * Kundspecifika regler hör inte hit.
 */

interface Data {
  principer: { inledning: string; lista: string[]; updatedAt: string | null };
  regelmaster: { kalla: string; updatedAt: string | null; regler: RegelmasterRad[] };
  gransvarden: { kalla: string; updatedAt: string | null; parametrar: Parameter[] };
  flodesschema: { id: string; typ: 'kontext' | 'regel'; steg: string; namn: string | null; galler: string | null; text: string; created_at: string }[];
}

type Slag = 'gransvarden' | 'regler';

const KNAPP = 'text-sm border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-slate-700 hover:border-slate-400';

/** Ladda ner xlsx/JSON och Importera, för gränsvärdena eller reglerna. */
function Filknappar({ href, onFil }: { href: string; onFil: (f: File) => void }) {
  return (
    <>
      <a href={`${href}fil=xlsx`} className={KNAPP}>Ladda ner xlsx</a>
      <a href={`${href}fil=json`} className={KNAPP}>Ladda ner JSON</a>
      <label className={`${KNAPP} cursor-pointer`}>
        Importera
        <input type="file" accept=".xlsx,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFil(f); }} />
      </label>
    </>
  );
}

function parameterVarde(p: Parameter, alla: Map<string, Parameter>) {
  const v = typeof p.varde === 'number' ? p.varde.toLocaleString('sv-SE') : p.varde;
  const bas = p.basParameter ? alla.get(p.basParameter) : null;
  return `${v} ${p.enhet}${bas ? ` (${(p.multiplikator ?? 1).toLocaleString('sv-SE')} × ${bas.namn})` : ''}`;
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
  const [sokVarde, setSokVarde] = useState('');
  const [importFil, setImportFil] = useState<{ slag: Slag; fil: File } | null>(null);

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

  const parametrar = useMemo(() => new Map((data?.gransvarden.parametrar ?? []).map((p) => [p.id, p])), [data]);
  const varden = useMemo(() => {
    const q = sokVarde.trim().toLowerCase();
    return (data?.gransvarden.parametrar ?? []).filter((p) => !q || p.namn.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [data, sokVarde]);

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

      {importFil && <ImportFil variant={variant} slag={importFil.slag} fil={importFil.fil} onStang={() => setImportFil(null)} onKlar={ladda} />}

      <section>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div className="mr-auto">
            <h2 className="font-semibold text-slate-900">Gränsvärden <span className="font-normal text-slate-500">· gemensamma för löpande bokföring och bokslut</span></h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.gransvarden.parametrar.length} värden ur {data.gransvarden.kalla}
              {data.gransvarden.updatedAt ? `, importerade ${DATUM.format(new Date(data.gransvarden.updatedAt))}` : ' (k1.json, utgångsläget)'}.
              En import här gäller båda kontoplanerna. Reglerna nedan räknar med värdena.
            </p>
          </div>
          <Filknappar href="/api/admin/gransvarden?" onFil={(fil) => setImportFil({ slag: 'gransvarden', fil })} />
        </div>
        <input value={sokVarde} onChange={(e) => setSokVarde(e.target.value)} placeholder="Sök värde…"
          className="w-full sm:w-64 mb-3 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
        {!varden.length && <p className="text-sm text-slate-500">Inga värden matchar.</p>}
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {varden.map((p) => (
            <li key={p.id} className="px-4 py-2.5 flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
              <span className="text-sm font-medium text-slate-900">{p.namn}</span>
              <span className="text-sm text-slate-600">{parameterVarde(p, parametrar)}</span>
              <span className="ml-auto text-xs text-slate-400">
                {p.gallerFran || p.gallerTill ? `${p.gallerFran ?? '…'} – ${p.gallerTill ?? 'tills vidare'}` : 'Gäller tills vidare'}
                {p.senastKontrollerad ? ` · kontrollerat ${p.senastKontrollerad}` : ''}
              </span>
              <span className="basis-full text-[11px] font-mono text-slate-400">{p.id}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div className="mr-auto">
            <h2 className="font-semibold text-slate-900">Regelmastern: regler</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.regelmaster.regler.length} regler ur {data.regelmaster.kalla}
              {data.regelmaster.updatedAt ? `, importerade ${DATUM.format(new Date(data.regelmaster.updatedAt))}` : ' (k1.json, utgångsläget)'}.
              Gäller bara {variant === 'lopande' ? 'löpande bokföring' : 'bokslut'}.
              &quot;Prövas i kod&quot; betyder att beloppet jämförs med gränsen innan AI:n svarar. De andra står i kontotexten som AI:n läser.
            </p>
          </div>
          <Filknappar href={`/api/admin/regelmaster?variant=${variant}&`} onFil={(fil) => setImportFil({ slag: 'regler', fil })} />
        </div>
        <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Sök regel eller konto…"
          className="w-full sm:w-64 mb-3 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
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

interface Jamforelse {
  andrade: { id: string; namn: string; falt: string[] }[];
  nya: { id: string; namn: string }[];
  borttagna: { id: string; namn: string }[];
  oforandrade: number;
}
interface ImportPlan {
  regler?: Jamforelse;
  parametrar?: Jamforelse;
  ogiltiga: { id: string; fel: string }[];
  forstaImport: boolean;
  reglerUtanVarde?: { variant: 'lopande' | 'bokslut'; id: string; namn: string; parameterId: string }[];
  iFilen: number;
}

const antalAndringar = (j?: Jamforelse) => (j ? j.andrade.length + j.nya.length + j.borttagna.length : 0);

/**
 * Visar vad filen ändrar och ersätter gränsvärdena (gemensamma) eller
 * kontoplanens regler när man trycker Importera.
 */
function ImportFil({ variant, slag, fil, onStang, onKlar }: {
  variant: 'lopande' | 'bokslut'; slag: Slag; fil: File; onStang: () => void; onKlar: () => void;
}) {
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fel, setFel] = useState('');
  const [sparar, setSparar] = useState(false);
  const [klar, setKlar] = useState(false);
  const skickad = useRef(false);

  const skicka = useCallback(async (spara: boolean) => {
    const form = new FormData();
    form.append('fil', fil);
    form.append('variant', variant);
    if (spara) form.append('spara', '1');
    const d = await (await fetch(slag === 'gransvarden' ? '/api/admin/gransvarden' : '/api/admin/regelmaster', { method: 'POST', body: form })).json();
    if (d.error) throw new Error(d.error);
    return d as ImportPlan;
  }, [fil, variant, slag]);
  useEffect(() => {
    if (skickad.current) return;
    skickad.current = true;
    skicka(false).then(setPlan).catch((err) => setFel(err instanceof Error ? err.message : String(err)));
  }, [skicka]);

  async function importera() {
    setSparar(true);
    setFel('');
    try {
      setPlan(await skicka(true));
      setKlar(true);
      onKlar();
    } catch (err) {
      setFel(err instanceof Error ? err.message : String(err));
    } finally {
      setSparar(false);
    }
  }

  const antal = plan ? antalAndringar(plan.regler) + antalAndringar(plan.parametrar) : 0;
  const galler = slag === 'gransvarden' ? 'löpande bokföring och bokslut' : variant === 'lopande' ? 'löpande bokföring' : 'bokslut';

  const grupp = (rubrik: string, j: Jamforelse) => (
    <div className="space-y-2">
      <p className="font-medium text-slate-900">{rubrik} <span className="font-normal text-slate-500">· {j.oforandrade} oförändrade</span></p>
      {j.nya.length > 0 && (
        <div>
          <p className="text-emerald-700">Nya ({j.nya.length})</p>
          <ul className="mt-0.5 space-y-0.5 text-slate-900">{j.nya.map((x) => <li key={x.id}>{x.namn} <span className="font-mono text-xs text-slate-400">{x.id}</span></li>)}</ul>
        </div>
      )}
      {j.andrade.length > 0 && (
        <div>
          <p className="text-blue-700">Ändrade ({j.andrade.length})</p>
          <ul className="mt-0.5 space-y-0.5 text-slate-900">
            {j.andrade.map((x) => <li key={x.id}>{x.namn} <span className="text-slate-500">— {x.falt.join(', ')}</span></li>)}
          </ul>
        </div>
      )}
      {j.borttagna.length > 0 && (
        <div>
          <p className="text-amber-700">Saknas i filen — slutar gälla ({j.borttagna.length})</p>
          <ul className="mt-0.5 space-y-0.5 text-slate-900">{j.borttagna.map((x) => <li key={x.id}>{x.namn} <span className="font-mono text-xs text-slate-400">{x.id}</span></li>)}</ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onStang}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline gap-3 px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Importera {slag === 'gransvarden' ? 'gränsvärden' : 'regler'} {fil.name}</h2>
          <button onClick={onStang} className="ml-auto text-slate-400 hover:text-slate-700 text-xl leading-none" aria-label="Stäng">×</button>
        </div>
        <div className="px-5 py-4 space-y-5 text-sm">
          {!plan && !fel && <p className="text-slate-500">Läser filen…</p>}
          {plan && (
            <>
              <p className="text-slate-600">
                {plan.iFilen} {slag === 'gransvarden' ? 'värden' : 'regler'} i filen · gäller {galler}
                {klar ? ` · ${antal ? `${antal} ändringar sparade — gäller från nästa kontering` : 'sparad som källa'}` : ''}
              </p>
              {plan.parametrar && grupp('Gränsvärden', plan.parametrar)}
              {plan.regler && grupp('Regler', plan.regler)}
              {!!plan.reglerUtanVarde?.length && (
                <div>
                  <p className="font-medium text-amber-700">Regler som pekar på ett värde som saknas i filen ({plan.reglerUtanVarde.length})</p>
                  <p className="text-xs text-slate-500">De prövas inte längre i kod förrän värdet finns igen eller reglerna importeras utan det.</p>
                  <ul className="mt-0.5 space-y-0.5 text-slate-900">
                    {plan.reglerUtanVarde.map((x) => (
                      <li key={`${x.variant}-${x.id}`}>{x.namn} <span className="text-slate-500">({x.variant === 'lopande' ? 'löpande' : 'bokslut'}) — {x.parameterId}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.ogiltiga.length > 0 && (
                <div>
                  <p className="font-medium text-red-700">Hoppas över ({plan.ogiltiga.length})</p>
                  <ul className="mt-0.5 space-y-0.5 text-slate-900">
                    {plan.ogiltiga.map((x, i) => <li key={i}><span className="font-mono text-xs">{x.id}</span> {x.fel}</li>)}
                  </ul>
                </div>
              )}
              {!antal && !klar && (
                <p className="text-slate-500">
                  {plan.forstaImport ? 'Filen har samma innehåll som utgångsläget (k1.json). Importera för att filen ska stå som källa.' : 'Filen ändrar inget.'}
                </p>
              )}
              <p className="text-xs text-slate-400">
                Filen ersätter {slag === 'gransvarden' ? 'alla gränsvärden' : 'alla regler i kontoplanen'}. Det som saknas i filen slutar gälla men finns kvar under Historik.
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-200">
          {fel && <span className="text-sm text-red-600">{fel}</span>}
          <button onClick={onStang} className="ml-auto text-sm text-slate-600 px-3 py-1.5">{klar ? 'Stäng' : 'Avbryt'}</button>
          {!klar && (
            <button onClick={importera} disabled={sparar || !plan || (!antal && !plan.forstaImport)} className="bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded disabled:opacity-40">
              {sparar ? 'Importerar…' : antal ? `Importera — ${antal} ${antal === 1 ? 'ändring' : 'ändringar'}` : 'Importera'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
