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
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingFile, setProcessingFile] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[] | null>(null);
  const [done, setDone] = useState(false);
  const [openService, setOpenService] = useState<string | null>(null);
  const [showServices, setShowServices] = useState(false);

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

  function getMissingFields(txns: ParsedTransaction[]): string[] {
    if (txns.length === 0) return [];
    const missing: string[] = [];
    const half = txns.length * 0.5;

    const emptyDatum = txns.filter(t => !t.datum || t.datum.trim() === '').length;
    if (emptyDatum > half) missing.push('Datum');

    const emptyBesk = txns.filter(t => !t.beskrivning || t.beskrivning.trim() === '').length;
    if (emptyBesk > half) missing.push('Beskrivning');

    const allZeroBelopp = txns.every(t => !t.belopp || t.belopp === 0);
    if (allZeroBelopp) missing.push('Belopp');

    const allNullMoms = txns.every(t => t.moms === null || t.moms === undefined);
    if (allNullMoms) missing.push('Moms');

    return missing;
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

      const missing = getMissingFields(allTransactions);
      if (missing.length > 0) {
        const fields = missing.join(', ');
        const valutaNote = 'Obs: Valuta behöver bara anges om transaktionerna inte är i SEK.';
        setError(`Filen saknar: ${fields}. Kontrollera att filen innehåller dessa kolumner och försök igen. ${valutaNote}`);
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
              { label: 'Beskrivning', desc: 'Vad gäller transaktionen', required: true },
              { label: 'Belopp', desc: 'Transaktionsbelopp', required: true },
              { label: 'Moms', desc: 'Momsbelopp', required: true },
              { label: 'Valuta*', desc: 'Krav om transaktionen inte är i SEK', required: true },
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
          <p className="text-xs text-slate-700 mb-2">* Valuta behövs bara om transaktionerna inte är i SEK — Zettle, Stripe och PayPal använder ofta USD eller EUR.</p>
          <p className="text-xs text-slate-400">Vi stödjer CSV, Excel och PDF (.csv, .xlsx, .xls, .pdf)</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowServices(v => !v)}
            className="w-full flex items-center justify-between px-6 py-5 text-left"
          >
            <div>
              <p className="font-bold text-slate-800">Var hittar jag min fil?</p>
              <p className="text-sm text-slate-400 mt-0.5">Klicka på din tjänst för att se hur du hämtar din fil.</p>
              <p className="text-sm text-slate-400 mt-0.5">Har du en egen fil är det bara att ladda upp.*</p>
            </div>
            <svg
              className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${showServices ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showServices && <div className="px-6 pb-5 divide-y divide-slate-100 border-t border-slate-100">
            {([
              { name: 'Shopify', desc: 'Logga in på din Shopify-butik → Ekonomi → Transaktioner → Exportera → välj CSV.', filnamn: 'transactions_export.csv' },
              { name: 'WooCommerce', desc: 'Logga in på din WordPress-sida → WooCommerce → Rapporter → välj period och exportera som CSV.', filnamn: 'woocommerce-orders-export.csv' },
              { name: 'Klarna', desc: 'Logga in på app.klarna.com/business → Transaktioner → Exportera som CSV.', filnamn: 'klarna_transactions.csv' },
              { name: 'Stripe', desc: 'Logga in på dashboard.stripe.com → Rapporter → Balanshistorik → Exportera CSV.', filnamn: 'balance_history.csv' },
              { name: 'PayPal', desc: 'Logga in på paypal.com → Aktivitet → Ladda ned aktiviteter → välj period och format CSV.', filnamn: 'Download.csv' },
              { name: 'Swish Företag', desc: 'Kontakta din bank för kontoutdrag som inkluderar Swish-betalningar, eller exportera via bankens internetbank.', filnamn: 'Kontoutdrag (varierar per bank)' },
              { name: 'Zettle', desc: 'Logga in på zettle.com → Rapporter → Transaktioner → Exportera som Excel eller CSV.', filnamn: 'Zettle_Transactions.xlsx / .csv' },
              { name: 'SumUp', desc: 'Logga in på me.sumup.com → Transaktioner → Exportera som CSV.', filnamn: 'sumup_transactions.csv' },
              { name: 'Bokadirekt', desc: 'Logga in på Bokadirekt → Ekonomi eller Rapporter → Exportera transaktioner.', filnamn: 'transactions.csv' },
              { name: 'Apple App Store', desc: 'Logga in på App Store Connect → Finance → Payments and Financial Reports → Ladda ned rapport.', filnamn: 'financial_report.csv' },
              { name: 'Google Play', desc: 'Logga in på Google Play Console → Rapporter → Ekonomi → Exportera månadsrapport som CSV.', filnamn: 'PlayApps_earnings_[år]_[månad].csv' },
              { name: 'Etsy', desc: 'Logga in på etsy.com → Finanser → Betalningskonto → Ladda ned CSV.', filnamn: 'EtsyPaymentAccountCSVDownload.csv' },
              { name: 'Amazon', desc: 'Logga in på Seller Central → Rapporter → Betalningar → Transaktionsvy → Exportera CSV.', filnamn: 'transaction-report.csv' },
              { name: 'Annat', desc: 'Exportfunktionen finns vanligtvis under Inställningar → Rapporter, Ekonomi eller Kontoutdrag. Hittar du inte? Hör av dig till oss så hjälper vi dig.', filnamn: null },
              { name: 'Jag har en egen fil', desc: 'Det fungerar bra! Se till att filen innehåller rätt uppgifter (datum, beskrivning, belopp och moms) och är i ett godkänt format: CSV, Excel (.xlsx, .xls) eller PDF.', filnamn: null },
            ] as { name: string; desc: string; filnamn: string | null }[]).map(s => {
              const isOpen = openService === s.name;
              return (
                <button
                  key={s.name}
                  onClick={() => setOpenService(isOpen ? null : s.name)}
                  className="w-full flex items-center justify-between py-3 text-left group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${isOpen ? 'border-blue-500 bg-blue-500' : 'border-slate-300 bg-white'}`}>
                      {isOpen && (
                        <svg className="w-full h-full text-white p-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                      {isOpen && (
                        <div className="mt-1 pr-4 space-y-1.5">
                          <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                          {s.filnamn && (
                            <p className="text-xs text-slate-400">
                              <span className="font-semibold text-slate-600">Filen heter: </span>{s.filnamn}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-300 flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              );
            })}
          </div>}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="bg-white rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-150"
          style={{ borderColor: dragging ? ACCENT : files.length > 0 ? '#059669' : '#E2E8F0', backgroundColor: dragging ? '#ECFEFF' : undefined }}
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
              <p className="text-xs text-slate-400 text-center pt-2">Dra hit fler filer eller klicka för att lägga till</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#ECFEFF' }}>
                <svg className="w-6 h-6" fill="none" stroke={ACCENT} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="font-semibold text-slate-700 text-sm">Dra och släpp dina filer här</p>
              <p className="text-xs text-slate-400 mt-1">eller klicka för att välja · CSV, XLSX, XLS, PDF</p>
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={analyzeAll}
            disabled={files.length === 0}
            className="flex-1 py-3.5 text-sm font-bold text-white rounded-2xl transition-opacity disabled:opacity-40"
            style={{ backgroundColor: NAV_BG }}
          >
            Klar
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 py-3.5 text-sm font-bold rounded-2xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Ladda upp fler filer
          </button>
        </div>
      </div>
    </div>
  );
}
