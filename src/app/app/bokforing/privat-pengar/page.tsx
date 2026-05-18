'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const ACCENT = '#7C3AED';
const TODAY = new Date().toISOString().split('T')[0];

function RadioCard({ label, desc, selected, onClick }: { label: string; desc?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 text-left bg-white rounded-2xl border-2 p-4 transition-all duration-150 hover:shadow-md"
      style={{ borderColor: selected ? ACCENT : '#e2e8f0', boxShadow: selected ? `0 0 0 1px ${ACCENT}` : undefined }}
    >
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

const STEPS = ['typ', 'belopp', 'datum', 'ovrigt'] as const;
type Step = typeof STEPS[number];

export default function PrivataPengarPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [typ, setTyp] = useState('');
  const [belopp, setBelopp] = useState('');
  const [datum, setDatum] = useState(TODAY);
  const [ovrigt, setOvrigt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const current: Step = STEPS[step];
  const total = STEPS.length;

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
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Inte inloggad');

      const isIns = typ === 'insattning';
      await supabase.from('bokforing_transaktioner').insert({
        user_id: user.id,
        haendelse_typ: 'privat-pengar',
        datum,
        beskrivning: isIns ? 'Privat insättning i företaget' : 'Privat uttag från företaget',
        belopp: Number(belopp),
        moms: 0,
        ovrigt: ovrigt || null,
        ai_kategori: isIns ? 'Egen insättning' : 'Eget uttag',
        ai_debit_konto: isIns ? '1930' : '2013',
        ai_debit_namn: isIns ? 'Företagskonto' : 'Egna uttag',
        ai_kredit_konto: isIns ? '2018' : '1930',
        ai_kredit_namn: isIns ? 'Egna insättningar' : 'Företagskonto',
      });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition-shadow';
  const ringStyle = { '--tw-ring-color': ACCENT } as React.CSSProperties;

  if (done) {
    const isIns = typ === 'insattning';
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="px-6 pt-12 pb-6 max-w-xl mx-auto w-full">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mb-5" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
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
                <p className="text-xs text-slate-400 mb-0.5">Händelse</p>
                <p className="text-sm font-semibold text-slate-700">{isIns ? 'Privat insättning' : 'Privat uttag'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Datum</p>
                <p className="text-sm font-semibold text-slate-700">{datum}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Belopp</p>
                <p className="text-sm font-semibold text-slate-700">{Number(belopp).toLocaleString('sv-SE')} kr</p>
              </div>
              {ovrigt && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Övrigt</p>
                  <p className="text-sm font-semibold text-slate-700">{ovrigt}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setDone(false); setStep(0); setTyp(''); setBelopp(''); setDatum(TODAY); setOvrigt(''); }}
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

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="h-1 bg-slate-100 flex-shrink-0">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%`, backgroundColor: ACCENT }} />
      </div>

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
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Vad hände?</h1>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Registrera när du sätter in privata pengar i företaget eller tar ut pengar privat. Har du köpt något med privata pengar? Använd <span className="font-semibold">"Jag köpte något"</span> istället.
              </p>
              <div className="space-y-3">
                <RadioCard label="Jag satte in privata pengar i företaget" desc="Egna pengar in på företagskontot" selected={typ === 'insattning'} onClick={() => setTyp('insattning')} />
                <RadioCard label="Jag tog ut pengar från företaget privat" desc="Pengar ut från företagskontot för privat bruk" selected={typ === 'uttag'} onClick={() => setTyp('uttag')} />
              </div>
            </div>
          )}

          {current === 'belopp' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Hur mycket?</h1>
              <p className="text-slate-400 text-sm mb-6">Ange beloppet i kronor.</p>
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
              <p className="text-slate-400 text-sm mb-6">Ange datumet för transaktionen.</p>
              <DateInput value={datum} onChange={setDatum} />
            </div>
          )}

          {current === 'ovrigt' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Något att tillägga?</h1>
              <p className="text-slate-400 text-sm mb-6">Valfri kommentar — t.ex. varför du satte in eller tog ut pengarna.</p>
              <textarea autoFocus rows={4} value={ovrigt} onChange={e => setOvrigt(e.target.value)}
                placeholder="T.ex. startkapital för att köpa utrustning..."
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
