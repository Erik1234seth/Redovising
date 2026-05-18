'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const ACCENT = '#0891B2';
const TODAY = new Date().toISOString().split('T')[0];

const TYPER = [
  { id: 'foretagslan', label: 'Företagslån', desc: 'Lån från bank eller kreditinstitut till företaget' },
  { id: 'privatlan', label: 'Privat lån', desc: 'Du har lånat ut privata pengar till företaget' },
  { id: 'bidrag', label: 'Bidrag eller stöd', desc: 'T.ex. stöd från Tillväxtverket, Almi eller liknande' },
  { id: 'annat', label: 'Annat', desc: 'Beskriv själv vad det gäller' },
];

const RIKTNINGAR = [
  { id: 'in', label: 'Pengarna sattes in på företagskontot', desc: 'Företaget fick pengar' },
  { id: 'ut', label: 'Pengarna togs ut från företagskontot', desc: 'T.ex. amortering av lån' },
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
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#ECFEFF' }}>
          <svg className="w-8 h-8" fill="none" stroke={ACCENT} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 mb-2">Sparat!</h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">Händelsen är bokförd och syns nu i listan.</p>
        <button type="button" onClick={onClose} className="w-full py-3 text-sm font-bold text-white rounded-xl" style={{ backgroundColor: NAV_BG }}>
          Gå till bokföringen
        </button>
      </div>
    </div>
  );
}

function getKonton(typ: string, riktning: string) {
  const in_ = riktning === 'in';
  switch (typ) {
    case 'foretagslan':
      return in_
        ? { debit: '1930', debitNamn: 'Företagskonto', kredit: '2350', kreditNamn: 'Skulder till kreditinstitut' }
        : { debit: '2350', debitNamn: 'Skulder till kreditinstitut', kredit: '1930', kreditNamn: 'Företagskonto' };
    case 'privatlan':
      return in_
        ? { debit: '1930', debitNamn: 'Företagskonto', kredit: '2393', kreditNamn: 'Skulder till närstående' }
        : { debit: '2393', debitNamn: 'Skulder till närstående', kredit: '1930', kreditNamn: 'Företagskonto' };
    case 'bidrag':
      return { debit: '1930', debitNamn: 'Företagskonto', kredit: '3980', kreditNamn: 'Erhållna bidrag' };
    default:
      return in_
        ? { debit: '1930', debitNamn: 'Företagskonto', kredit: '2999', kreditNamn: 'Övriga skulder' }
        : { debit: '2999', debitNamn: 'Övriga skulder', kredit: '1930', kreditNamn: 'Företagskonto' };
  }
}

export default function OvrigtPage() {
  const router = useRouter();
  const [typ, setTyp] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [riktning, setRiktning] = useState('');
  const [belopp, setBelopp] = useState('');
  const [datum, setDatum] = useState(TODAY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Steps: typ → [beskrivning if annat] → riktning → belopp → datum
  const rawSteps: string[] = ['typ', ...(typ === 'annat' ? ['beskrivning'] : []), 'riktning', 'belopp', 'datum'];
  const [step, setStep] = useState(0);
  const total = rawSteps.length;
  const current = rawSteps[step];

  function isValid() {
    if (current === 'typ') return !!typ;
    if (current === 'beskrivning') return beskrivning.trim().length > 0;
    if (current === 'riktning') return !!riktning;
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

      const typLabel = TYPER.find(t => t.id === typ)?.label ?? 'Övrigt';
      const konton = getKonton(typ, riktning);

      await supabase.from('bokforing_transaktioner').insert({
        user_id: user.id,
        haendelse_typ: 'ovrigt',
        datum,
        beskrivning: typ === 'annat' ? beskrivning : typLabel,
        belopp: Number(belopp),
        moms: 0,
        ovrigt: typ === 'annat' ? null : (beskrivning || null),
        ai_kategori: typLabel,
        ai_debit_konto: konton.debit,
        ai_debit_namn: konton.debitNamn,
        ai_kredit_konto: konton.kredit,
        ai_kredit_namn: konton.kreditNamn,
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
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Vad gäller det?</h1>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Här registrerar du saker som inte har en egen kategori — lån, bidrag och annat.
              </p>
              <div className="space-y-3">
                {TYPER.map(t => (
                  <RadioCard key={t.id} label={t.label} desc={t.desc} selected={typ === t.id} onClick={() => { setTyp(t.id); if (t.id !== 'annat') setBeskrivning(''); }} />
                ))}
              </div>
            </div>
          )}

          {current === 'beskrivning' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Beskriv vad det gäller</h1>
              <p className="text-slate-400 text-sm mb-6">T.ex. "Företagsstöd från Tillväxtverket" eller "Amortering av skuld".</p>
              <textarea autoFocus rows={3} value={beskrivning} onChange={e => setBeskrivning(e.target.value)}
                placeholder="Beskriv händelsen..."
                className={inputCls + ' resize-none'} style={ringStyle} />
            </div>
          )}

          {current === 'riktning' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Hur rörde sig pengarna?</h1>
              <p className="text-slate-400 text-sm mb-6">Välj om pengarna kom in till eller gick ut från företaget.</p>
              <div className="space-y-3">
                {RIKTNINGAR.map(r => (
                  <RadioCard key={r.id} label={r.label} desc={r.desc} selected={riktning === r.id} onClick={() => setRiktning(r.id)} />
                ))}
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
              <p className="text-slate-400 text-sm mb-6">Ange datumet för händelsen.</p>
              <DateInput value={datum} onChange={setDatum} />
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
