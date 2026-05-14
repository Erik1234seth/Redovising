'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  vad: string;
  kundLand: string;
  betalningssatt: string;
  kundTyp: string;
  datum: string;
  belopp: string;
  moms: string;
  ovrigt: string;
}

interface AnalysisResult {
  kategori: string;
  varaEllerTjanst: string;
  momsregel: string;
  momsats: string;
  konton: {
    debit: { konto: string; namn: string };
    kredit: { konto: string; namn: string };
  };
  noteringar: string;
}

// ─── Radio card ───────────────────────────────────────────────────────────────

function RadioCard({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 text-left bg-white rounded-2xl border-2 p-4 transition-all duration-150 hover:shadow-md"
      style={{ borderColor: selected ? NAV_BG : '#e2e8f0', boxShadow: selected ? `0 0 0 1px ${NAV_BG}` : undefined }}
    >
      <div
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
        style={{ borderColor: selected ? NAV_BG : '#cbd5e1' }}
      >
        {selected && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NAV_BG }} />}
      </div>
      <span className="font-medium text-[15px]" style={{ color: selected ? NAV_BG : '#334155' }}>
        {label}
      </span>
    </button>
  );
}

// ─── Success popup ────────────────────────────────────────────────────────────

function SuccessPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#ECFDF5' }}>
          <svg className="w-8 h-8" fill="none" stroke="#059669" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 mb-2">Sparat!</h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Transaktionen är nu bokförd. Om du lagt in något fel kan du ta bort den direkt från listan på bokföringssidan.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 text-sm font-bold text-white rounded-xl"
          style={{ backgroundColor: NAV_BG }}
        >
          Gå till bokföringen
        </button>
      </div>
    </div>
  );
}

// ─── Date input with auto-formatting ─────────────────────────────────────────

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, ''); // digits only
    let formatted = raw;
    if (raw.length > 4) formatted = raw.slice(0, 4) + '-' + raw.slice(4);
    if (raw.length > 6) formatted = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8);
    onChange(formatted);
  }

  return (
    <input
      autoFocus
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      placeholder="ÅÅÅÅ-MM-DD"
      maxLength={10}
      className="w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition-shadow tracking-widest"
      style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
    />
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function KundBetalatPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormData>({
    vad: '',
    kundLand: '',
    betalningssatt: '',
    kundTyp: '',
    datum: TODAY,
    belopp: '',
    moms: '',
    ovrigt: '',
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [done, setDone] = useState(false);

  const allSteps = [
    'vad',
    'kundLand',
    'betalningssatt',
    ...(form.kundLand !== 'Sverige' ? ['kundTyp'] : []),
    'datum',
    'belopp',
    'moms',
    'ovrigt',
  ] as const;

  type StepKey = (typeof allSteps)[number];
  const totalSteps = allSteps.length;
  const activeStepKey = allSteps[currentStep] as StepKey;

  function isCurrentStepValid(): boolean {
    switch (activeStepKey) {
      case 'vad': return form.vad.trim().length > 0;
      case 'kundLand': return form.kundLand.length > 0;
      case 'betalningssatt': return form.betalningssatt.length > 0;
      case 'kundTyp': return form.kundTyp.length > 0;
      case 'datum': return /^\d{4}-\d{2}-\d{2}$/.test(form.datum);
      case 'belopp': return form.belopp.trim().length > 0 && !isNaN(Number(form.belopp));
      case 'moms': return form.moms.trim().length > 0 && !isNaN(Number(form.moms));
      case 'ovrigt': return true;
      default: return true;
    }
  }

  function handleBack() {
    if (currentStep === 0) router.push('/bokforing');
    else setCurrentStep(s => s - 1);
  }

  async function handleNext() {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(s => s + 1);
    } else {
      await handleSubmitAndSave();
    }
  }

  async function handleSubmitAndSave() {
    setLoading(true);
    setError(null);
    try {
      // 1. Analyze with AI
      const res = await fetch('/api/bokforing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vad: form.vad,
          kundLand: form.kundLand,
          betalningssatt: form.betalningssatt,
          kundTyp: form.kundTyp || undefined,
          datum: form.datum,
          belopp: Number(form.belopp),
          moms: Number(form.moms),
          ovrigt: form.ovrigt || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Okänt fel');
      }

      const result: AnalysisResult = await res.json();

      // 2. Save to database
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Inte inloggad');

      const { error: dbError } = await supabase.from('bokforing_transaktioner').insert({
        user_id: user.id,
        haendelse_typ: 'kund-betalat',
        datum: form.datum,
        beskrivning: form.vad,
        belopp: Number(form.belopp),
        moms: Number(form.moms),
        kund_land: form.kundLand,
        betalningssatt: form.betalningssatt,
        kund_typ: form.kundTyp || null,
        ovrigt: form.ovrigt || null,
        ai_kategori: result.kategori,
        ai_vara_eller_tjanst: result.varaEllerTjanst,
        ai_momsregel: result.momsregel,
        ai_momsats: result.momsats,
        ai_debit_konto: result.konton.debit.konto,
        ai_debit_namn: result.konton.debit.namn,
        ai_kredit_konto: result.konton.kredit.konto,
        ai_kredit_namn: result.konton.kredit.namn,
        ai_noteringar: result.noteringar || null,
      });

      if (dbError) throw dbError;

      setDone(true);
      setShowSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-5 px-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: NAV_BG }}>
          <svg className="w-7 h-7 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-slate-800">Bokför...</p>
          <p className="text-slate-400 text-sm mt-1.5">Vi analyserar och sparar transaktionen åt dig</p>
        </div>
      </div>
    );
  }

  // ── Done screen ─────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {showSuccess && <SuccessPopup onClose={() => router.push('/bokforing')} />}

        <div className="px-6 pt-12 pb-6 max-w-xl mx-auto w-full">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ backgroundColor: '#ECFDF5', color: '#059669' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Bokfört och sparat!
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Klart!</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Transaktionen är bokförd. Du hittar den nu i listan på bokföringssidan.
          </p>
        </div>

        <div className="px-6 pb-12 max-w-xl mx-auto w-full flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Sammanfattning</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Vad såldes</p>
                <p className="text-sm font-semibold text-slate-700">{form.vad}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Datum</p>
                <p className="text-sm font-semibold text-slate-700">{form.datum}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Belopp</p>
                <p className="text-sm font-semibold text-slate-700">{Number(form.belopp).toLocaleString('sv-SE')} kr</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Moms</p>
                <p className="text-sm font-semibold text-slate-700">{Number(form.moms).toLocaleString('sv-SE')} kr</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Kund</p>
                <p className="text-sm font-semibold text-slate-700">{form.kundLand}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Betalningssätt</p>
                <p className="text-sm font-semibold text-slate-700">{form.betalningssatt}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setDone(false);
                setCurrentStep(0);
                setForm({ vad: '', kundLand: '', betalningssatt: '', kundTyp: '', datum: TODAY, belopp: '', moms: '', ovrigt: '' });
              }}
              className="flex-1 px-6 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Lägg till fler
            </button>
            <button
              type="button"
              onClick={() => router.push('/bokforing')}
              className="flex-1 px-6 py-3 text-sm font-bold text-white rounded-xl"
              style={{ backgroundColor: NAV_BG }}
            >
              Till bokföringen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-5 px-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
          <svg className="w-7 h-7" style={{ color: CORAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-slate-800">Något gick fel</p>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xs leading-relaxed">{error}</p>
        </div>
        <button type="button" onClick={() => setError(null)} className="px-6 py-3 text-sm font-bold text-white rounded-xl" style={{ backgroundColor: NAV_BG }}>
          Försök igen
        </button>
      </div>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────────────────

  const progressPercent = ((currentStep + 1) / totalSteps) * 100;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-slate-200 w-full fixed top-0 left-0 z-50">
        <div className="h-full transition-all duration-300 ease-out" style={{ width: `${progressPercent}%`, backgroundColor: NAV_BG }} />
      </div>

      {/* Top nav */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2 max-w-xl mx-auto w-full">
        <button type="button" onClick={handleBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <span className="text-xs text-slate-400 font-medium tabular-nums">{currentStep + 1} / {totalSteps}</span>
      </div>

      {/* Step content */}
      <div className="flex-1 px-6 py-6 max-w-xl mx-auto w-full">
        <StepContent stepKey={activeStepKey} form={form} setForm={setForm} />
      </div>

      {/* Next button */}
      <div className="px-6 pb-10 max-w-xl mx-auto w-full">
        <button
          type="button"
          onClick={handleNext}
          disabled={!isCurrentStepValid()}
          className="w-full px-6 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
          style={{ backgroundColor: NAV_BG }}
        >
          {isLast ? 'Skicka in' : 'Nästa'}
        </button>
      </div>
    </div>
  );
}

// ─── Step content ─────────────────────────────────────────────────────────────

function StepContent({ stepKey, form, setForm }: { stepKey: string; form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  switch (stepKey) {

    case 'vad':
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Vad sålde du?</h1>
          <p className="text-slate-400 text-sm mt-2 mb-5">Beskriv kort vad du sålde eller utförde</p>

          {/* Info-ruta */}
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mb-5" style={{ backgroundColor: '#EFF6FF' }}>
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="#2563EB" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-0.5">Beskriv så tydligt du kan</p>
              <p className="text-xs text-blue-600 leading-relaxed">
                Vi behöver förstå vad du säljer för att bokföra rätt. Skriv t.ex. <span className="font-semibold">"konsultjänster inom hälsa"</span> eller <span className="font-semibold">"hårgele till frisörer"</span> — inte bara "tjänst" eller "produkt".
              </p>
            </div>
          </div>

          <textarea
            autoFocus
            rows={3}
            value={form.vad}
            onChange={e => setForm(f => ({ ...f, vad: e.target.value }))}
            placeholder="T.ex. konsultjänster inom marknadsföring, handgjorda smycken, webbdesign..."
            className="w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 resize-none transition-shadow"
            style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
          />
        </div>
      );

    case 'kundLand':
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Var finns kunden?</h1>
          <p className="text-slate-400 text-sm mt-2 mb-6">Det påverkar vilka momsregler som gäller</p>
          <div className="flex flex-col gap-3">
            {['Sverige', 'EU', 'Utanför EU'].map(option => (
              <RadioCard key={option} label={option} selected={form.kundLand === option} onClick={() => setForm(f => ({ ...f, kundLand: option, kundTyp: '' }))} />
            ))}
          </div>
        </div>
      );

    case 'betalningssatt':
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Hur fick du betalt?</h1>
          <p className="text-slate-400 text-sm mt-2 mb-6">Välj det konto eller sätt pengarna kom in på</p>
          <div className="flex flex-col gap-3">
            {['Till företagskonto', 'Till privatkonto', 'Kontant'].map(option => (
              <RadioCard key={option} label={option} selected={form.betalningssatt === option} onClick={() => setForm(f => ({ ...f, betalningssatt: option }))} />
            ))}
          </div>
        </div>
      );

    case 'kundTyp':
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Är kunden ett företag eller privatperson?</h1>
          <p className="text-slate-400 text-sm mt-2 mb-6">Det avgör vilka momsregler som gäller utomlands</p>
          <div className="flex flex-col gap-3">
            {['Privatperson', 'Företag', 'Vet inte'].map(option => (
              <RadioCard key={option} label={option} selected={form.kundTyp === option} onClick={() => setForm(f => ({ ...f, kundTyp: option }))} />
            ))}
          </div>
        </div>
      );

    case 'datum':
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Datum</h1>
          <p className="text-slate-400 text-sm mt-2 mb-6">När betalades det?</p>
          <DateInput value={form.datum} onChange={v => setForm(f => ({ ...f, datum: v }))} />
          <p className="text-xs text-slate-400 mt-2.5">Format: år-månad-dag, t.ex. 2026-05-14</p>
        </div>
      );

    case 'belopp':
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Belopp</h1>
          <p className="text-slate-400 text-sm mt-2 mb-6">Hur mycket betalade kunden totalt, inklusive moms?</p>
          <div className="relative">
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.belopp}
              onChange={e => setForm(f => ({ ...f, belopp: e.target.value }))}
              placeholder="0"
              className="w-full px-4 py-3 pr-12 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl placeholder-slate-300 focus:outline-none focus:ring-2 transition-shadow"
              style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">kr</span>
          </div>
        </div>
      );

    case 'moms':
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Moms</h1>
          <p className="text-slate-400 text-sm mt-2 mb-6">Av beloppet är momsen:</p>
          <div className="relative">
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.moms}
              onChange={e => setForm(f => ({ ...f, moms: e.target.value }))}
              placeholder="0"
              className="w-full px-4 py-3 pr-12 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl placeholder-slate-300 focus:outline-none focus:ring-2 transition-shadow"
              style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">kr</span>
          </div>
          <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">Vet du inte exakt? Skriv 0 så räknar vi ut det</p>
        </div>
      );

    case 'ovrigt':
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Övrigt</h1>
          <p className="text-slate-400 text-sm mt-2 mb-1">Är det något annat vi borde veta?</p>
          <p className="text-xs text-slate-400 mb-6">Valfritt</p>
          <textarea
            rows={4}
            value={form.ovrigt}
            onChange={e => setForm(f => ({ ...f, ovrigt: e.target.value }))}
            placeholder="T.ex. att det är en delbetalning, eller att kunden är en kompis..."
            className="w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 resize-none transition-shadow"
            style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
          />
        </div>
      );

    default:
      return null;
  }
}
