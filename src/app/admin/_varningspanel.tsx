'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdminVarning } from '@/lib/admin-types';

/**
 * Allt som gått fel, överst på översikten. Inget fälls bort och inget kapas:
 * varje varning syns med hela sin text tills felet är åtgärdat. Det enda som
 * går att klicka bort är misslyckade utskick, och de ligger då kvar som
 * hanterade i personkortet.
 */

const DAG = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** Om rutan är utfälld. Hopfälld syns fortfarande antalet per kategori. */
const OPPEN_KEY = 'admin_varningar_oppen';

export function Varningspanel() {
  const [varningar, setVarningar] = useState<AdminVarning[] | null>(null);
  const [fel, setFel] = useState('');
  const [upptagen, setUpptagen] = useState(false);
  const [oppen, setOppen] = useState(false);

  useEffect(() => {
    try { setOppen(localStorage.getItem(OPPEN_KEY) === 'ja'); } catch { /* utan lagring börjar den hopfälld */ }
  }, []);

  const vaxla = () => {
    const ny = !oppen;
    setOppen(ny);
    try { localStorage.setItem(OPPEN_KEY, ny ? 'ja' : 'nej'); } catch { /* bara en bekvämlighet */ }
  };

  const ladda = useCallback(() => {
    fetch('/api/admin/varningar')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setVarningar(d.varningar);
        setFel('');
      })
      .catch((e) => setFel(e instanceof Error ? e.message : 'Kunde inte hämta varningarna'));
  }, []);

  useEffect(() => { ladda(); }, [ladda]);

  const hanterat = async (lista: AdminVarning[]) => {
    const items = lista.filter((v) => v.utskick).map((v) => v.utskick!);
    if (!items.length) return;
    setUpptagen(true);
    try {
      const r = await fetch('/api/admin/people/issues', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      ladda();
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Kunde inte markera som hanterat');
    } finally {
      setUpptagen(false);
    }
  };

  // Att varningarna inte gick att hämta är också en varning — en tom panel
  // får aldrig betyda "vi vet inte"
  if (fel && !varningar) {
    return (
      <section className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-red-800">Varningarna kunde inte hämtas</h2>
        <p className="text-sm text-red-700 mt-1">{fel}</p>
      </section>
    );
  }
  if (!varningar) return <p className="text-sm text-slate-500 mb-6">Hämtar varningar…</p>;
  if (!varningar.length) {
    return (
      <section className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6">
        <p className="text-sm text-emerald-800">Inga varningar — inget har gått fel.</p>
      </section>
    );
  }

  const antalFel = varningar.filter((v) => v.allvar === 'fel').length;
  const kategorier = [...new Set(varningar.map((v) => v.kategori))];

  return (
    <section className={`rounded-xl p-4 mb-6 border-2 ${antalFel ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
      <div className="flex items-center gap-3">
        <button onClick={vaxla} aria-expanded={oppen} className="flex items-center gap-2 text-left min-w-0">
          <svg className={`w-4 h-4 shrink-0 transition-transform ${oppen ? 'rotate-90' : ''} ${antalFel ? 'text-red-700' : 'text-amber-700'}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <h2 className={`text-sm font-semibold ${antalFel ? 'text-red-800' : 'text-amber-800'}`}>
            {antalFel ? `${antalFel} fel` : ''}{antalFel && varningar.length > antalFel ? ' och ' : ''}
            {varningar.length > antalFel ? `${varningar.length - antalFel} ${varningar.length - antalFel === 1 ? 'varning' : 'varningar'}` : ''}
          </h2>
          {!oppen && (
            <span className="text-xs text-slate-600 truncate">
              {kategorier.map((k) => `${k} ${varningar.filter((v) => v.kategori === k).length}`).join(' · ')}
            </span>
          )}
        </button>
        {fel && <span className="text-xs text-red-700">{fel}</span>}
        <button onClick={ladda} className="ml-auto text-xs text-slate-600 hover:text-blue-700 shrink-0">Uppdatera</button>
      </div>

      {oppen && <div className="space-y-4 mt-3">
        {kategorier.map((k) => {
          const rader = varningar.filter((v) => v.kategori === k);
          const utskick = rader.filter((v) => v.utskick);
          return (
            <div key={k}>
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">{k} ({rader.length})</h3>
                {utskick.length > 1 && (
                  <button onClick={() => hanterat(utskick)} disabled={upptagen}
                    className="ml-auto text-xs text-slate-600 hover:text-blue-700 disabled:opacity-40">
                    Markera alla {utskick.length} som hanterade
                  </button>
                )}
              </div>
              <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                {rader.map((v) => (
                  <li key={v.id} className="flex items-start gap-3 px-3 py-2">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${v.allvar === 'fel' ? 'bg-red-500' : 'bg-amber-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{v.titel}</p>
                      {v.detalj && <p className="text-xs text-slate-600 whitespace-pre-line break-words mt-0.5">{v.detalj}</p>}
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {DAG.format(new Date(v.at))}
                        {v.person && (
                          <>
                            {' · '}
                            <Link href={`/admin/person/${encodeURIComponent(v.person)}`} className="text-blue-700 hover:underline">
                              {v.personNamn || v.person}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    {v.utskick && (
                      <button onClick={() => hanterat([v])} disabled={upptagen}
                        className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 shrink-0">
                        Hanterat
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>}
    </section>
  );
}
