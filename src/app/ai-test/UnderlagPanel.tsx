'use client';

import { useEffect, useRef, useState } from 'react';
import { ACCENT } from './theme';
import KundValjare from './KundValjare';
import { useKunder } from './kunder';

type Typ = 'auto' | 'kvitto' | 'transaktioner';

interface Traff {
  source: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

interface Transaktion {
  datum: string;
  beskrivning: string;
  belopp: number;
  moms: number;
  haendelse_typ: string;
  debit_konto: string;
  debit_namn: string;
  kredit_konto: string;
  kredit_namn: string;
}

/** Flagga från kodgrinden i tvåpassläget. */
interface Flagga {
  typ: string;
  allvar: 'stopp' | 'granskning' | 'notis';
  text: string;
  sida?: string;
}

/** En rad i tvåpassläget: förslaget, vad koden sa, och vad granskningen gjorde. */
interface GranskadTransaktion extends Transaktion {
  radnr?: number;
  omdome?: 'godkand' | 'granskning' | 'andrad' | 'stopp' | 'saknas';
  forslag?: { debit_konto: string | null; kredit_konto: string | null };
  grind?: { flaggor: Flagga[] };
  granskning?: {
    brutna_regler?: string[];
    granskning_kravs?: boolean;
    motivering?: string;
    fel?: string;
  } | null;
  sakerhet?: string;
  motivering?: string;
}

interface Svar {
  filnamn: string;
  typ: 'kvitto' | 'transaktioner';
  lage?: 'tvapass';
  modell: string;
  kalla: string;
  haendelse?: string;
  kundkontext: string | null;
  basdokument: Traff[];
  sekunder: number;
  usage: { total_tokens?: number; pass1_tokens?: number; granskning_tokens?: number } | null;
  resultat: Record<string, unknown> & { transactions?: Transaktion[] };
  sammanfattning?: Record<string, number>;
  hopparning?: { inrader: number; svarsrader: number; saknadeRadnr: number[] };
  regelverk?: { fil: string; antalKonton: number; antalRegler: number };
}

/**
 * Ett tolkat kvitto/faktura omgjort till en transaktionsrad.
 *
 * Kvittoanalysen svarar med vad som köptes, datum, belopp och moms — men inte
 * med någon kontering. Raden här är mellansteget: den går att läsa igenom,
 * rätta och markera innan den skickas vidare till konteringen.
 */
interface UnderlagRad {
  /** filnamnet; en fil ger en rad, och en omkörning ersätter den */
  id: string;
  datum: string;
  text: string;
  belopp: number;
  moms: number;
  haendelse: string;
  avsandare: string;
  land: string;
}

/** Bygger transaktionsraden ur ett kvittosvar. Null om beloppet saknas. */
function tillUnderlagRad(filnamn: string, svar: Svar): UnderlagRad | null {
  const r = svar.resultat as Record<string, unknown>;
  const belopp = Number(r.belopp);
  if (!Number.isFinite(belopp) || belopp === 0) return null;

  const vad = String(r.vad ?? '').trim();
  const avsandare = String(r.avsandare ?? '').trim();
  return {
    id: filnamn,
    datum: String(r.datum ?? '').trim(),
    // Både vad och vem: leverantörsnamnet är ofta det som avgör kontot
    text: [vad, avsandare].filter(Boolean).join(' — ') || filnamn,
    belopp,
    moms: Number(r.moms) || 0,
    haendelse: svar.haendelse === 'kund-betalat' ? 'kund-betalat' : 'kopt-nagot',
    avsandare,
    land: String(r.land ?? '').trim(),
  };
}

interface Rad {
  /** Uppladdad fil, eller null när raden är en konteringskörning */
  fil: File | null;
  namn: string;
  storlek: number | null;
  status: 'väntar' | 'kör' | 'klar' | 'fel';
  svar?: Svar;
  fel?: string;
  visaJson?: boolean;
}

export default function UnderlagPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rader, setRader] = useState<Rad[]>([]);
  const [dragging, setDragging] = useState(false);
  const [kör, setKör] = useState(false);

  const [typ, setTyp] = useState<Typ>('auto');
  // 'auto' som standard: en uppladdad hög blandar leverantörsfakturor och egna
  // kundfakturor, och riktningen syns på papperet.
  const [haendelse, setHaendelse] = useState('auto');
  const [modell, setModell] = useState('');
  const [prompt, setPrompt] = useState('');
  const [visaPrompt, setVisaPrompt] = useState(false);
  const [promptRörd, setPromptRörd] = useState(false);

  const [tvaPass, setTvaPass] = useState(true);

  const [standard, setStandard] = useState<{
    modeller: Record<string, string>;
    prompter: { kvitto: string; kvittoAuto: string; transaktioner: string; transaktionerFri: string };
    basdokument: { totalt: number; kallor: { source: string; chunkar: number }[] };
    harNyckel: boolean;
  } | null>(null);
  const [laddfel, setLaddfel] = useState<string | null>(null);
  const [användBasdokument, setAnvändBasdokument] = useState(true);
  const [visaKallor, setVisaKallor] = useState(false);

  const { kunder, fel: kundfel } = useKunder();
  const [kundId, setKundId] = useState<string | null>(null);
  const [underlagsrader, setUnderlagsrader] = useState<UnderlagRad[]>([]);
  const [valdaUnderlag, setValdaUnderlag] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/ai-test/analyze')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Kunde inte läsa standardvärden');
        setStandard(data);
      })
      .catch((err) => setLaddfel(err.message));
  }, []);

  // Prompten i rutan följer vald typ tills du börjat redigera den. Tvåpasset
  // kör medvetet utan listan på vanliga konton, så där visas den fria prompten.
  useEffect(() => {
    if (!standard || promptRörd) return;
    if (typ === 'kvitto') {
      return setPrompt(haendelse === 'auto' ? standard.prompter.kvittoAuto : standard.prompter.kvitto);
    }
    setPrompt(tvaPass ? standard.prompter.transaktionerFri : standard.prompter.transaktioner);
  }, [standard, typ, haendelse, promptRörd, tvaPass]);

  function addFiles(nya: FileList | null) {
    if (!nya) return;
    setRader((prev) => {
      const finns = new Set(prev.map((r) => r.namn));
      const toAdd = Array.from(nya)
        .filter((f) => !finns.has(f.name))
        .map((f) => ({ fil: f, namn: f.name, storlek: f.size, status: 'väntar' as const }));
      return [...prev, ...toAdd];
    });
  }

  /** De markerade underlagen, omgjorda till transaktionsrader för konteringen. */
  const attKontera = underlagsrader
    .filter((u) => valdaUnderlag.includes(u.id))
    .map((u) => ({
      datum: u.datum,
      text: u.text,
      // Inköp bokförs som utbetalning; tecknet är det som säger riktningen
      belopp: u.haendelse === 'kopt-nagot' ? -Math.abs(u.belopp) : Math.abs(u.belopp),
      moms: u.moms,
      haendelse: u.haendelse,
    }));

  /** Konterar de markerade underlagen i en enda körning. */
  async function konteraValda() {
    if (attKontera.length === 0 || kör) return;
    setKör(true);

    const namn = `Kontering: ${attKontera.length} underlag`;
    setRader((prev) => [
      ...prev,
      { fil: null, namn, storlek: null, status: 'kör' as const },
    ]);
    const index = rader.length;

    try {
      const res = await fetch('/api/ai-test/kontera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rader: attKontera,
          kalla: 'markerade-underlag',
          kundId: kundId ?? undefined,
          tvaPass,
          basdokument: användBasdokument,
          modell: modell.trim() || undefined,
          prompt: promptRörd && prompt.trim() ? prompt.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Okänt fel');
      setRader((prev) => prev.map((r, j) => (j === index ? { ...r, status: 'klar', svar: data } : r)));
    } catch (err) {
      const fel = err instanceof Error ? err.message : 'Okänt fel';
      setRader((prev) => prev.map((r, j) => (j === index ? { ...r, status: 'fel', fel } : r)));
    } finally {
      setKör(false);
    }
  }

  async function körAlla() {
    if (rader.length === 0 || kör) return;
    setKör(true);

    for (let i = 0; i < rader.length; i++) {
      const fil = rader[i].fil;
      // Konteringskörningar har ingen fil, och redan tolkade filer ska inte
      // tolkas om när man släppt in fler underlag i högen.
      if (!fil || rader[i].status === 'klar') continue;
      setRader((prev) => prev.map((r, j) => (j === i ? { ...r, status: 'kör', fel: undefined } : r)));

      const fd = new FormData();
      fd.append('file', fil);
      fd.append('typ', typ);
      fd.append('haendelse', haendelse);
      if (modell.trim()) fd.append('modell', modell.trim());
      if (promptRörd && prompt.trim()) fd.append('prompt', prompt.trim());
      if (kundId) fd.append('kundId', kundId);
      if (användBasdokument) fd.append('basdokument', 'true');

      try {
        const res = await fetch('/api/ai-test/analyze', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Okänt fel');
        setRader((prev) => prev.map((r, j) => (j === i ? { ...r, status: 'klar', svar: data } : r)));

        // Kvitton och fakturor blir transaktionsrader som går att kontera
        if (data.typ === 'kvitto') {
          const ny = tillUnderlagRad(fil.name, data);
          if (ny) {
            setUnderlagsrader((prev) => [...prev.filter((u) => u.id !== ny.id), ny]);
            setValdaUnderlag((prev) => (prev.includes(ny.id) ? prev : [...prev, ny.id]));
          }
        }
      } catch (err) {
        const fel = err instanceof Error ? err.message : 'Okänt fel';
        setRader((prev) => prev.map((r, j) => (j === i ? { ...r, status: 'fel', fel } : r)));
      }
    }

    setKör(false);
  }

  const klara = rader.filter((r) => r.status === 'klar').length;
  /** Uppladdade filer som inte tolkats än — det är dem knappen i steg 1 kör på. */
  const otolkade = rader.filter((r) => r.fil && r.status !== 'klar').length;

  return (
    <>
      {laddfel && (
        <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {laddfel}
        </p>
      )}
      {standard && !standard.harNyckel && (
        <p className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          OPENAI_API_KEY saknas i .env.local — analysen kommer misslyckas.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Vänster: filer + resultat */}
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition"
            style={{
              borderColor: dragging ? ACCENT : 'rgba(255,255,255,0.2)',
              background: dragging ? `${ACCENT}14` : 'rgba(255,255,255,0.03)',
            }}
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">Steg 1 — tolka</p>
            <p className="mt-1 font-medium">Släpp kvitton och fakturor här</p>
            <p className="mt-1 text-sm text-slate-400">
              pdf, jpg, png, webp, heic — flera samtidigt. Skannade pdf:er läses som bild.
            </p>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.csv,.xlsx,.xls"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {underlagsrader.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Steg 2 — kontera</p>
                  <p className="text-sm font-medium">
                    Tolkade underlag <span className="text-slate-400">({underlagsrader.length})</span>
                  </p>
                </div>
                <button
                  onClick={() =>
                    setValdaUnderlag(
                      valdaUnderlag.length === underlagsrader.length
                        ? []
                        : underlagsrader.map((u) => u.id)
                    )
                  }
                  className="text-xs text-slate-400 underline transition hover:text-white"
                >
                  {valdaUnderlag.length === underlagsrader.length ? 'Avmarkera alla' : 'Markera alla'}
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-slate-400">
                    <tr>
                      <th className="w-8 px-3 py-2" />
                      <th className="px-3 py-2 font-medium">Datum</th>
                      <th className="px-3 py-2 font-medium">Vad</th>
                      <th className="px-3 py-2 text-right font-medium">Belopp</th>
                      <th className="px-3 py-2 text-right font-medium">Moms</th>
                      <th className="px-3 py-2 font-medium">Typ</th>
                      <th className="px-3 py-2 font-medium">Fil</th>
                      <th className="w-8 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {underlagsrader.map((u) => {
                      const markerad = valdaUnderlag.includes(u.id);
                      return (
                        <tr
                          key={u.id}
                          onClick={() =>
                            setValdaUnderlag((prev) =>
                              prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                            )
                          }
                          className="cursor-pointer border-t border-white/5 transition hover:bg-white/5"
                          style={markerad ? { background: `${ACCENT}1f` } : undefined}
                        >
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={markerad} readOnly />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-300">{u.datum || '—'}</td>
                          <td className="px-3 py-2">{u.text}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                            {u.belopp.toLocaleString('sv-SE')}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-400">
                            {u.moms ? u.moms.toLocaleString('sv-SE') : '—'}
                          </td>
                          {/* Riktningen avgör hela konteringen, så den ska gå att
                              rätta här — inte upptäckas först i kontoförslaget. */}
                          <td className="whitespace-nowrap px-3 py-2">
                            <select
                              value={u.haendelse}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                setUnderlagsrader((prev) =>
                                  prev.map((r) => (r.id === u.id ? { ...r, haendelse: e.target.value } : r))
                                )
                              }
                              className="rounded border border-white/15 bg-black/30 px-1.5 py-1 text-xs outline-none"
                            >
                              <option value="kopt-nagot">inköp</option>
                              <option value="kund-betalat">försäljning</option>
                            </select>
                            {u.land && u.land !== 'Sverige' && (
                              <span className="ml-1.5 text-slate-400">{u.land}</span>
                            )}
                          </td>
                          <td className="max-w-32 truncate px-3 py-2 text-slate-500">{u.id}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setUnderlagsrader((prev) => prev.filter((r) => r.id !== u.id));
                                setValdaUnderlag((prev) => prev.filter((x) => x !== u.id));
                              }}
                              className="text-slate-500 transition hover:text-white"
                              aria-label="Ta bort raden"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Datum, belopp, moms och riktning kommer ur tolkningen och går att rätta här. Markera
                raderna och tryck <span className="text-slate-400">Kontera markerade underlag</span> —
                konteringen är ett eget steg, så du ser vad tolkningen gav innan kontot väljs.
              </p>
            </div>
          )}

          {rader.map((rad, i) => (
            <div key={`${rad.namn}-${i}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{rad.namn}</p>
                  <p className="text-xs text-slate-400">
                    {rad.storlek !== null ? `${(rad.storlek / 1024).toFixed(0)} kB` : 'kontering'}
                    {rad.svar &&
                      ` · ${rad.svar.typ} · ${rad.svar.modell} · ${rad.svar.kalla} · ${rad.svar.sekunder}s` +
                        (rad.svar.usage?.total_tokens ? ` · ${rad.svar.usage.total_tokens} tokens` : '') +
                        (rad.svar.kundkontext ? ' · med kundkontext' : '') +
                        (rad.svar.basdokument?.length
                          ? ` · ${rad.svar.basdokument.length} utdrag ur basdokument`
                          : '')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {rad.status === 'kör' && <span className="text-xs text-slate-300">kör…</span>}
                  {rad.status === 'klar' && <span className="text-xs text-emerald-400">klar</span>}
                  {rad.status === 'fel' && <span className="text-xs text-red-400">fel</span>}
                  <button
                    onClick={() => setRader((prev) => prev.filter((_, j) => j !== i))}
                    className="text-slate-400 transition hover:text-white"
                    aria-label="Ta bort"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {rad.fel && (
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {rad.fel}
                </pre>
              )}

              {rad.svar && (
                <div className="mt-3">
                  <Resultat svar={rad.svar} />
                  <button
                    onClick={() =>
                      setRader((prev) => prev.map((r, j) => (j === i ? { ...r, visaJson: !r.visaJson } : r)))
                    }
                    className="mt-3 text-xs text-slate-400 underline transition hover:text-white"
                  >
                    {rad.visaJson ? 'Dölj rå JSON' : 'Visa rå JSON'}
                  </button>
                  {rad.visaJson && (
                    <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-slate-300">
                      {JSON.stringify(rad.svar.resultat, null, 2)}
                    </pre>
                  )}
                  {rad.svar.kundkontext && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-slate-400 transition hover:text-white">
                        Kundkontexten som skickades med
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs text-slate-300">
                        {rad.svar.kundkontext}
                      </pre>
                    </details>
                  )}
                  {rad.svar.basdokument?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-slate-400 transition hover:text-white">
                        Utdragen ur basdokumenten som skickades med
                      </summary>
                      <div className="mt-2 space-y-2">
                        {rad.svar.basdokument.map((t, k) => (
                          <div key={k} className="rounded-lg bg-black/40 p-3">
                            <p className="mb-1 text-xs text-slate-400">
                              [{k + 1}] {t.source} · chunk {t.chunk_index} · likhet{' '}
                              {(t.similarity * 100).toFixed(0)}%
                            </p>
                            <p className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-300">
                              {t.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Höger: inställningar */}
        <aside className="space-y-4 lg:sticky lg:top-10 lg:self-start">
          {/* Kund — verksamhetstexten skickas med som kontext */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Kund</label>
              {kundId && (
                <button
                  onClick={() => setKundId(null)}
                  className="text-xs text-slate-400 underline transition hover:text-white"
                >
                  Rensa
                </button>
              )}
            </div>
            <KundValjare kunder={kunder} value={kundId} onChange={setKundId} visaKontext />
            {kundfel && <p className="mt-2 text-xs text-red-300">{kundfel}</p>}
          </div>

          {/* Tvåpass — fritt förslag, sedan prövning mot kontoreglerna */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={tvaPass}
                onChange={(e) => setTvaPass(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">Tvåpass med kontoregler</span>
                <span className="block text-xs text-slate-400">
                  AI:n föreslår konto fritt, koden prövar mot K1-kontobeskrivningarna, och rader med
                  regler att pröva går tillbaka till modellen. Gäller konteringen i steg 2.
                </span>
              </span>
            </label>
          </div>

          {/* Basdokument — regelverket AI:n får söka i */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={användBasdokument}
                onChange={(e) => setAnvändBasdokument(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium">Använd basdokument vid kontering</span>
                <span className="block text-xs text-slate-400">
                  {standard
                    ? standard.basdokument.totalt > 0
                      ? `${standard.basdokument.totalt} chunkar ur ${standard.basdokument.kallor.length} dokument — en sökning per rad`
                      : 'Inget indexerat än — kör npm run index-basdokument'
                    : 'laddar…'}
                </span>
              </span>
            </label>

            {standard && standard.basdokument.kallor.length > 0 && (
              <>
                <button
                  onClick={() => setVisaKallor((v) => !v)}
                  className="mt-2 text-xs text-slate-400 underline transition hover:text-white"
                >
                  {visaKallor ? 'Dölj dokumenten' : 'Vilka dokument?'}
                </button>
                {visaKallor && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-400">
                    {standard.basdokument.kallor.map((k) => (
                      <li key={k.source} className="flex justify-between gap-3">
                        <span className="truncate">{k.source}</span>
                        <span className="shrink-0 tabular-nums">{k.chunkar}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <Fält label="Analystyp">
              <select
                value={typ}
                onChange={(e) => setTyp(e.target.value as Typ)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
              >
                <option value="auto">Auto (gissa på filändelsen)</option>
                <option value="kvitto">Kvitto / faktura</option>
                <option value="transaktioner">Transaktionslista</option>
              </select>
            </Fält>

            {typ !== 'transaktioner' && (
              <Fält
                label="Händelse (kvitton)"
                hint="Auto låter AI:n avgöra per underlag — går att rätta i tabellen efteråt."
              >
                <select
                  value={haendelse}
                  onChange={(e) => setHaendelse(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
                >
                  <option value="auto">Auto (AI:n avgör per fil)</option>
                  <option value="kopt-nagot">Köpt något (inköp)</option>
                  <option value="kund-betalat">Kund betalat (försäljning)</option>
                </select>
              </Fält>
            )}

            <Fält
              label="Modell"
              hint={
                standard
                  ? `standard: ${standard.modeller.kvitto} (kvitto), ${standard.modeller.transaktioner} (transaktioner)`
                  : undefined
              }
            >
              <input
                value={modell}
                onChange={(e) => setModell(e.target.value)}
                placeholder="lämna tomt för standard"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
              />
            </Fält>

            <div>
              <button
                onClick={() => setVisaPrompt((v) => !v)}
                className="text-xs text-slate-300 underline transition hover:text-white"
              >
                {visaPrompt ? 'Dölj prompt' : 'Redigera prompt'}
                {promptRörd && !visaPrompt && ' (ändrad)'}
              </button>
              {visaPrompt && (
                <div className="mt-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      setPromptRörd(true);
                    }}
                    rows={14}
                    className="w-full rounded-lg border border-white/15 bg-black/30 p-3 font-mono text-xs leading-relaxed outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {promptRörd ? 'Körningen använder din ändrade prompt' : 'Från prompts.mjs'}
                    </p>
                    {promptRörd && (
                      <button
                        onClick={() => {
                          // Effekten ovan fyller i rätt standardprompt igen
                          setPromptRörd(false);
                        }}
                        className="text-xs text-slate-300 underline transition hover:text-white"
                      >
                        Återställ
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Steg 1 är alltid framhävt tills det finns tolkade underlag att
              kontera — då är steg 2 det man faktiskt vill trycka på. */}
          <button
            onClick={körAlla}
            disabled={kör || otolkade === 0}
            className="w-full rounded-xl px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={
              attKontera.length > 0
                ? { border: '1px solid rgba(255,255,255,0.15)' }
                : { background: ACCENT, color: '#04222f' }
            }
          >
            {kör ? 'Tolkar…' : `Tolka underlagen${otolkade ? ` (${otolkade})` : ''}`}
          </button>

          {attKontera.length > 0 && (
            <button
              onClick={konteraValda}
              disabled={kör}
              className="w-full rounded-xl px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: ACCENT, color: '#04222f' }}
            >
              {kör ? 'Konterar…' : `Kontera ${attKontera.length} markerade underlag`}
            </button>
          )}

          {rader.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                {klara} av {rader.length} klara
              </span>
              <button
                onClick={() => {
                  setRader([]);
                  setUnderlagsrader([]);
                  setValdaUnderlag([]);
                }}
                className="underline transition hover:text-white"
              >
                Rensa alla
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Fält({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const OMDOME_FARG: Record<string, string> = {
  godkand: 'text-emerald-400',
  granskning: 'text-amber-300',
  andrad: 'text-sky-300',
  stopp: 'text-red-400',
  saknas: 'text-slate-500',
};

const OMDOME_TEXT: Record<string, string> = {
  godkand: 'godkänd',
  granskning: 'granska',
  andrad: 'ändrad',
  stopp: 'stopp',
  saknas: 'inget svar',
};

/**
 * Tvåpassresultatet: förslaget, vad koden hittade och vad granskningen gjorde
 * — allt per rad, för det är skillnaden mellan stegen som är intressant.
 */
function TvaPassResultat({ svar }: { svar: Svar }) {
  const txns = (svar.resultat.transactions ?? []) as GranskadTransaktion[];
  const s = svar.sammanfattning ?? {};

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {(['godkand', 'granskning', 'andrad', 'stopp', 'saknas'] as const).map((k) =>
          s[k] ? (
            <span key={k} className={OMDOME_FARG[k]}>
              {s[k]} {OMDOME_TEXT[k]}
            </span>
          ) : null
        )}
        {svar.regelverk && (
          <span className="text-xs text-slate-500">
            {svar.regelverk.antalKonton} konton · {svar.regelverk.antalRegler} regler ur{' '}
            {svar.regelverk.fil}
          </span>
        )}
      </div>

      {svar.hopparning && svar.hopparning.saknadeRadnr.length > 0 && (
        <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Modellen svarade på {svar.hopparning.svarsrader} av {svar.hopparning.inrader} rader. Rad{' '}
          {svar.hopparning.saknadeRadnr.join(', ')} saknas i svaret och står kvar som obehandlade.
        </p>
      )}

      <div className="space-y-2">
        {txns.map((t, i) => {
          const bytt =
            t.forslag &&
            (t.forslag.debit_konto !== t.debit_konto || t.forslag.kredit_konto !== t.kredit_konto);
          return (
            <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm">
                  <span className="text-slate-400">{t.datum}</span> {t.beskrivning}{' '}
                  <span className="tabular-nums text-slate-400">{t.belopp} kr</span>
                </p>
                <span className={`text-xs ${OMDOME_FARG[t.omdome ?? ''] ?? 'text-slate-400'}`}>
                  {OMDOME_TEXT[t.omdome ?? ''] ?? t.omdome}
                </span>
              </div>

              {t.omdome !== 'saknas' && (
                <p className="mt-1 text-xs">
                  {bytt && (
                    <span className="text-slate-500 line-through">
                      {t.forslag?.debit_konto}/{t.forslag?.kredit_konto}{' '}
                    </span>
                  )}
                  <span className="text-slate-200">
                    {t.debit_konto} {t.debit_namn} / {t.kredit_konto} {t.kredit_namn}
                  </span>
                  {t.sakerhet && <span className="text-slate-500"> · säkerhet {t.sakerhet}</span>}
                </p>
              )}

              {/* Pass 1:s egen motivering står först, för det är den som visar
                  om felet satt i avläsningen av underlaget eller i kontovalet. */}
              {t.omdome !== 'saknas' && t.motivering && (
                <p className="mt-1 text-xs text-slate-400">
                  <span className="text-slate-500">[förslag]</span> {t.motivering}
                </p>
              )}

              {t.grind?.flaggor?.map((f, k) => (
                <p
                  key={k}
                  className={`mt-1 text-xs ${
                    f.allvar === 'stopp'
                      ? 'text-red-300'
                      : f.allvar === 'granskning'
                        ? 'text-amber-200'
                        : 'text-slate-500'
                  }`}
                >
                  [kod{f.sida ? `/${f.sida}` : ''}] {f.text}
                </p>
              ))}

              {t.granskning?.brutna_regler?.map((b, k) => (
                <p key={k} className="mt-1 text-xs text-amber-200">
                  [regel] {b}
                </p>
              ))}
              {t.granskning?.fel && (
                <p className="mt-1 text-xs text-red-300">[granskning] {t.granskning.fel}</p>
              )}
              {t.granskning?.motivering && (
                <p className="mt-1 text-xs text-slate-400">
                  <span className="text-slate-500">[granskning]</span> {t.granskning.motivering}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {svar.usage?.pass1_tokens !== undefined && (
        <p className="mt-3 text-xs text-slate-500">
          {svar.usage.pass1_tokens} tokens i pass 1 · {svar.usage.granskning_tokens} i granskningen ·{' '}
          {s.andraPasset ?? 0} rader gick till andra passet
        </p>
      )}
    </div>
  );
}

function Resultat({ svar }: { svar: Svar }) {
  if (svar.typ === 'kvitto') {
    const r = svar.resultat as Record<string, unknown>;
    const par: [string, unknown][] = [
      ['Vad', r.vad],
      ['Datum', r.datum],
      ['Belopp', r.belopp],
      ['Moms', r.moms],
      ['Land', r.land],
      ['Avsändare', r.avsandare],
      ['Betalningssätt', r.betalningssatt],
    ];
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {par.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-400">{k}</dt>
            <dd>{v === null || v === undefined || v === '' ? '—' : String(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (svar.lage === 'tvapass') return <TvaPassResultat svar={svar} />;

  const txns = svar.resultat.transactions ?? [];
  const in_ = txns.filter((t) => t.haendelse_typ === 'kund-betalat');
  const ut = txns.filter((t) => t.haendelse_typ === 'kopt-nagot');

  return (
    <div>
      <p className="mb-2 text-sm text-slate-300">
        {txns.length} transaktioner — {in_.length} in, {ut.length} ut
      </p>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Datum</th>
              <th className="px-3 py-2 font-medium">Beskrivning</th>
              <th className="px-3 py-2 text-right font-medium">Belopp</th>
              <th className="px-3 py-2 text-right font-medium">Moms</th>
              <th className="px-3 py-2 font-medium">Debet</th>
              <th className="px-3 py-2 font-medium">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">{t.datum}</td>
                <td className="px-3 py-2">{t.beskrivning}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{t.belopp}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-400">{t.moms}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                  {t.debit_konto} <span className="text-slate-500">{t.debit_namn}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                  {t.kredit_konto} <span className="text-slate-500">{t.kredit_namn}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
