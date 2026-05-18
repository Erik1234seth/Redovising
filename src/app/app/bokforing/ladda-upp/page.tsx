'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const ACCENT = '#0891B2';

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

export default function LaddaUppPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[] | null>(null);
  const [done, setDone] = useState(false);

  function handleFile(f: File) {
    setFile(f);
    setTransactions(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  async function analyze() {
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/bokforing/analyze-transactions', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Okänt fel');
      setTransactions(data.transactions ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.');
    } finally {
      setProcessing(false);
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
        belopp: t.belopp,
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
          <p className="text-xl font-bold text-slate-800">Analyserar transaktioner...</p>
          <p className="text-slate-400 text-sm mt-1.5">AI:n läser igenom filen och identifierar varje rad</p>
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
            AI hittade {transactions.length} transaktioner
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
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-lg"
                    style={{
                      backgroundColor: isIncome ? '#ECFDF5' : '#FEF2F2',
                      color: isIncome ? '#059669' : '#DC2626',
                    }}
                  >
                    {isIncome ? '+ Inkomst' : '− Utgift'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700 truncate">{t.beskrivning}</p>
                    <p className="text-sm font-bold text-slate-800 whitespace-nowrap flex-shrink-0">
                      {isIncome ? '+' : '−'}{t.belopp.toLocaleString('sv-SE')} kr
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>{t.datum}</span>
                    {t.moms > 0 && <span>Moms: {t.moms.toLocaleString('sv-SE')} kr</span>}
                    <span className="text-slate-300">|</span>
                    <span>{t.debit_konto} → {t.kredit_konto}</span>
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

  // ── Upload form ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="px-8 pt-10 pb-2">
        <button onClick={() => router.push('/bokforing')} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Ladda upp transaktionslista</h1>
        <p className="text-slate-400 text-sm mt-2">Från Zettle, PayPal, Stripe eller din bank</p>
      </div>

      <div className="px-8 py-8 max-w-2xl flex flex-col gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-1">Vad ska filen innehålla?</h2>
          <p className="text-sm text-slate-400 mb-4">För att vi ska kunna bokföra transaktionerna korrekt behöver filen innehålla dessa kolumner:</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Datum', desc: 'Transaktionsdatum', required: true },
              { label: 'Belopp', desc: 'Transaktionsbelopp', required: true },
              { label: 'Moms', desc: 'Momsbelopp', required: false },
              { label: 'Valuta', desc: 'Krävs om inte SEK', required: false },
              { label: 'Beskrivning', desc: 'Vad gäller transaktionen', required: false },
              { label: 'Avgifter', desc: 'Provisioner eller avgifter', required: false },
            ].map(f => (
              <div key={f.label} className="flex items-start gap-2.5 bg-slate-50 rounded-xl p-3">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md mt-0.5 flex-shrink-0 ${f.required ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>
                  {f.required ? 'Krav' : 'Bra att ha'}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{f.label}</p>
                  <p className="text-xs text-slate-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">Vi stödjer CSV, Excel och PDF (.csv, .xlsx, .xls, .pdf)</p>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="bg-white rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-150"
          style={{ borderColor: dragging ? ACCENT : file ? '#059669' : '#E2E8F0', backgroundColor: dragging ? '#ECFEFF' : file ? '#F0FDF4' : undefined }}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" onChange={handleChange} className="hidden" />
          {file ? (
            <>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#DCFCE7' }}>
                <svg className="w-6 h-6" fill="none" stroke="#059669" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="font-semibold text-slate-700 text-sm">{file.name}</p>
              <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(0)} KB · Klicka för att byta fil</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#ECFEFF' }}>
                <svg className="w-6 h-6" fill="none" stroke={ACCENT} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="font-semibold text-slate-700 text-sm">Dra och släpp din fil här</p>
              <p className="text-xs text-slate-400 mt-1">eller klicka för att välja fil · CSV, XLSX, XLS, PDF</p>
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <button
          onClick={analyze}
          disabled={!file}
          className="w-full py-3.5 text-sm font-bold text-white rounded-2xl transition-opacity disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}
        >
          Analysera med AI
        </button>
      </div>
    </div>
  );
}
