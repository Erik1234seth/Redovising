'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const ACCENT = '#0891B2';
const TODAY = new Date().toISOString().split('T')[0];

const RIKTNINGAR = [
  { id: 'salj', label: 'Försäljning', desc: 'Pengar in — du sålde en vara eller tjänst' },
  { id: 'kop', label: 'Köp', desc: 'Pengar ut — du köpte något till företaget' },
];

const KONTON = [
  { id: 'foretag', label: 'Företagskonto', desc: 'Pengarna gick via företagets bankkonto' },
  { id: 'privat', label: 'Privatkonto', desc: 'Du använde egna pengar eller ditt privata konto' },
];

const MOMSSATSER = [
  { id: '25', label: '25 %', desc: 'Standardmoms — gäller de flesta varor och tjänster' },
  { id: '12', label: '12 %', desc: 'Livsmedel, hotell, restaurang' },
  { id: '6', label: '6 %', desc: 'Böcker, tidningar, persontransport, kultur' },
  { id: '0', label: 'Ingen moms', desc: 'Momsfritt eller du är inte momsregistrerad' },
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

// Belopp anges inklusive moms — vi räknar fram momsdelen.
function momsAvBrutto(brutto: number, sats: number) {
  if (!sats) return 0;
  return Math.round((brutto - brutto / (1 + sats / 100)) * 100) / 100;
}

function getKonton(riktning: string, konto: string) {
  const viaPrivat = konto === 'privat';
  if (riktning === 'salj') {
    return viaPrivat
      ? { debit: '2018', debitNamn: 'Egen insättning', kredit: '3001', kreditNamn: 'Försäljning' }
      : { debit: '1930', debitNamn: 'Företagskonto', kredit: '3001', kreditNamn: 'Försäljning' };
  }
  return viaPrivat
    ? { debit: '6990', debitNamn: 'Övriga externa kostnader', kredit: '2018', kreditNamn: 'Egen insättning' }
    : { debit: '6990', debitNamn: 'Övriga externa kostnader', kredit: '1930', kreditNamn: 'Företagskonto' };
}

export default function ManuellPage() {
  const router = useRouter();
  const [riktning, setRiktning] = useState('');
  const [datum, setDatum] = useState(TODAY);
  const [belopp, setBelopp] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [momssats, setMomssats] = useState('');
  const [konto, setKonto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const rawSteps = ['riktning', 'datum', 'belopp', 'beskrivning', 'moms', 'konto'] as const;
  const [step, setStep] = useState(0);
  const total = rawSteps.length;
  const current = rawSteps[step];

  const momsBelopp = momsAvBrutto(Number(belopp) || 0, Number(momssats) || 0);

  function isValid() {
    if (current === 'riktning') return !!riktning;
    if (current === 'datum') return /^\d{4}-\d{2}-\d{2}$/.test(datum);
    if (current === 'belopp') return !!belopp && !isNaN(Number(belopp)) && Number(belopp) > 0;
    if (current === 'beskrivning') return beskrivning.trim().length > 0;
    if (current === 'moms') return momssats !== '';
    if (current === 'konto') return !!konto;
    return true;
  }

  function reset() {
    setStep(0); setRiktning(''); setDatum(TODAY); setBelopp('');
    setBeskrivning(''); setMomssats(''); setKonto(''); setDone(false);
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

      const konton = getKonton(riktning, konto);
      const salj = riktning === 'salj';

      const { error: dbError } = await supabase.from('bokforing_transaktioner').insert({
        user_id: user.id,
        haendelse_typ: salj ? 'kund-betalat' : 'kopt-nagot',
        datum,
        beskrivning: beskrivning.trim(),
        belopp: Number(belopp),
        moms: momsBelopp,
        betalningssatt: konto === 'privat'
          ? (salj ? 'Till privatkonto' : 'Från privatkonto')
          : (salj ? 'Till företagskonto' : 'Från företagskonto'),
        ai_kategori: salj ? 'Försäljning' : 'Inköp',
        ai_momsats: Number(momssats),
        ai_debit_konto: konton.debit,
        ai_debit_namn: konton.debitNamn,
        ai_kredit_konto: konton.kredit,
        ai_kredit_namn: konton.kreditNamn,
        ai_noteringar: 'Manuellt registrerad transaktion',
      });
      if (dbError) throw dbError;
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
                <p className="text-xs text-slate-400 mb-0.5">Typ</p>
                <p className="text-sm font-semibold text-slate-700">{RIKTNINGAR.find(r => r.id === riktning)?.label}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Datum</p>
                <p className="text-sm font-semibold text-slate-700">{datum}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Belopp</p>
                <p className="text-sm font-semibold text-slate-700">{Number(belopp).toLocaleString('sv-SE')} kr</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Varav moms</p>
                <p className="text-sm font-semibold text-slate-700">{momsBelopp.toLocaleString('sv-SE')} kr</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Beskrivning</p>
                <p className="text-sm font-semibold text-slate-700">{beskrivning}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Konto</p>
                <p className="text-sm font-semibold text-slate-700">{KONTON.find(k => k.id === konto)?.label}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={reset}
              className="flex-1 px-6 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Lägg till fler
            </button>
            <button type="button" onClick={() => router.push('/bokforing')}
              className="flex-1 px-6 py-3 text-sm font-bold text-white rounded-xl" style={{ backgroundColor: NAV_BG }}>
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

          {current === 'riktning' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Köp eller försäljning?</h1>
              <p className="text-slate-400 text-sm mb-6">Välj om pengarna kom in till eller gick ut från företaget.</p>
              <div className="space-y-3">
                {RIKTNINGAR.map(r => (
                  <RadioCard key={r.id} label={r.label} desc={r.desc} selected={riktning === r.id} onClick={() => setRiktning(r.id)} />
                ))}
              </div>
            </div>
          )}

          {current === 'datum' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Vilket datum?</h1>
              <p className="text-slate-400 text-sm mb-6">Datumet då pengarna rörde sig.</p>
              <DateInput value={datum} onChange={setDatum} />
              <p className="text-xs text-slate-400 mt-2.5">Format: år-månad-dag, t.ex. 2026-05-14</p>
            </div>
          )}

          {current === 'belopp' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Hur mycket?</h1>
              <p className="text-slate-400 text-sm mb-6">Ange totalbeloppet inklusive moms.</p>
              <div className="relative">
                <input autoFocus type="number" value={belopp} onChange={e => setBelopp(e.target.value)}
                  min="0" step="0.01" placeholder="0"
                  className={inputCls + ' pr-10'} style={ringStyle} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">kr</span>
              </div>
            </div>
          )}

          {current === 'beskrivning' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Vad gällde det?</h1>
              <p className="text-slate-400 text-sm mb-6">
                {riktning === 'salj'
                  ? 'T.ex. ”Konsultuppdrag Acme AB” eller ”Försäljning webbshop”.'
                  : 'T.ex. ”Kontorsmaterial Clas Ohlson” eller ”Månadsavgift Adobe”.'}
              </p>
              <textarea autoFocus rows={3} value={beskrivning} onChange={e => setBeskrivning(e.target.value)}
                placeholder="Beskriv transaktionen..."
                className={inputCls + ' resize-none'} style={ringStyle} />
            </div>
          )}

          {current === 'moms' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Vilken moms?</h1>
              <p className="text-slate-400 text-sm mb-6">Vi räknar ut momsdelen av beloppet åt dig.</p>
              <div className="space-y-3">
                {MOMSSATSER.map(m => (
                  <RadioCard key={m.id} label={m.label} desc={m.desc} selected={momssats === m.id} onClick={() => setMomssats(m.id)} />
                ))}
              </div>
              {momssats !== '' && Number(belopp) > 0 && (
                <p className="text-xs text-slate-400 mt-4 text-center">
                  {Number(belopp).toLocaleString('sv-SE')} kr varav moms{' '}
                  <span className="font-semibold text-slate-500">{momsBelopp.toLocaleString('sv-SE')} kr</span>
                </p>
              )}
            </div>
          )}

          {current === 'konto' && (
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Vilket konto?</h1>
              <p className="text-slate-400 text-sm mb-6">
                {riktning === 'salj' ? 'Vart kom pengarna in?' : 'Varifrån betalade du?'}
              </p>
              <div className="space-y-3">
                {KONTON.map(k => (
                  <RadioCard key={k.id} label={k.label} desc={k.desc} selected={konto === k.id} onClick={() => setKonto(k.id)} />
                ))}
              </div>
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
