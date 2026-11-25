// TESTFLÖDE — kopia av admin/flode/page.tsx. Samma kunder, men körningarna sparas i test_-tabellerna.
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TestFlode } from '../_testflode';
import { RAKNA_OM } from '../_nav-menu';
import { KundKontext } from '../flode/_kundkontext';
import type { FlodeKund } from '@/lib/admin-types';

/**
 * Flöde — huvudarbetet: läsa, kontrollera och kontera kundernas underlag.
 *
 * Låg som en flik i personkortet till 2026-11-22. Här väljer man kund i
 * listan till vänster, och de som har nya underlag (aldrig körda, eller där
 * kunden svarat sedan senaste körningen) står först. Vald kund ligger i
 * adressen som ?kund=<profil-id>, så att en länk hit kan peka på en kund.
 *
 * Kundlistan går att fälla ihop. Då får Flöde mer plats och kundkontexten
 * (verksamhet, metod, moms, senaste händelser) visas till höger i stället.
 * Valet sparas i webbläsaren.
 */

const LISTA_NYCKEL = 'testflode-kundlista';

const DATUM = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });

function FlodeSida() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const valdId = params.get('kund');

  const [kunder, setKunder] = useState<FlodeKund[] | null>(null);
  const [fel, setFel] = useState('');
  const [sok, setSok] = useState('');
  const [listaOppen, setListaOppenState] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem(LISTA_NYCKEL) === 'stangd') setListaOppenState(false); } catch { /* utan lagring: öppen */ }
  }, []);
  const setListaOppen = (oppen: boolean) => {
    setListaOppenState(oppen);
    try { localStorage.setItem(LISTA_NYCKEL, oppen ? 'oppen' : 'stangd'); } catch { /* bara för den här gången */ }
  };

  const ladda = useCallback(() => {
    fetch('/api/admin/testflode/kunder').then((r) => r.json()).then((d) => {
      if (d.error) setFel(d.error);
      else { setFel(''); setKunder(d.kunder); }
    }).catch(() => setFel('Kunde inte hämta kunderna'));
  }, []);

  useEffect(() => { ladda(); }, [ladda]);
  // Siffrorna ändras när en körning är klar — räkna om då och då, och när fönstret får fokus
  useEffect(() => {
    const t = setInterval(ladda, 60_000);
    window.addEventListener('focus', ladda);
    window.addEventListener(RAKNA_OM, ladda);
    return () => { clearInterval(t); window.removeEventListener('focus', ladda); window.removeEventListener(RAKNA_OM, ladda); };
  }, [ladda]);

  const valj = (id: string) => router.replace(`${pathname}?kund=${encodeURIComponent(id)}`, { scroll: false });

  const synliga = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return (kunder ?? []).filter((k) => !q || k.namn.toLowerCase().includes(q) || k.epost?.includes(q));
  }, [kunder, sok]);

  const vald = kunder?.find((k) => k.userId === valdId) ?? null;
  const medNya = (kunder ?? []).filter((k) => k.nya > 0).length;

  return (
    <div className="flex gap-6 items-start">
      {listaOppen && (
      <aside className="w-64 shrink-0 sticky top-20">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-slate-900 mr-auto">Testflöde</h1>
          <button onClick={() => setListaOppen(false)} title="Fäll ihop kundlistan och visa kundkontexten"
            className="text-slate-400 hover:text-slate-800 hover:bg-white rounded-lg px-2 py-1 text-sm">«</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          {kunder ? (medNya ? `${medNya} ${medNya === 1 ? 'kund' : 'kunder'} med nya underlag` : 'Inga nya underlag') : ' '}
        </p>
        <input
          value={sok}
          onChange={(e) => setSok(e.target.value)}
          placeholder="Sök kund"
          className="w-full mb-2 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {fel && <p className="text-sm text-red-600 mb-2">{fel}</p>}
        {!kunder && !fel && <p className="text-sm text-slate-400">Hämtar…</p>}
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[calc(100vh-14rem)] overflow-y-auto">
          {synliga.map((k) => (
            <li key={k.userId}>
              <button
                type="button"
                onClick={() => valj(k.userId)}
                className={`w-full text-left px-3 py-2.5 transition ${k.userId === valdId ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm truncate mr-auto ${k.userId === valdId ? 'text-blue-800 font-medium' : 'text-slate-900'}`}>{k.namn}</span>
                  {k.nya > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold leading-5 text-center tabular-nums" title="Nya underlag att köra">
                      {k.nya}
                    </span>
                  )}
                  {k.granska > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold leading-5 text-center tabular-nums" title="Transaktioner att granska">
                      {k.granska}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {k.underlag} underlag · senast {DATUM.format(new Date(k.senast))}
                </div>
              </button>
            </li>
          ))}
          {kunder && !synliga.length && <li className="px-3 py-3 text-sm text-slate-400">Inga kunder</li>}
        </ul>
      </aside>
      )}

      <section className="flex-1 min-w-0">
        {vald ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              {!listaOppen && (
                <button onClick={() => setListaOppen(true)} title="Visa kundlistan"
                  className="flex items-center gap-1.5 border border-slate-300 bg-white hover:border-slate-400 text-slate-700 text-xs font-medium rounded-lg px-2.5 py-1.5 shrink-0">
                  » Kunder{medNya > 0 && <span className="rounded-full bg-blue-600 text-white text-[10px] px-1.5 tabular-nums">{medNya}</span>}
                </button>
              )}
              <h2 className="text-xl font-semibold text-slate-900 truncate">{vald.namn}</h2>
              {vald.key && (
                <Link href={`/admin/person/${encodeURIComponent(vald.key)}`} className="text-sm text-blue-700 hover:underline">
                  Personkort →
                </Link>
              )}
            </div>
            <TestFlode key={vald.userId} userId={vald.userId} />
          </>
        ) : !listaOppen ? (
          <button onClick={() => setListaOppen(true)} className="w-full bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-sm text-blue-700 hover:border-slate-400">
            Visa kundlistan och välj en kund
          </button>
        ) : (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-sm text-slate-500">
            {valdId && kunder ? 'Kunden har inga underlag.' : 'Välj en kund i listan.'}
          </div>
        )}
      </section>

      {!listaOppen && vald?.key && (
        <aside className="w-80 shrink-0 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <KundKontext personKey={vald.key} />
        </aside>
      )}
    </div>
  );
}

export default function FlodePage() {
  return <Suspense fallback={null}><FlodeSida /></Suspense>;
}
