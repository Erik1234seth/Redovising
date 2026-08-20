'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACCENT } from './theme';
import KundValjare from './KundValjare';
import { kundNamn, useKunder } from './kunder';

interface SieTransaktion {
  verifikation: string;
  serie: string;
  nummer: string;
  verdatum: string;
  vertext: string;
  konto: string;
  kontonamn: string;
  belopp: number;
  datum: string;
  text: string;
  objekt: { dimension: string; objekt: string }[];
  kvantitet: number | null;
}

interface SieResultat {
  filnamn: string;
  teckenkodning: string;
  header: {
    program: string;
    format: string;
    sietyp: string;
    orgnr: string;
    foretag: string;
    genererad: string;
    rakenskapsar: { id: string; start: string; slut: string }[];
  };
  transaktioner: SieTransaktion[];
  varningar: string[];
  summering: {
    antalVerifikationer: number;
    antalTransaktioner: number;
    antalKonton: number;
    summaDebet: number;
    summaKredit: number;
    differens: number;
    obalanseradeVerifikationer: { verifikation: string; summa: number }[];
  };
}

interface ArkivFil {
  id: string;
  created_at: string;
  filnamn: string;
  storlek_bytes: number | null;
  teckenkodning: string | null;
  foretag: string | null;
  orgnr: string | null;
  program: string | null;
  sietyp: string | null;
  rakenskapsar_start: string | null;
  rakenskapsar_slut: string | null;
  antal_verifikationer: number;
  antal_transaktioner: number;
  summa_debet: number;
  summa_kredit: number;
  differens: number;
  anteckning: string | null;
  kund_id: string | null;
  kund: { id: string; company_name: string | null; full_name: string | null; email: string | null } | null;
}

const arkivKundNamn = (f: ArkivFil) =>
  f.kund ? f.kund.company_name || f.kund.full_name || f.kund.email || 'Namnlös kund' : null;

const kr = (n: number) =>
  Number(n).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const datum = (iso: string) =>
  new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

export default function SiePanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const [data, setData] = useState<SieResultat | null>(null);
  /** Filen som ligger i vyn nu, om den kom från en uppladdning (behövs för att spara) */
  const [fil, setFil] = useState<File | null>(null);
  /** Raden i arkivet som vyn visar, om den är sparad */
  const [sparadId, setSparadId] = useState<string | null>(null);
  const [sparar, setSparar] = useState(false);
  const [sparatMeddelande, setSparatMeddelande] = useState<string | null>(null);
  const [anteckning, setAnteckning] = useState('');

  const { kunder, fel: kundfel } = useKunder();
  /** Kunden filen i vyn är kopplad till */
  const [kundId, setKundId] = useState<string | null>(null);
  const [visaKundval, setVisaKundval] = useState(false);
  /** Filtrerar arkivlistan på kund */
  const [filterKund, setFilterKund] = useState<string>('alla');

  const [arkiv, setArkiv] = useState<ArkivFil[]>([]);
  const [arkivFel, setArkivFel] = useState<string | null>(null);
  const [visaArkiv, setVisaArkiv] = useState(true);

  const [sök, setSök] = useState('');
  const [visaJson, setVisaJson] = useState(false);

  const hämtaArkiv = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-test/sie-arkiv');
      const svar = await res.json();
      if (!res.ok) throw new Error(svar.error ?? 'Kunde inte hämta arkivet');
      setArkiv(svar.filer);
      setArkivFel(null);
    } catch (err) {
      setArkivFel(err instanceof Error ? err.message : 'Okänt fel');
    }
  }, []);

  useEffect(() => {
    hämtaArkiv();
  }, [hämtaArkiv]);

  async function tolka(vald: File) {
    setLaddar(true);
    setFel(null);
    setData(null);
    setSparadId(null);
    setSparatMeddelande(null);
    setAnteckning('');
    setKundId(null);
    setVisaKundval(false);
    setSök('');

    try {
      const fd = new FormData();
      fd.append('file', vald);
      const res = await fetch('/api/ai-test/sie', { method: 'POST', body: fd });
      const svar = await res.json();
      if (!res.ok) throw new Error(svar.error ?? 'Okänt fel');
      setData(svar);
      setFil(vald);
    } catch (err) {
      setFel(err instanceof Error ? err.message : 'Okänt fel');
      setFil(null);
    } finally {
      setLaddar(false);
    }
  }

  async function spara() {
    if (!fil || sparar) return;
    setSparar(true);
    setFel(null);

    try {
      const fd = new FormData();
      fd.append('file', fil);
      if (anteckning.trim()) fd.append('anteckning', anteckning.trim());
      if (kundId) fd.append('kundId', kundId);

      const res = await fetch('/api/ai-test/sie-arkiv', { method: 'POST', body: fd });
      const svar = await res.json();
      if (!res.ok) throw new Error(svar.error ?? 'Kunde inte spara');

      setSparadId(svar.fil.id);
      setAnteckning(svar.fil.anteckning ?? '');
      setKundId(svar.fil.kund_id ?? null);
      setSparatMeddelande(
        svar.redanSparad ? 'Filen fanns redan i arkivet — visar den sparade raden.' : 'Sparad i arkivet.'
      );
      await hämtaArkiv();
    } catch (err) {
      setFel(err instanceof Error ? err.message : 'Okänt fel');
    } finally {
      setSparar(false);
    }
  }

  async function öppna(id: string) {
    setLaddar(true);
    setFel(null);
    setSparatMeddelande(null);
    setSök('');

    try {
      const res = await fetch(`/api/ai-test/sie-arkiv/${id}`);
      const svar = await res.json();
      if (!res.ok) throw new Error(svar.error ?? 'Kunde inte öppna filen');
      setData(svar.tolkning);
      setSparadId(svar.id);
      setAnteckning(svar.anteckning ?? '');
      setKundId(svar.kund_id ?? null);
      setVisaKundval(false);
      setFil(null);
    } catch (err) {
      setFel(err instanceof Error ? err.message : 'Okänt fel');
    } finally {
      setLaddar(false);
    }
  }

  /** Uppdaterar en sparad fil. Skickar bara de fält som ska ändras. */
  async function uppdatera(fält: { anteckning?: string; kundId?: string | null }, meddelande: string) {
    if (!sparadId) return;
    try {
      const res = await fetch(`/api/ai-test/sie-arkiv/${sparadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fält),
      });
      const svar = await res.json();
      if (!res.ok) throw new Error(svar.error ?? 'Kunde inte spara');
      setSparatMeddelande(meddelande);
      await hämtaArkiv();
    } catch (err) {
      setFel(err instanceof Error ? err.message : 'Okänt fel');
    }
  }

  /** Kopplar (eller lossar) kunden. Sparad fil uppdateras direkt. */
  function välToKund(nyKundId: string | null) {
    setKundId(nyKundId);
    setVisaKundval(false);
    if (sparadId) {
      uppdatera(
        { kundId: nyKundId },
        nyKundId ? 'Filen kopplad till kunden.' : 'Kopplingen till kunden borttagen.'
      );
    }
  }

  async function taBort(id: string) {
    if (!confirm('Ta bort filen ur arkivet?')) return;
    try {
      const res = await fetch(`/api/ai-test/sie-arkiv/${id}`, { method: 'DELETE' });
      const svar = await res.json();
      if (!res.ok) throw new Error(svar.error ?? 'Kunde inte ta bort');
      if (sparadId === id) {
        setData(null);
        setSparadId(null);
        setFil(null);
      }
      await hämtaArkiv();
    } catch (err) {
      setFel(err instanceof Error ? err.message : 'Okänt fel');
    }
  }

  const valdKund = kunder.find((k) => k.id === kundId) ?? null;

  /** Kunder som faktiskt har filer i arkivet — för filtret */
  const arkivKunder = useMemo(() => {
    const sedda = new Map<string, string>();
    for (const f of arkiv) {
      if (f.kund_id) sedda.set(f.kund_id, arkivKundNamn(f) ?? 'Namnlös kund');
    }
    return [...sedda.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sv'));
  }, [arkiv]);

  const synligtArkiv = useMemo(() => {
    if (filterKund === 'alla') return arkiv;
    if (filterKund === 'utan') return arkiv.filter((f) => !f.kund_id);
    return arkiv.filter((f) => f.kund_id === filterKund);
  }, [arkiv, filterKund]);

  const filtrerade = useMemo(() => {
    if (!data) return [];
    const q = sök.trim().toLowerCase();
    if (!q) return data.transaktioner;
    return data.transaktioner.filter((t) =>
      [t.verifikation, t.konto, t.kontonamn, t.text, t.vertext, t.datum]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [data, sök]);

  function laddaNerCsv() {
    if (!data) return;
    const rubriker = ['Verifikation', 'Verdatum', 'Vertext', 'Datum', 'Konto', 'Kontonamn', 'Belopp', 'Text', 'Objekt'];
    const rader = data.transaktioner.map((t) => [
      t.verifikation,
      t.verdatum,
      t.vertext,
      t.datum,
      t.konto,
      t.kontonamn,
      String(t.belopp).replace('.', ','),
      t.text,
      t.objekt.map((o) => `${o.dimension}:${o.objekt}`).join(' '),
    ]);
    const csv = [rubriker, ...rader]
      .map((rad) => rad.map((f) => `"${String(f ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.filnamn.replace(/\.[^.]+$/, '')}-transaktioner.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Arkivet */}
      <div className="rounded-xl border border-white/10 bg-white/5">
        <button
          onClick={() => setVisaArkiv((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-medium">
            Sparade SIE-filer{' '}
            <span className="text-slate-400">({arkiv.length})</span>
          </span>
          <span className="text-xs text-slate-400">{visaArkiv ? 'Dölj' : 'Visa'}</span>
        </button>

        {visaArkiv && (
          <div className="border-t border-white/10">
            {arkivFel && <p className="px-4 py-3 text-sm text-red-300">{arkivFel}</p>}
            {!arkivFel && arkiv.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                Inget sparat än. Ladda upp en fil och tryck Spara.
              </p>
            )}
            {arkiv.length > 0 && arkivKunder.length > 0 && (
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
                <span className="text-xs text-slate-400">Kund:</span>
                <select
                  value={filterKund}
                  onChange={(e) => setFilterKund(e.target.value)}
                  className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs outline-none"
                >
                  <option value="alla">Alla ({arkiv.length})</option>
                  <option value="utan">Utan kund ({arkiv.filter((f) => !f.kund_id).length})</option>
                  {arkivKunder.map(([id, namn]) => (
                    <option key={id} value={id}>
                      {namn} ({arkiv.filter((f) => f.kund_id === id).length})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {arkiv.length > 0 && (
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#1c465f] text-slate-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">Fil</th>
                      <th className="px-3 py-2 font-medium">Kund</th>
                      <th className="px-3 py-2 font-medium">Företag i filen</th>
                      <th className="px-3 py-2 font-medium">Räkenskapsår</th>
                      <th className="px-3 py-2 text-right font-medium">Ver</th>
                      <th className="px-3 py-2 text-right font-medium">Trans</th>
                      <th className="px-3 py-2 font-medium">Sparad</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {synligtArkiv.map((f) => (
                      <tr
                        key={f.id}
                        onClick={() => öppna(f.id)}
                        className="cursor-pointer border-t border-white/5 transition hover:bg-white/5"
                        style={sparadId === f.id ? { background: `${ACCENT}1f` } : undefined}
                      >
                        <td className="px-4 py-2">
                          <span className="font-medium">{f.filnamn}</span>
                          {f.anteckning && <span className="ml-2 text-slate-400">{f.anteckning}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {arkivKundNamn(f) ? (
                            <span className="text-slate-200">{arkivKundNamn(f)}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-300">{f.foretag ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                          {f.rakenskapsar_start ? `${f.rakenskapsar_start} – ${f.rakenskapsar_slut}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                          {f.antal_verifikationer}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                          {f.antal_transaktioner}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-400">{datum(f.created_at)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              taBort(f.id);
                            }}
                            className="text-slate-500 transition hover:text-red-400"
                            aria-label="Ta bort"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Uppladdning */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const vald = e.dataTransfer.files?.[0];
          if (vald) tolka(vald);
        }}
        onClick={() => fileRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition"
        style={{
          borderColor: dragging ? ACCENT : 'rgba(255,255,255,0.2)',
          background: dragging ? `${ACCENT}14` : 'rgba(255,255,255,0.03)',
        }}
      >
        <p className="font-medium">{laddar ? 'Tolkar…' : 'Släpp en SIE4-fil här'}</p>
        <p className="mt-1 text-sm text-slate-400">
          .se, .si eller .sie — tolkas lokalt, inget skickas till någon AI
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".se,.si,.sie,.txt"
          hidden
          onChange={(e) => {
            const vald = e.target.files?.[0];
            if (vald) tolka(vald);
            e.target.value = '';
          }}
        />
      </div>

      {fel && (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">
          {fel}
        </pre>
      )}

      {data && (
        <>
          {/* Spara / anteckning / kund */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={anteckning}
                onChange={(e) => setAnteckning(e.target.value)}
                placeholder="Anteckning (t.ex. vilket program filen kom från)"
                className="min-w-56 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
              />
              {sparadId ? (
                <>
                  <button
                    onClick={() => uppdatera({ anteckning }, 'Anteckningen sparad.')}
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm transition hover:bg-white/10"
                  >
                    Spara anteckning
                  </button>
                  <span className="text-xs text-emerald-400">✓ i arkivet</span>
                </>
              ) : (
                <button
                  onClick={spara}
                  disabled={!fil || sparar}
                  className="rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
                  style={{ background: ACCENT, color: '#04222f' }}
                >
                  {sparar ? 'Sparar…' : 'Spara i databasen'}
                </button>
              )}
              {sparatMeddelande && <span className="text-xs text-slate-400">{sparatMeddelande}</span>}
            </div>

            {/* Kundkoppling — intern, kunden ser aldrig filen */}
            <div className="border-t border-white/10 pt-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Kund</span>
                {valdKund ? (
                  <>
                    <span className="text-sm font-medium">{kundNamn(valdKund)}</span>
                    <button
                      onClick={() => setVisaKundval((v) => !v)}
                      className="text-xs text-slate-400 underline transition hover:text-white"
                    >
                      Byt
                    </button>
                    <button
                      onClick={() => välToKund(null)}
                      className="text-xs text-slate-400 underline transition hover:text-white"
                    >
                      Koppla loss
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-slate-400">Inte kopplad</span>
                    <button
                      onClick={() => setVisaKundval((v) => !v)}
                      className="text-xs underline transition hover:text-white"
                      style={{ color: ACCENT }}
                    >
                      {visaKundval ? 'Avbryt' : 'Koppla till kund'}
                    </button>
                  </>
                )}
              </div>

              {visaKundval && (
                <div className="mt-3 max-w-md">
                  <KundValjare
                    kunder={kunder}
                    value={null}
                    onChange={välToKund}
                    visaVerksamhet={false}
                    kompakt
                  />
                  {kundfel && <p className="mt-2 text-xs text-red-300">{kundfel}</p>}
                </div>
              )}

              <p className="mt-2 text-xs text-slate-500">
                Kopplingen är intern. Kunden ser varken filen eller transaktionerna — inget skrivs till
                kundens bokföring.
              </p>
            </div>
          </div>

          {/* Filens huvud */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{data.header.foretag || data.filnamn}</h2>
              <span className="text-xs text-slate-400">
                {data.filnamn} · {data.teckenkodning}
                {data.header.sietyp && ` · SIE-typ ${data.header.sietyp}`}
                {data.header.program && ` · ${data.header.program}`}
              </span>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <Rad label="Org.nr" värde={data.header.orgnr} />
              <Rad label="Genererad" värde={data.header.genererad} />
              <Rad
                label="Räkenskapsår"
                värde={data.header.rakenskapsar.map((r) => `${r.start} – ${r.slut}`).join(', ')}
              />
              <Rad label="Konton i filen" värde={String(data.summering.antalKonton)} />
            </dl>
          </div>

          {/* Summering */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Nyckeltal label="Verifikationer" värde={String(data.summering.antalVerifikationer)} />
            <Nyckeltal label="Transaktioner" värde={String(data.summering.antalTransaktioner)} />
            <Nyckeltal label="Summa debet" värde={kr(data.summering.summaDebet)} />
            <Nyckeltal
              label="Summa kredit"
              värde={kr(data.summering.summaKredit)}
              avvikande={Math.abs(data.summering.differens) >= 0.005}
            />
          </div>

          {(data.varningar.length > 0 || data.summering.obalanseradeVerifikationer.length > 0) && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              {data.summering.obalanseradeVerifikationer.length > 0 && (
                <p className="mb-1">
                  Obalanserade verifikationer:{' '}
                  {data.summering.obalanseradeVerifikationer
                    .map((v) => `${v.verifikation} (${kr(v.summa)})`)
                    .join(', ')}
                </p>
              )}
              {data.varningar.map((v, i) => (
                <p key={i}>{v}</p>
              ))}
            </div>
          )}

          {/* Transaktionerna */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={sök}
              onChange={(e) => setSök(e.target.value)}
              placeholder="Sök konto, text eller verifikation…"
              className="min-w-56 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
            />
            <span className="text-xs text-slate-400">
              {filtrerade.length} av {data.transaktioner.length} rader
            </span>
            <button
              onClick={laddaNerCsv}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs transition hover:bg-white/10"
            >
              Ladda ner CSV
            </button>
            <button
              onClick={() => setVisaJson((v) => !v)}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs transition hover:bg-white/10"
            >
              {visaJson ? 'Dölj JSON' : 'Visa JSON'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Ver</th>
                  <th className="px-3 py-2 font-medium">Datum</th>
                  <th className="px-3 py-2 font-medium">Konto</th>
                  <th className="px-3 py-2 font-medium">Kontonamn</th>
                  <th className="px-3 py-2 text-right font-medium">Debet</th>
                  <th className="px-3 py-2 text-right font-medium">Kredit</th>
                  <th className="px-3 py-2 font-medium">Text</th>
                </tr>
              </thead>
              <tbody>
                {filtrerade.map((t, i) => (
                  <tr key={i} className="border-t border-white/5 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">{t.verifikation}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">{t.datum}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{t.konto}</td>
                    <td className="px-3 py-2 text-slate-300">{t.kontonamn || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {t.belopp > 0 ? kr(t.belopp) : ''}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {t.belopp < 0 ? kr(Math.abs(t.belopp)) : ''}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {t.text || t.vertext || '—'}
                      {t.objekt.length > 0 && (
                        <span className="ml-2 text-slate-500">
                          {t.objekt.map((o) => `${o.dimension}:${o.objekt}`).join(' ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtrerade.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                      Inga rader matchar sökningen.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {visaJson && (
            <pre className="max-h-[32rem] overflow-auto rounded-xl bg-black/40 p-4 text-xs text-slate-300">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function Rad({ label, värde }: { label: string; värde: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-slate-400">{label}</dt>
      <dd>{värde || '—'}</dd>
    </div>
  );
}

function Nyckeltal({ label, värde, avvikande }: { label: string; värde: string; avvikande?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${avvikande ? 'text-amber-300' : ''}`}>{värde}</p>
    </div>
  );
}
