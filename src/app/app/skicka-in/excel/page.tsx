'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const ACCENT = '#0891B2';

const SHEET_COLS = ['Datum', 'Beskrivning', 'Belopp (kr)', 'Moms (kr)', 'Typ'];
const SHEET_ROWS = [
  ['2025-03-15', 'Kontorsmaterial', '1 000', '200', 'Utgift'],
  ['2025-03-20', 'Faktura 101 – Kund AB', '6 250', '1 250', 'Inkomst'],
  ['2025-04-02', 'Mobilabonnemang', '400', '80', 'Utgift'],
];

interface ParsedTransaction {
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

export default function ExcelGuidePage() {
  const router = useRouter();

  const [hasVisited, setHasVisited] = useState(false);

  useEffect(() => {
    const key = 'excel-guide-visited';
    if (localStorage.getItem(key)) {
      setHasVisited(true);
    } else {
      localStorage.setItem(key, '1');
    }
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingFile, setProcessingFile] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[] | null>(null);
  const [done, setDone] = useState(false);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      const toAdd = Array.from(newFiles).filter(f => !existing.has(f.name));
      return [...prev, ...toAdd];
    });
    setError(null);
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = '';
  }

  async function analyzeAll() {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const allTransactions: ParsedTransaction[] = [];
      for (const f of files) {
        setProcessingFile(f.name);
        const fd = new FormData();
        fd.append('file', f);
        const res = await fetch('/api/bokforing/analyze-transactions', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Okänt fel');
        allTransactions.push(...(data.transactions ?? []));
      }
      if (allTransactions.length === 0) {
        setError('Vi hittade inga transaktioner i filen. Kontrollera att filen innehåller rätt data och försök igen.');
        return;
      }
      setTransactions(allTransactions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.');
    } finally {
      setProcessing(false);
      setProcessingFile('');
    }
  }

  async function saveAll() {
    if (!transactions?.length) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Inte inloggad');
      const rows = transactions.map(t => ({
        user_id: user.id,
        haendelse_typ: t.haendelse_typ,
        datum: t.datum,
        beskrivning: t.beskrivning,
        belopp: Math.abs(t.belopp),
        moms: t.moms,
        ai_kategori: t.beskrivning,
        ai_debit_konto: t.debit_konto,
        ai_debit_namn: t.debit_namn,
        ai_kredit_konto: t.kredit_konto,
        ai_kredit_namn: t.kredit_namn,
      }));
      const { error: dbError } = await supabase.from('bokforing_transaktioner').insert(rows);
      if (dbError) throw dbError;
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel vid sparning.');
    } finally {
      setSaving(false);
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="flex flex-col min-h-full bg-slate-50 items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 max-w-md w-full flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: '#ECFDF5' }}>
            <svg className="w-8 h-8" fill="none" stroke="#059669" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 mb-2">{transactions?.length} transaktioner bokförda!</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-8">
            Alla transaktioner har sparats och syns nu under <span className="font-semibold text-slate-600">Bokförda händelser</span>.
          </p>
          <button onClick={() => router.push('/bokforing')} className="w-full py-3 text-sm font-bold text-white rounded-xl" style={{ backgroundColor: NAV_BG }}>
            Gå till bokföringen
          </button>
        </div>
      </div>
    );
  }

  // ── Processing ─────────────────────────────────────────────────────────────

  if (processing) {
    return (
      <div className="flex flex-col min-h-full bg-slate-50 items-center justify-center gap-5 px-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
          <svg className="w-7 h-7 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-slate-800">Läser igenom filen...</p>
          {processingFile && <p className="text-slate-400 text-sm mt-1.5 truncate max-w-xs">{processingFile}</p>}
          <p className="text-slate-400 text-xs mt-1">Vi identifierar och sorterar dina transaktioner</p>
        </div>
      </div>
    );
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  if (transactions) {
    return (
      <div className="flex flex-col min-h-full bg-slate-50">
        <div className="px-6 pt-10 pb-4 max-w-2xl mx-auto w-full">
          <button onClick={() => setTransactions(null)} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tillbaka
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Vi hittade {transactions.length} transaktioner
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Granska innan du bokför</h1>
          <p className="text-slate-400 text-sm mt-1 mb-6">Kontrollera att transaktionerna ser rätt ut.</p>
        </div>
        <div className="px-6 pb-4 max-w-2xl mx-auto w-full flex flex-col gap-3">
          {transactions.map((t, i) => {
            const isIncome = t.haendelse_typ === 'kund-betalat';
            return (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: isIncome ? '#ECFDF5' : '#FEF2F2', color: isIncome ? '#059669' : '#DC2626' }}>
                    {isIncome ? '+ Inkomst' : '− Utgift'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700 truncate">{t.beskrivning}</p>
                    <p className="text-sm font-bold text-slate-800 whitespace-nowrap flex-shrink-0">
                      {isIncome ? '+' : '−'}{Math.abs(t.belopp).toLocaleString('sv-SE')} kr
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>{t.datum}</span>
                    {t.moms > 0 && <span>Moms: {t.moms.toLocaleString('sv-SE')} kr</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-6 pb-10 pt-4 max-w-2xl mx-auto w-full">
          {error && <p className="mb-4 text-sm text-red-500 text-center">{error}</p>}
          <button
            onClick={saveAll}
            disabled={saving || transactions.length === 0}
            className="w-full py-3.5 text-sm font-bold text-white rounded-2xl transition-opacity disabled:opacity-40"
            style={{ backgroundColor: NAV_BG }}
          >
            {saving ? 'Sparar...' : `Bokför alla ${transactions.length} transaktioner`}
          </button>
        </div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d2236 0%, #173b57 100%)' }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative px-8 pt-10 pb-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-8">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tillbaka
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
              Excel &amp; CSV
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Din bokföringsfil</h1>
          <p className="text-white/55 text-sm mt-2 leading-relaxed max-w-xs">
            Se hur filen ska se ut, ladda ner mallen och ladda upp den direkt.
          </p>
          <div className="flex gap-3 mt-7 flex-wrap">
            {[{ value: '5', label: 'kolumner' }, { value: '3', label: 'filformat' }, { value: 'AI', label: 'tolkar filen' }].map(s => (
              <div key={s.label} className="rounded-xl px-4 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-white font-extrabold text-base leading-none">{s.value}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pb-12 max-w-2xl flex flex-col gap-5 mt-6">

        {/* Återbesök: visa upload först */}
        {hasVisited && <UploadSection
          dragging={dragging} files={files} error={error}
          fileRef={fileRef} setDragging={setDragging}
          handleDrop={handleDrop} handleChange={handleChange}
          removeFile={removeFile} analyzeAll={analyzeAll}
        />}

        {hasVisited && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">Guide och mall nedan</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        )}

        {/* Mac-stil Excel-visualisering */}
        <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
          <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: '#1e2d3d' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 bg-white/10 rounded-md px-3 py-1">
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
                </svg>
                <span className="text-xs text-white/70 font-medium">bokforing-mall.xlsx</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200" style={{ backgroundColor: '#f0f4f8' }}>
            {['B', 'I', 'U'].map(l => (
              <span key={l} className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-500 bg-white rounded border border-slate-200 cursor-default select-none">{l}</span>
            ))}
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <span className="text-xs text-slate-400 font-mono">A1</span>
            <div className="flex-1 h-5 bg-white rounded border border-slate-200 px-2 flex items-center">
              <span className="text-xs text-slate-500 font-mono">Datum</span>
            </div>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-xs border-collapse" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th className="w-8 border-r border-b border-slate-200 bg-slate-50 text-slate-400 font-medium py-1.5 text-center sticky left-0" />
                  {['A', 'B', 'C', 'D', 'E'].map(l => (
                    <th key={l} className="border-r border-b border-slate-200 bg-slate-50 text-slate-400 font-medium py-1.5 px-2 text-center w-28">{l}</th>
                  ))}
                </tr>
                <tr>
                  <td className="border-r border-b border-slate-200 bg-slate-50 text-slate-400 font-medium text-center py-1.5 text-[11px] sticky left-0">1</td>
                  {SHEET_COLS.map((col, i) => (
                    <td key={i} className="border-r border-b px-2 py-2 font-bold text-white text-[11px]" style={{ backgroundColor: '#1d6f42' }}>
                      {col}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHEET_ROWS.map((row, ri) => (
                  <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? 'white' : '#f7faf8' }}>
                    <td className="border-r border-b border-slate-200 bg-slate-50 text-slate-400 font-medium text-center py-1.5 text-[11px] sticky left-0">{ri + 2}</td>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border-r border-b border-slate-100 px-2 py-2 text-[11px]"
                        style={{ color: cell === 'Utgift' ? '#dc2626' : cell === 'Inkomst' ? '#16a34a' : '#374151', fontWeight: (cell === 'Utgift' || cell === 'Inkomst') ? 600 : 400 }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                {[4, 5].map(n => (
                  <tr key={n} style={{ backgroundColor: n % 2 === 0 ? 'white' : '#f7faf8' }}>
                    <td className="border-r border-b border-slate-200 bg-slate-50 text-slate-300 font-medium text-center py-1.5 text-[11px] sticky left-0">{n + 1}</td>
                    {[0, 1, 2, 3, 4].map(i => <td key={i} className="border-r border-b border-slate-100 px-2 py-2" />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolumnförklaring */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">Vad ska filen innehålla?</h2>
            <p className="text-xs text-slate-400 mt-1">Varje rad är en transaktion. Kolumnerna behöver inte heta exakt så — vi tolkar dem automatiskt.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { col: 'Datum', badge: 'Krav', color: 'rose', desc: 'Format ÅÅÅÅ-MM-DD, t.ex. 2025-03-15.' },
              { col: 'Beskrivning', badge: 'Krav', color: 'rose', desc: 'Vad transaktionen gäller, t.ex. "Faktura 101 – Kund AB".' },
              { col: 'Belopp', badge: 'Krav', color: 'rose', desc: 'Hela beloppet inklusive moms, i kronor.' },
              { col: 'Moms', badge: 'Krav', color: 'rose', desc: 'Momsbeloppet i kronor. Skriv 0 om ingen moms.' },
              { col: 'Typ', badge: 'Krav', color: 'rose', desc: '"Inkomst" för pengar in och "Utgift" för pengar ut.' },
              { col: 'Valuta', badge: 'Valfritt', color: 'slate', desc: 'Behövs bara om transaktionen inte är i SEK.' },
            ].map(item => (
              <div key={item.col} className="flex items-start gap-3 px-6 py-3.5">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${item.color === 'rose' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                  {item.badge}
                </span>
                <div>
                  <span className="text-sm font-semibold text-slate-700">{item.col}</span>
                  <span className="text-xs text-slate-400 ml-2">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400">Stödjer <span className="font-medium text-slate-500">.csv</span>, <span className="font-medium text-slate-500">.xlsx</span>, <span className="font-medium text-slate-500">.xls</span> och <span className="font-medium text-slate-500">.pdf</span></p>
          </div>
        </div>

        {/* Mall */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-800 mb-0.5">Ladda ner mall</h2>
            <p className="text-xs text-slate-400">Färdig fil med rätt kolumner — fyll i dina transaktioner och ladda upp.</p>
          </div>
          <a
            href="/templates/bokforing-mall.csv"
            download="bokforing-mall.csv"
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: NAV_BG }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Ladda ner
          </a>
        </div>

        {/* Första besök: upload nedan */}
        {!hasVisited && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Ladda upp din fil nedan
            </div>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        )}

        {!hasVisited && <UploadSection
          dragging={dragging} files={files} error={error}
          fileRef={fileRef} setDragging={setDragging}
          handleDrop={handleDrop} handleChange={handleChange}
          removeFile={removeFile} analyzeAll={analyzeAll}
        />}

        <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}18` }}>
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-slate-500 leading-relaxed">
            Du kan alltid bokföra direkt på hemsidan under <span className="font-medium text-slate-600">Bokföra</span> — oavsett om du också skickar in fil.
          </p>
        </div>

      </div>
    </div>
  );
}

interface UploadSectionProps {
  dragging: boolean;
  files: File[];
  error: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  setDragging: (v: boolean) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (i: number) => void;
  analyzeAll: () => void;
}

function UploadSection({ dragging, files, error, fileRef, setDragging, handleDrop, handleChange, removeFile, analyzeAll }: UploadSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#ECFEFF' }}>
          <svg className="w-5 h-5" fill="none" stroke={ACCENT} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div>
          <h2 className="font-bold text-slate-800 text-sm">Ladda upp din fil</h2>
          <p className="text-xs text-slate-400">CSV, Excel eller PDF — vi analyserar åt dig</p>
        </div>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-150"
        style={{ borderColor: dragging ? ACCENT : files.length > 0 ? '#059669' : '#CBD5E1', backgroundColor: dragging ? '#ECFEFF' : '#F8FAFC' }}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" multiple onChange={handleChange} className="hidden" />
        {files.length > 0 ? (
          <div className="w-full space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-emerald-50 rounded-xl px-4 py-2.5">
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-slate-700 truncate flex-1">{f.name}</span>
                <span className="text-xs text-slate-400 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                <button
                  onClick={e => { e.stopPropagation(); removeFile(i); }}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-400 text-center pt-1">Dra hit fler filer eller klicka för att lägga till</p>
          </div>
        ) : (
          <>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#ECFEFF' }}>
              <svg className="w-5 h-5" fill="none" stroke={ACCENT} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Dra hit din fil eller klicka för att välja</p>
            <p className="text-xs text-slate-400 mt-1">CSV, Excel eller PDF — max 20 MB</p>
          </>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-500 text-center">{error}</p>}

      {files.length > 0 && (
        <button
          onClick={analyzeAll}
          className="mt-4 w-full py-3.5 text-sm font-bold text-white rounded-xl transition-all hover:opacity-90 hover:-translate-y-0.5"
          style={{ backgroundColor: NAV_BG, boxShadow: `0 6px 20px ${NAV_BG}35` }}
        >
          Analysera {files.length === 1 ? 'filen' : `${files.length} filer`}
        </button>
      )}
    </div>
  );
}
