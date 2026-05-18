'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const ACCENT = '#DB2777';
const TODAY = new Date().toISOString().split('T')[0];

const TYPER = [
  { id: 'preliminarskatt', label: 'Preliminärskatt (F-skatt)', desc: 'Månadsvis betalning av beräknad inkomstskatt', debit: '2510', debitNamn: 'Skatteskulder', kredit: '1930', kreditNamn: 'Företagskonto' },
  { id: 'moms', label: 'Moms till Skatteverket', desc: 'Inbetalning av redovisad utgående moms', debit: '2650', debitNamn: 'Redovisningskonto moms', kredit: '1930', kreditNamn: 'Företagskonto' },
  { id: 'arbetsgivaravgifter', label: 'Arbetsgivaravgifter', desc: 'Sociala avgifter på utbetalda löner', debit: '2731', debitNamn: 'Upplupna sociala avgifter', kredit: '1930', kreditNamn: 'Företagskonto' },
  { id: 'annat', label: 'Annat till Skatteverket', desc: 'Annan betalning, t.ex. restskatt eller avgifter', debit: '2510', debitNamn: 'Skatteskulder', kredit: '1930', kreditNamn: 'Företagskonto' },
];

function RadioCard({ label, desc, selected, onClick }: { label: string; desc?: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-start gap-3 text-left bg-white rounded-2xl border-2 p-4 transition-all duration-150 hover:shadow-md"
      style={{ borderColor: selected ? ACCENT : '#e2e8f0', boxShadow: selected ? `0 0 0 1px ${ACCENT}` : undefined }}>
      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ borderColor: selected ? ACCENT : '#cbd5e1' }}>
        {selected && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ACCENT }} />}
      </div>
      <div>
        <p className="font-medium text-[15px]" style={{ color: selected ? ACCENT : '#334155' }}>{label}</p>
        {desc && <p className="text-sm text-slate-400 mt-0.5">{desc}</p>}
      </div>
    </button>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    let f = raw;
    if (raw.length > 4) f = raw.slice(0, 4) + '-' + raw.slice(4);
    if (raw.length > 6) f = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8);
    onChange(f);
  }
  return (
    <input autoFocus type="text" inputMode="numeric" value={value} onChange={handle}
      placeholder="ÅÅÅÅ-MM-DD" maxLength={10}
      className="w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition-shadow tracking-widest"
      style={{ '--tw-ring-color': ACCENT } as React.CSSProperties} />
  );
}

function SuccessPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#FDF2F8' }}>
          <svg className="w-8 h-8" fill="none" stroke={ACCENT} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 mb-2">Sparat!</h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">Betalningen är bokförd och syns nu i listan.</p>
        <button type="button" onClick={onClose} className="w-full py-3 text-sm font-bold text-white rounded-xl" style={{ backgroundColor: NAV_BG }}>
          Gå till bokföringen
        </button>
      </div>
    </div>
  );
}

const STEPS = ['typ', 'belopp', 'datum', 'ovrigt'] as const;
type Step = typeof STEPS[number];

export default function SkatteverketPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [typ, setTyp] = useState('');
  const [belopp, setBelopp] = useState('');
  const [datum, setDatum] = useState(TODAY);
  const [ovrigt, setOvrigt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const current: Step = STEPS[step];
  const total = STEPS.length;
  const vald = TYPER.find(t => t.id === typ);

  function isValid() {
    if (current === 'typ') return !!typ;
    if (current === 'belopp') return !!belopp && !isNaN(Number(belopp)) && Number(belopp) > 0;
    if (current === 'datum') return /^\d{4}-\d{2}-\d{2}$/.test(datum);
    return true;
  }

  function back() {
    if (step === 0) router.push('/bokforing');
    else setStep(s => s - 1);
  }

  async function next() {
    if (step < total - 1) { setStep(s => s + 1); return; }
    if (!vald) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Inte inloggad');

      await supabase.from('bokforing_transaktioner').insert({
        user_id: user.id,
        haendelse_typ: 'skatteverket',
        datum,
        beskrivning: vald.label,
        belopp: Number(belopp),
        moms: 0,
        ovrigt: ovrigt || null,
        ai_kategori: vald.label,
        ai_debit_konto: vald.debit,
        ai_debit_namn: vald.debitNamn,
        ai_kredit_konto: vald.kredit,
        ai_kredit_namn: vald.kreditNamn,
      });
      setShowSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition-shadow';
  const ringStyle = { '--tw-ring-color': ACCENT } as React.CSSProperties;

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="h-1 bg-slate-100 flex-shrink-0">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%`, backgroundColor: ACCENT }} />
      </div>

      {showSuccess && <SuccessPopup onClose={() => router.push('/bokforing')} />}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-8">
            <button onClick={back} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Tillbaka
            </button>
            <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-full">
              Steg {step + 1}/{total}
            </span>
          </div>

          {current === 'typ' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Vad gäller betalningen?</h1>
              <p className="text-slate-400 text-sm mb-1 leading-relaxed">Välj den typ av betalning som stämmer bäst.</p>
              <p className="text-slate-400 text-sm mb-6">
                Ska du redovisa moms? Använd{' '}
                <Link href="/rapporter/moms" className="underline" style={{ color: ACCENT }}>Momsrapporten</Link>
                {' '}för att se vad du ska betala.
              </p>
              <div className="space-y-3">
                {TYPER.map(t => (
                  <RadioCard key={t.id} label={t.label} desc={t.desc} selected={typ === t.id} onClick={() => setTyp(t.id)} />
                ))}
              </div>
            </div>
          )}

          {current === 'belopp' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Hur mycket betalade du?</h1>
              <p className="text-slate-400 text-sm mb-6">Ange beloppet som betalades till Skatteverket.</p>
              <div className="relative">
                <input autoFocus type="number" value={belopp} onChange={e => setBelopp(e.target.value)}
                  min="0" step="1" placeholder="0"
                  className={inputCls + ' pr-10'} style={ringStyle} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">kr</span>
              </div>
            </div>
          )}

          {current === 'datum' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Vilket datum?</h1>
              <p className="text-slate-400 text-sm mb-6">Ange datumet du betalade.</p>
              <DateInput value={datum} onChange={setDatum} />
            </div>
          )}

          {current === 'ovrigt' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Något att tillägga?</h1>
              <p className="text-slate-400 text-sm mb-6">Valfri kommentar om betalningen.</p>
              <textarea autoFocus rows={4} value={ovrigt} onChange={e => setOvrigt(e.target.value)}
                placeholder="T.ex. avser period jan–mars 2026..."
                className={inputCls + ' resize-none'} style={ringStyle} />
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-500 text-center">{error}</p>}
        </div>
      </div>

      <div className="flex-shrink-0 px-4 pb-8">
        <div className="max-w-lg mx-auto">
          <button onClick={next} disabled={!isValid() || loading}
            className="w-full py-3.5 text-sm font-bold text-white rounded-2xl transition-opacity disabled:opacity-40"
            style={{ backgroundColor: ACCENT }}>
            {loading ? 'Sparar...' : step === total - 1 ? 'Spara' : 'Nästa →'}
          </button>
        </div>
      </div>
    </div>
  );
}
