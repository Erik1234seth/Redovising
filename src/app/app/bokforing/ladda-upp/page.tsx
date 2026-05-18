'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const NAV_BG = '#173b57';
const ACCENT = '#0891B2';

export default function LaddaUppPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState(false);

  function handleFile(f: File) {
    setFile(f);
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

  function submit() {
    if (!file) return;
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col min-h-full bg-slate-50 items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 max-w-md w-full flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: '#ECFEFF' }}>
            <svg className="w-8 h-8" fill="none" stroke={ACCENT} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 mb-2">Fil uppladdad!</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-8">
            Vi har tagit emot din fil och bearbetar transaktionerna. De dyker upp under <span className="font-semibold text-slate-600">Bokförda händelser</span> när de är klara.
          </p>
          <button
            onClick={() => router.push('/bokforing')}
            className="w-full py-3 text-sm font-bold text-white rounded-xl"
            style={{ backgroundColor: NAV_BG }}
          >
            Gå till bokföringen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      {/* Header */}
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

        {/* Instruktioner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-1">Vad ska filen innehålla?</h2>
          <p className="text-sm text-slate-400 mb-4">För att vi ska kunna bokföra transaktionerna korrekt behöver filen innehålla dessa kolumner:</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Datum', desc: 'Transaktionsdatum', required: true },
              { label: 'Belopp', desc: 'Transaktionsbelopp', required: true },
              { label: 'Moms', desc: 'Momsbelopp', required: true },
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
          <p className="text-xs text-slate-400">Vi stödjer CSV- och Excel-filer (.csv, .xlsx, .xls)</p>
        </div>

        {/* Upload-zon */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="bg-white rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-150"
          style={{ borderColor: dragging ? ACCENT : file ? '#059669' : '#E2E8F0', backgroundColor: dragging ? '#ECFEFF' : file ? '#F0FDF4' : undefined }}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleChange} className="hidden" />
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
              <p className="text-xs text-slate-400 mt-1">eller klicka för att välja fil · CSV, XLSX, XLS</p>
            </>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!file}
          className="w-full py-3.5 text-sm font-bold text-white rounded-2xl transition-opacity disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}
        >
          Ladda upp och bokför
        </button>
      </div>
    </div>
  );
}
