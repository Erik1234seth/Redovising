'use client';

import { Fragment, useState } from 'react';
import type { FlodesKund, FlodesUnderlag } from '@/lib/admin-types';
import { momsText } from '@/lib/kontering/momsdelar';

/**
 * Kör om kundens alla underlag, och resultatet per fil och transaktion.
 *
 * Alla kundens filer med transaktioner körs om — också de bokförda. Ordningen:
 *
 *   1. Kundbilden byggs om, en gång.
 *   2. Dublettcheck fil för fil, äldst först. Den jämför med tidigare filer,
 *      och två filer som kontrolleras samtidigt kan se varandra i ett mellanläge.
 *   3. Tre filer åt gången: Komplettera, Tillräckligt? och Konteras. En
 *      bokförd transaktion vars kontering ändrats får sin verifikation ersatt
 *      (se `@/lib/kontering/ersatt`).
 *   4. Frågemejlet, en gång för kunden, när ett oskickat utkast finns —
 *      annars tar dygnsmejlet kl 18 det. Två filer som skriver det samtidigt
 *      skulle ge två utkast.
 *   5. Helhetskontrollen, en gång.
 *
 * Läget före körningen sparas här i webbläsaren, så att resultatet kan visa
 * vad som ändrats.
 */

const FILER_SAMTIDIGT = 3;

type Trans = FlodesUnderlag['transaktioner'][number];
type Forslag = Trans['forslag'][number];

interface Fil {
  id: string;
  fileName: string;
  at: string;
  lage: 'vantar' | 'kor' | 'klar' | 'fel' | 'hoppas';
  steg: string;
  fel: string;
  tider: { steg: string; s: number }[];
  ersatta: number;
  inlamnade: number;
  fore: Map<string, string>;
  u: FlodesUnderlag | null;
}

const MODELL: Record<string, string> = { 'gpt-6-astra': 'GPT-6 Astra', 'claude-opus-5-5': 'Claude Opus 5.5' };
const PRICK: Record<string, string> = { gron: 'bg-emerald-500', gul: 'bg-amber-400', rod: 'bg-red-500' };
const STEGNAMN: Record<string, string> = {
  kundbild: 'Kundbild', dublett: 'Dublettcheck', komplettera: 'Komplettera', tillrackligt: 'Tillräckligt?',
  konteras: 'Konteras', 'skriv-mejl': 'Skriv mail', helhet: 'Helhetskontroll',
};
const kr = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Transaktionens läge i en rad, för att jämföra före och efter. */
function lageFor(t: Trans): string {
  if (t.dublettAv || t.dublettkoll?.status === 'dublett') return 'Dubblett';
  if (t.tillrackligt?.status === 'saknar') return 'Saknar uppgifter';
  const moms = (f: { momssats: number; momsdelar: Forslag['momsdelar'] }) => momsText(f.momssats, f.momsdelar);
  if (t.bokford && t.verifikation) {
    const konton = t.verifikation.rader.map((r) => r.konto).filter((k) => !['1930', '2013', '2017', '2641', '2611', '2621', '2631'].includes(k));
    return `${[...new Set(konton)].join(' + ') || '—'} (bokförd)`;
  }
  if (t.vald) return `${t.vald.konto} ${moms(t.vald)} (byrån)`;
  if (t.kontering === 'gron') return `${t.forslag[0]?.konto ?? '—'} ${moms(t.forslag[0])} (grön)`;
  if (t.kontering === 'granska') return `Granska: ${t.forslag.map((f) => f.konto ?? '—').join(' / ')}`;
  return 'Inte konterad';
}

export function Resonemang({ g }: { g: Forslag['granskning'] }) {
  if (!g) return null;
  const j = g.jamkning;
  return (
    <>
      {j && (
        <p className="text-xs leading-relaxed text-slate-500">
          <span className="text-slate-600">Jämkning:</span>{' '}
          {j.andradeSig
            ? <>ändrade sig från <span className="tabular-nums">{j.fore.konto ?? '—'}</span> (moms {momsText(j.fore.momssats ?? 0, j.fore.momsdelar)}) efter att ha sett den andra modellens förslag.</>
            : 'stod fast vid sitt förslag efter att ha sett den andra modellens.'}
        </p>
      )}
      {(g.analys || g.kandidater?.length) && (
        <details className="text-xs">
          <summary className="text-slate-500 cursor-pointer">Analys och kandidatkonton</summary>
          {g.analys && <p className="mt-1 text-slate-600 leading-relaxed">{g.analys}</p>}
          {!!g.kandidater?.length && (
            <ul className="mt-1 space-y-0.5">
              {g.kandidater.map((k) => (
                <li key={k.konto} className="text-slate-600"><span className="tabular-nums font-semibold">{k.konto}</span> {k.namn}{k.varfor ? <span className="text-slate-500"> — {k.varfor}</span> : null}</li>
              ))}
            </ul>
          )}
          {j && <p className="mt-1 text-slate-500 leading-relaxed"><span className="text-slate-600">Före jämkningen:</span> {j.fore.motivering}</p>}
        </details>
      )}
    </>
  );
}

/** En modells kontering: konto, moms, motivering, regler, flaggor och hur den kom fram. */
export function ForslagKort({ f }: { f: Forslag }) {
  const g = f.granskning;
  const byttFran = g?.forstaKonto && g.forstaKonto !== f.konto ? g.forstaKonto : null;
  const flaggor = f.flaggor.filter((x) => x.typ !== 'granskning');
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${PRICK[f.omdome] ?? 'bg-slate-300'}`} />
        <span className="text-slate-600 text-xs font-semibold">{MODELL[f.modell] ?? f.modell}</span>
      </div>
      <p className="text-slate-900 text-sm">
        <span className="tabular-nums font-semibold">{f.konto ?? '—'}</span> {f.kontonamn}
        <span className="text-slate-500"> · moms {momsText(f.momssats, f.momsdelar)}</span>
        {byttFran && <span className="text-slate-400 text-xs"> (bytt från {byttFran} i {g?.jamkning ? 'jämkningen' : 'granskningen'})</span>}
      </p>
      {g?.sakerhet && g.sakerhet !== 'hog' && <p className="text-xs text-slate-500">Säkerhet: {g.sakerhet === 'lag' ? 'låg' : 'medel'}</p>}
      {f.regler.length > 0 && <p className="text-violet-700 text-xs">Kundregel: {f.regler.join(', ')}</p>}
      <p className="text-slate-600 text-xs leading-relaxed">{f.motivering}</p>
      {g?.motivering && <p className="text-slate-500 text-xs leading-relaxed"><span className="text-slate-600">Granskning:</span> {g.motivering}</p>}
      <Resonemang g={g} />
      {flaggor.length > 0 && (
        <ul className="space-y-0.5">
          {flaggor.map((x, n) => (
            <li key={n} className={`text-xs ${x.allvar === 'stopp' ? 'text-red-600' : 'text-amber-700'}`}>• {x.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Öppnar originalfilen i en ny flik, utan att raden fälls ut. */
function FilLank({ id, namn }: { id: string; namn: string }) {
  return (
    <a
      href={`/api/admin/underlag/${id}/ladda-ner?visa`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Öppna ${namn} i en ny flik`}
      className="text-blue-700 hover:underline"
    >
      {namn}
    </a>
  );
}

async function post(id: string, steg: string, extra: Record<string, unknown> = {}) {
  const d = await fetch('/api/admin/flodesschema/underlag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, steg, ...extra }),
  }).then((r) => r.json()).catch(() => ({ error: 'Kunde inte nå servern' }));
  if (d.error) throw new Error(d.error);
  return d as { underlag?: FlodesUnderlag; kvar?: number; ersatt?: { ersatta: number; oforandrade: number; inlamnade: number } };
}

async function hamta(id: string): Promise<FlodesUnderlag | null> {
  const d = await fetch(`/api/admin/flodesschema/underlag?id=${encodeURIComponent(id)}`).then((r) => r.json()).catch(() => null);
  return d?.underlag ?? null;
}

export function KorOmAlla({ kund, onFolj, onKlar }: {
  kund: FlodesKund;
  /** Följ filen i schemat. */
  onFolj: (id: string) => void;
  onKlar: () => void;
}) {
  const [filer, setFiler] = useState<Fil[] | null>(null);
  const [kor, setKor] = useState(false);
  const [text, setText] = useState('');
  const [fel, setFel] = useState('');
  const [kundTider, setKundTider] = useState<{ steg: string; s: number }[]>([]);
  const [helhet, setHelhet] = useState<FlodesUnderlag['helhet']>(null);
  const [oppen, setOppen] = useState<string | null>(null);
  const [oppenTrans, setOppenTrans] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [slut, setSlut] = useState<number | null>(null);

  const uppdatera = (id: string, andring: Partial<Fil> | ((f: Fil) => Partial<Fil>)) =>
    setFiler((lista) => lista?.map((f) => (f.id === id ? { ...f, ...(typeof andring === 'function' ? andring(f) : andring) } : f)) ?? null);

  const korOm = async () => {
    if (!window.confirm(`Köra om alla ${kund.namn}s underlag? Alla AI-steg körs från Komplettera, också för bokförda transaktioner — en verifikation som ändrats ersätts, utom i inlämnade perioder. Ett konto du valt i Granska ersätts av den nya konteringen.`)) return;
    setKor(true);
    setFel('');
    setHelhet(null);
    setKundTider([]);
    setOppen(null);
    setStart(Date.now());
    setSlut(null);
    try {
      // Filerna med transaktioner, äldst först. Övriga filer och sidor som läses med en annan hoppas över.
      setText('Hämtar kundens underlag…');
      const kandidater = kund.underlag.filter((u) => u.sortering !== 'ovrigt').sort((a, b) => a.at.localeCompare(b.at));
      const hamtade = await Promise.all(kandidater.map(async (k) => ({ k, u: await hamta(k.id) })));
      const lista: Fil[] = hamtade
        .filter(({ u }) => u && !u.sidor?.huvudId && u.definition?.kategori !== 'verifikationer' && u.definition?.kategori !== 'ovrigt' && u.transaktioner.length > 0)
        .map(({ k, u }) => ({
          id: k.id, fileName: k.fileName, at: k.at, lage: 'vantar', steg: '', fel: '', tider: [], ersatta: 0, inlamnade: 0,
          fore: new Map(u!.transaktioner.map((t) => [t.id, lageFor(t)])), u,
        }));
      setFiler(lista);
      if (!lista.length) { setFel('Kunden har inga underlag med transaktioner att köra om.'); return; }

      const tidta = async <T,>(steg: string, fn: () => Promise<T>, fil?: string) => {
        const t0 = Date.now();
        if (fil) uppdatera(fil, { steg: STEGNAMN[steg] ?? steg });
        const r = await fn();
        const s = Math.round((Date.now() - t0) / 1000);
        if (fil) uppdatera(fil, (f) => ({ tider: [...f.tider, { steg: STEGNAMN[steg] ?? steg, s }] }));
        else setKundTider((x) => [...x, { steg: STEGNAMN[steg] ?? steg, s }]);
        return r;
      };

      // 1. Kundbilden
      setText('Bygger kundbilden…');
      await tidta('kundbild', () => post(lista[0].id, 'kundbild', { tvinga: true })).catch((e) => setFel(`Kundbilden: ${e.message} — konteringen körs ändå`));

      // 2. Dublettcheck fil för fil, äldst först
      const trasiga = new Set<string>();
      for (const [i, f] of lista.entries()) {
        setText(`Dublettcheck ${i + 1} av ${lista.length}…`);
        uppdatera(f.id, { lage: 'kor' });
        try {
          await tidta('dublett', () => post(f.id, 'dublett'), f.id);
          // Väntar på en plats i kön till Komplettera
          uppdatera(f.id, { lage: 'vantar', steg: '' });
        } catch (e) {
          trasiga.add(f.id);
          uppdatera(f.id, { lage: 'fel', fel: (e as Error).message, steg: '' });
        }
      }

      // 3. Tre filer åt gången
      setText('Kompletterar och konterar…');
      const ko = lista.filter((f) => !trasiga.has(f.id));
      let nasta = 0;
      const fran = new Date().toISOString();
      await Promise.all(Array.from({ length: Math.min(FILER_SAMTIDIGT, ko.length) }, async () => {
        while (nasta < ko.length) {
          const f = ko[nasta++];
          uppdatera(f.id, { lage: 'kor' });
          try {
            await tidta('komplettera', () => post(f.id, 'komplettera'), f.id);
            await tidta('tillrackligt', () => post(f.id, 'tillrackligt'), f.id);
            await tidta('konteras', async () => {
              for (let varv = 0; varv < 100; varv++) {
                const d = await post(f.id, 'konteras', { fran, medBokforda: true });
                if (d.ersatt) uppdatera(f.id, (x) => ({ ersatta: x.ersatta + d.ersatt!.ersatta, inlamnade: x.inlamnade + d.ersatt!.inlamnade }));
                if (!d.kvar) return;
                uppdatera(f.id, { steg: `Konteras — ${d.kvar} kvar` });
              }
            }, f.id);
            uppdatera(f.id, { lage: 'klar', steg: '' });
          } catch (e) {
            uppdatera(f.id, { lage: 'fel', fel: (e as Error).message, steg: '' });
          }
        }
      }));

      // 4–5. Frågemejlet och helhetskontrollen, en gång för kunden
      const nu = await Promise.all(lista.map(async (f) => ({ id: f.id, u: await hamta(f.id) })));
      if (nu.some(({ u }) => u?.mejl?.status === 'draft')) {
        setText('Skriver om frågemejlet…');
        await tidta('skriv-mejl', () => post(lista[0].id, 'skriv-mejl', { omkorning: true })).catch((e) => setFel(`Frågemejlet: ${e.message}`));
      }
      setText('Helhetskontroll…');
      await tidta('helhet', () => post(lista[0].id, 'helhet')).catch((e) => setFel(`Helhetskontrollen: ${e.message}`));

      setText('Hämtar resultatet…');
      const efter = await Promise.all(lista.map(async (f) => ({ id: f.id, u: await hamta(f.id) })));
      setFiler((l) => l?.map((f) => ({ ...f, u: efter.find((x) => x.id === f.id)?.u ?? f.u })) ?? null);
      setHelhet(efter.find((x) => x.u?.helhet)?.u?.helhet ?? null);
    } finally {
      setKor(false);
      setText('');
      setSlut(Date.now());
      onKlar();
    }
  };

  const summa = (f: Fil) => {
    const T = f.u?.transaktioner ?? [];
    const att = T.filter((t) => !t.dublettAv && t.tillrackligt?.status !== 'saknar');
    return {
      gron: att.filter((t) => t.kontering === 'gron').length,
      granska: att.filter((t) => t.kontering === 'granska').length,
      andrade: T.filter((t) => f.fore.get(t.id) !== undefined && f.fore.get(t.id) !== lageFor(t)).length,
      antal: T.length,
    };
  };
  const LAGE: Record<Fil['lage'], { namn: string; klass: string }> = {
    vantar: { namn: 'Väntar', klass: 'text-slate-400' },
    kor: { namn: 'Körs', klass: 'text-violet-700' },
    klar: { namn: 'Klar', klass: 'text-emerald-700' },
    fel: { namn: 'Fel', klass: 'text-red-600' },
    hoppas: { namn: 'Hoppas över', klass: 'text-slate-400' },
  };

  return (
    <div className="mb-3 bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h2 className="text-sm font-semibold text-slate-900 mr-auto">Kör om {kund.namn}s alla underlag</h2>
        {start && (
          <span className="text-xs text-slate-500 tabular-nums">
            {kor ? 'Pågår' : 'Tog'} {Math.round(((slut ?? Date.now()) - start) / 1000)} s{kundTider.length ? ` · ${kundTider.map((t) => `${t.steg} ${t.s} s`).join(' · ')}` : ''}
          </span>
        )}
        <button
          onClick={korOm}
          disabled={kor}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
        >
          {kor ? `${text || 'Kör'}` : filer ? 'Kör om igen' : 'Kör om alla underlag'}
        </button>
      </div>
      {!filer && (
        <p className="text-xs text-slate-500">
          Kör alla AI-steg från Komplettera på kundens alla filer med transaktioner, också de bokförda: kundbild, dublettcheck, komplettering, tillräckligt, kontering med jämkning och helhetskontroll. En bokförd transaktion vars kontering ändrats får sin verifikation ersatt, utom i perioder som redan är inlämnade.
        </p>
      )}
      {fel && <p className="text-xs text-red-600 mb-2">{fel}</p>}

      {filer && filer.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-1.5 pr-2 font-medium">Fil</th>
              <th className="py-1.5 pr-2 font-medium">Läge</th>
              <th className="py-1.5 pr-2 font-medium text-right">Gröna</th>
              <th className="py-1.5 pr-2 font-medium text-right">Granska</th>
              <th className="py-1.5 pr-2 font-medium text-right">Ändrade</th>
              <th className="py-1.5 pr-2 font-medium">Tid</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filer.map((f) => {
              const s = summa(f);
              const tid = f.tider.reduce((a, t) => a + t.s, 0);
              return (
                <Fragment key={f.id}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setOppen(oppen === f.id ? null : f.id)}>
                    <td className="py-1.5 pr-2 text-slate-900">
                      <span className="text-slate-400 mr-1">{oppen === f.id ? '▾' : '▸'}</span>
                      <FilLank id={f.id} namn={f.fileName} />
                      {/* Dokumentets andra sidor, när filen är första sidan av flera */}
                      {(f.u?.sidor?.delar ?? []).filter((d) => d.id !== f.id).map((d) => (
                        <span key={d.id} className="text-slate-400"> + <FilLank id={d.id} namn={`sida ${d.sida ?? '?'}`} /></span>
                      ))}
                      <span className="text-slate-400"> · {s.antal} st</span>
                    </td>
                    <td className={`py-1.5 pr-2 ${LAGE[f.lage].klass}`}>
                      {f.steg || LAGE[f.lage].namn}
                      {f.fel && <span className="block text-red-600">{f.fel}</span>}
                      {f.ersatta > 0 && <span className="block text-slate-600">{f.ersatta} verifikationer ersatta</span>}
                      {f.inlamnade > 0 && <span className="block text-amber-700">{f.inlamnade} avviker i inlämnad period</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-emerald-700">{s.gron}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-amber-700">{s.granska}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{s.andrade}</td>
                    <td className="py-1.5 pr-2 text-slate-500 tabular-nums" title={f.tider.map((t) => `${t.steg} ${t.s} s`).join(' · ')}>{tid ? `${tid} s` : ''}</td>
                    <td className="py-1.5 text-right">
                      <button onClick={(e) => { e.stopPropagation(); onFolj(f.id); }} className="text-slate-500 hover:text-slate-900 underline">Följ</button>
                    </td>
                  </tr>
                  {oppen === f.id && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 px-3 py-2">
                        {f.tider.length > 0 && <p className="text-[11px] text-slate-500 mb-2">{f.tider.map((t) => `${t.steg} ${t.s} s`).join(' · ')}</p>}
                        <ul className="space-y-1">
                          {(f.u?.transaktioner ?? []).map((t) => {
                            const nu = lageFor(t);
                            const fore = f.fore.get(t.id);
                            return (
                              <li key={t.id}>
                                <button onClick={() => setOppenTrans(oppenTrans === t.id ? null : t.id)} className="w-full text-left flex flex-wrap items-baseline gap-x-2 hover:bg-white rounded px-1 py-0.5">
                                  <span className="text-slate-400 tabular-nums">{t.datum ?? '—'}</span>
                                  <span className="text-slate-900">{t.motpart || t.beskrivning || 'Utan beskrivning'}</span>
                                  <span className="tabular-nums text-slate-700">{t.riktning === 'in' ? '+' : '−'}{kr.format(t.belopp)} {t.valuta}</span>
                                  <span className={`ml-auto ${t.kontering === 'gron' || t.bokford ? 'text-emerald-700' : t.kontering === 'granska' ? 'text-amber-700' : 'text-slate-500'}`}>{nu}</span>
                                  {fore !== undefined && fore !== nu && <span className="w-full text-right text-slate-400">före: {fore}</span>}
                                </button>
                                {oppenTrans === t.id && (
                                  <div className="grid md:grid-cols-2 gap-2 my-2">
                                    {t.forslag.length ? t.forslag.map((x) => <ForslagKort key={x.modell} f={x} />) : <p className="text-slate-500">Inga konteringar — {t.dublettAv ? 'dubblett' : t.tillrackligt?.status === 'saknar' ? `saknar ${t.tillrackligt.saknas.map((m) => m.vad).join(', ')}` : 'inte konterad'}.</p>}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {helhet && (
        <div className="mt-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Helhetskontroll</div>
          <p className="text-xs text-slate-700">{helhet.sammanfattning}</p>
          {helhet.anmarkningar.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {helhet.anmarkningar.map((a, i) => <li key={i} className="text-xs text-amber-800">• {a.text}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
