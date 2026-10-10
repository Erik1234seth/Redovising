'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AdminMote, Arende, InkorgKonversation, InlamningKund, Person } from '@/lib/admin-types';

/**
 * Översikten: det som kräver handling idag, på en sida.
 *
 * Varje del hämtas från samma route som sidan den länkar till, så siffrorna
 * här är alltid desamma som där. En del som inte går att hämta visar ett
 * streck i stället för att stoppa resten.
 */

const idag = () => new Date().toLocaleDateString('sv-SE');
const DAG = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const datum = (d: string) => DAG.format(new Date(`${d}T00:00:00Z`));
const LANG = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

interface Data {
  inkorg: InkorgKonversation[] | null;
  arenden: Arende[] | null;
  moten: AdminMote[] | null;
  moms: InlamningKund[] | null;
  ne: InlamningKund[] | null;
  saknarOmbud: { profileId: string; namn: string; email: string | null; sedan: string }[] | null;
  personer: Person[] | null;
}

const hamta = <T,>(url: string, valj: (d: Record<string, unknown>) => T): Promise<T | null> =>
  fetch(url).then((r) => r.json()).then((d) => (d.error ? null : valj(d))).catch(() => null);

export default function OversiktPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    Promise.all([
      hamta('/api/admin/inkorg', (d) => d.konversationer as InkorgKonversation[]),
      hamta('/api/admin/arenden', (d) => d as { arenden: Arende[]; moten: AdminMote[] }),
      hamta('/api/admin/inlamning?typ=moms', (d) => d.kunder as InlamningKund[]),
      hamta('/api/admin/inlamning?typ=ne', (d) => d.kunder as InlamningKund[]),
      hamta('/api/admin/oversikt', (d) => d.saknarOmbud as Data['saknarOmbud']),
      hamta('/api/admin/people', (d) => d.people as Person[]),
    ]).then(([inkorg, a, moms, ne, saknarOmbud, personer]) => setData({
      inkorg, arenden: a?.arenden ?? null, moten: a?.moten ?? null, moms, ne, saknarOmbud, personer,
    }));
  }, []);

  const d = idag();
  const imorgon = new Date(Date.now() + 86_400_000).toLocaleDateString('sv-SE');

  const s = useMemo(() => {
    if (!data) return null;
    const oppna = (data.arenden ?? []).filter((a) => a.status === 'oppen');
    const forsenade = oppna.filter((a) => a.datum && a.datum < d);
    const iDag = oppna.filter((a) => a.datum === d);
    const utkast = (data.inkorg ?? []).filter((k) => k.utkast > 0);
    const olasta = (data.inkorg ?? []).filter((k) => k.olast);

    // Deadlines: en rad per datum och typ, med hur många som är kvar
    const deadlines = new Map<string, { datum: string; typ: string; perioder: Set<string>; kvar: number; totalt: number; forsenad: boolean }>();
    for (const [typ, kunder] of [['Moms', data.moms], ['NE', data.ne]] as const) {
      for (const k of kunder ?? []) for (const p of k.perioder) {
        const nyckel = `${p.deadline}|${typ}`;
        const rad = deadlines.get(nyckel) ?? { datum: p.deadline, typ, perioder: new Set(), kvar: 0, totalt: 0, forsenad: false };
        rad.perioder.add(p.label);
        rad.totalt++;
        if (!p.inlamning) rad.kvar++;
        if (p.forsenad && !p.inlamning) rad.forsenad = true;
        deadlines.set(nyckel, rad);
      }
    }
    const deadlineLista = [...deadlines.values()].sort((a, b) => a.datum.localeCompare(b.datum));
    const kvarAttLamna = deadlineLista.reduce((n, r) => n + r.kvar, 0);

    const vecka = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const nyaLeads = (data.personer ?? [])
      .filter((p) => !p.isCustomer && p.firstSeen && p.firstSeen >= vecka)
      .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));

    const motenSnart = (data.moten ?? []).filter((m) => m.datum === d || m.datum === imorgon);

    return { forsenade, iDag, utkast, olasta, deadlineLista, kvarAttLamna, nyaLeads, motenSnart };
  }, [data, d, imorgon]);

  const kort = (titel: string, varde: number | null | undefined, href: string, ton: 'bla' | 'rod' | 'amber' | 'gron' | 'gra', under?: string) => (
    <Link href={href} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition">
      <p className="text-xs font-medium text-slate-500">{titel}</p>
      <p className={`text-3xl font-bold mt-1 tabular-nums ${
        !varde ? 'text-slate-300' : ton === 'rod' ? 'text-red-600' : ton === 'amber' ? 'text-amber-600' : ton === 'gron' ? 'text-emerald-600' : ton === 'bla' ? 'text-blue-700' : 'text-slate-900'}`}>
        {varde ?? '–'}
      </p>
      {under && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{under}</p>}
    </Link>
  );

  const rubrik = 'text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2';
  const panel = 'bg-white border border-slate-200 rounded-xl p-4';
  const tom = (text: string) => <p className="text-sm text-slate-400">{text}</p>;

  return (
    <div>
      <div className="flex items-end gap-3 mb-6">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold text-slate-900">Översikt</h1>
          <p className="text-sm text-slate-500 first-letter:uppercase">{LANG.format(new Date())}</p>
        </div>
        <Link href="/admin/personer" className="text-sm text-slate-600 hover:text-blue-700">Alla personer</Link>
        <Link href="/admin/status" className="text-sm text-slate-600 hover:text-blue-700">Systemstatus</Link>
      </div>

      {!s ? <p className="text-slate-500 text-sm">Hämtar…</p> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {kort('Olästa i inkorgen', data?.inkorg ? s.olasta.length : null, '/admin/inkorg', 'bla')}
            {kort('Utkast att skicka', data?.inkorg ? s.utkast.length : null, '/admin/inkorg', 'amber')}
            {kort('Ärenden idag', data?.arenden ? s.iDag.length + s.forsenade.length : null, '/admin/arenden', s.forsenade.length ? 'rod' : 'gra',
              s.forsenade.length ? `varav ${s.forsenade.length} försenade` : undefined)}
            {kort('Kvar att lämna in', data?.moms ? s.kvarAttLamna : null, '/admin/inlamning', s.deadlineLista.some((r) => r.forsenad) ? 'rod' : 'gra',
              s.deadlineLista.find((r) => r.kvar) ? `nästa ${datum(s.deadlineLista.find((r) => r.kvar)!.datum)}` : undefined)}
            {kort('Nya leads, 7 dagar', data?.personer ? s.nyaLeads.length : null, '/admin/personer', 'gron')}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <section className={panel}>
                <h2 className={rubrik}>Utkast som väntar</h2>
                {!s.utkast.length ? tom('Inga utkast — allt är besvarat.') : (
                  <ul className="divide-y divide-slate-100">
                    {s.utkast.slice(0, 8).map((k) => (
                      <li key={k.key}>
                        <Link href={`/admin/inkorg?key=${encodeURIComponent(k.key)}`} className="flex items-center gap-2 py-2 hover:text-blue-700">
                          <span className="text-sm font-medium text-slate-900 truncate mr-auto">{k.namn}</span>
                          <span className="text-xs text-slate-500 truncate max-w-[50%]">{k.senaste.text}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {s.utkast.length > 8 && <Link href="/admin/inkorg" className="text-xs text-blue-700 hover:underline">+ {s.utkast.length - 8} till</Link>}
              </section>

              <section className={panel}>
                <h2 className={rubrik}>Ärenden idag</h2>
                {!s.forsenade.length && !s.iDag.length ? tom('Inget att göra idag.') : (
                  <ul className="space-y-1.5">
                    {[...s.forsenade, ...s.iDag].map((a) => (
                      <li key={a.id} className="flex items-start gap-2">
                        <span className={`text-[11px] tabular-nums shrink-0 mt-0.5 ${a.datum && a.datum < d ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                          {a.datum && a.datum < d ? datum(a.datum) : 'idag'}
                        </span>
                        <span className="text-sm text-slate-900 mr-auto">{a.titel}</span>
                        {a.personKey && (
                          <Link href={`/admin/person/${encodeURIComponent(a.personKey)}`} className="text-xs text-blue-700 hover:underline shrink-0">
                            {a.personNamn || a.personKey}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/admin/arenden" className="text-xs text-blue-700 hover:underline mt-2 inline-block">Alla ärenden →</Link>
              </section>

              {s.motenSnart.length > 0 && (
                <section className={panel}>
                  <h2 className={rubrik}>Möten idag och imorgon</h2>
                  <ul className="space-y-1.5">
                    {s.motenSnart.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-slate-500 w-16 shrink-0">{m.datum === d ? 'idag' : 'imorgon'} {m.tid}</span>
                        {m.email
                          ? <Link href={`/admin/person/${encodeURIComponent(m.email)}`} className="text-slate-900 hover:text-blue-700 hover:underline">{m.namn}</Link>
                          : <span className="text-slate-900">{m.namn}</span>}
                        {m.meddelande && <span className="text-xs text-slate-500 truncate">{m.meddelande}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="space-y-4">
              <section className={panel}>
                <h2 className={rubrik}>Nästa deadlines</h2>
                {!s.deadlineLista.length ? tom('Ingen avslutad period att lämna in just nu.') : (
                  <ul className="space-y-1.5">
                    {s.deadlineLista.slice(0, 6).map((r) => (
                      <li key={`${r.datum}|${r.typ}`}>
                        <Link href="/admin/inlamning" className="flex items-center gap-3 hover:text-blue-700">
                          <span className={`text-xs w-20 shrink-0 ${r.forsenad ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{datum(r.datum)}</span>
                          <span className="text-sm text-slate-900 mr-auto">{r.typ} · {[...r.perioder].join(', ')}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.kvar ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {r.kvar ? `${r.kvar} av ${r.totalt} kvar` : 'klart ✓'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/admin/kalender" className="text-xs text-blue-700 hover:underline mt-2 inline-block">Kalendern →</Link>
              </section>

              <section className={panel}>
                <h2 className={rubrik}>Väntar på ombudsuppgifter {data?.saknarOmbud ? `(${data.saknarOmbud.length})` : ''}</h2>
                {!data?.saknarOmbud?.length ? tom('Alla kunder har sina uppgifter inlagda.') : (
                  <ul className="flex flex-wrap gap-1.5">
                    {data.saknarOmbud.map((k) => (
                      <li key={k.profileId}>
                        <Link href={`/admin/inkorg?key=${encodeURIComponent(k.email ?? k.profileId)}`}
                          className="inline-block text-xs px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100">
                          {k.namn}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={panel}>
                <h2 className={rubrik}>Nya leads senaste veckan</h2>
                {!s.nyaLeads.length ? tom('Inga nya leads.') : (
                  <ul className="divide-y divide-slate-100">
                    {s.nyaLeads.slice(0, 8).map((p) => (
                      <li key={p.key}>
                        <Link href={`/admin/person/${encodeURIComponent(p.email || p.phone || p.key)}`} className="flex items-center gap-2 py-1.5 hover:text-blue-700">
                          <span className="text-sm text-slate-900 truncate mr-auto">{p.name || p.email || p.phone}</span>
                          {p.source && <span className="text-[11px] text-slate-500">{p.source}</span>}
                          <span className="text-[11px] text-slate-400 w-14 text-right">{datum(p.firstSeen.slice(0, 10))}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {s.nyaLeads.length > 8 && <Link href="/admin/personer" className="text-xs text-blue-700 hover:underline">+ {s.nyaLeads.length - 8} till</Link>}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
