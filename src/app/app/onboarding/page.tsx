'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import FlowCheckpoints from '@/components/FlowCheckpoints';
import { useMainSiteUrl } from '@/lib/useMainSiteUrl';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

type KontoTyp = 'foretagskonto' | 'privatkonto' | 'bada';

// Frågan ställdes tidigare som ja/nej. Gamla svar finns kvar på ett fåtal
// profiler och förfylls som närmaste motsvarighet i den nya frågan.
const KONTO_LEGACY: Partial<Record<string, KontoTyp>> = {
  ja: 'foretagskonto',
  nej: 'privatkonto',
};

type BokforingMetod = 'excel-kalkylark' | 'hemsidan' | 'maila-underlag';
type SkickaInMetod = 'maila-fil' | 'ladda-upp';

// Formaterar org-/personnummer och lägger automatiskt in bindestreck före de fyra sista siffrorna
function formatOrgNr(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 12);
  // 12 siffror (personnummer med sekel): bindestreck efter 8 siffror
  if (digits.length > 10) return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  // 10 siffror (org-/personnummer): bindestreck efter 6 siffror
  if (digits.length > 6) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return digits;
}

// Luhn-kontroll på 10 siffror (sista siffran är kontrollsiffra)
function luhnValid(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(digits[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

// Giltigt om 10 siffror (org-/personnummer) eller 12 siffror (personnummer med sekel) och Luhn stämmer
function isValidOrgNr(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  const ten = digits.length === 12 ? digits.slice(2) : digits;
  return ten.length === 10 && luhnValid(ten);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const mainSiteUrl = useMainSiteUrl();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [orgNr, setOrgNr] = useState('');
  const [verksamhet, setVerksamhet] = useState('');
  const [harForetagskonto, setHarForetagskonto] = useState<KontoTyp | null>(null);
  // Intygandet sparas inte på profilen — det är en spärr i flödet, inte en uppgift
  // om företaget. Därför förfylls det inte heller vid återbesök: den som går
  // tillbaka i flödet får kryssa i det på nytt, vilket är själva poängen med ett
  // intygande.
  const [intygat, setIntygat] = useState(false);
  // Bokföringsmetod är numera alltid "maila-underlag" — inget steg för det längre
  const bokforingMetod: BokforingMetod = 'maila-underlag';
  const skickaInMetod: SkickaInMetod | null = null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Förfyll formuläret med redan sparade uppgifter så man kan gå tillbaka och ändra
  useEffect(() => {
    if (hydrated || !profile) return;
    if (profile.company_name) setCompanyName(profile.company_name);
    if (profile.org_nr) setOrgNr(profile.org_nr);
    if (profile.verksamhet) setVerksamhet(profile.verksamhet);
    if (profile.har_foretagskonto) {
      const lagrat = profile.har_foretagskonto;
      setHarForetagskonto(KONTO_LEGACY[lagrat] ?? (lagrat as KontoTyp));
    }
    setHydrated(true);
  }, [profile, hydrated]);

  const totalSteps = 2;

  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          company_name: companyName || null,
          org_nr: orgNr || null,
          verksamhet,
          har_foretagskonto: harForetagskonto,
          bokforing_metod: bokforingMetod,
          skicka_in_metod: skickaInMetod,
          onboarding_done: true,
        })
        .eq('id', user.id);

      if (dbError) throw dbError;
      await refreshProfile();
      router.push('/betalning');
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setSaving(false);
    }
  }

  const progressPercent = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Progress bar */}
      <div className="h-1 bg-slate-200 w-full fixed top-0 left-0 z-50">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%`, backgroundColor: NAV_BG }}
        />
      </div>

      {/* Logo */}
      <div className="px-6 pt-8 pb-0">
        <a href={mainSiteUrl} className="flex items-center gap-2.5 w-fit transition-opacity hover:opacity-80">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CORAL }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-[15px] leading-none tracking-tight select-none">
            <span className="font-medium" style={{ color: '#94a3b8' }}>Enkla </span>
            <span className="font-extrabold text-slate-800">Bokslut</span>
          </span>
        </a>
      </div>

      {/* Checkpoints — visar hela resan: skapa konto → uppgifter → betalning */}
      <div className="px-6 pt-8 pb-2 w-full max-w-lg mx-auto">
        <FlowCheckpoints current={2} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-start px-6 pt-6 pb-10 max-w-lg mx-auto w-full">

        {/* Steg 1 — Företagsnamn & org-nr */}
        {step === 1 && (
          <div>
            <StepBadge current={1} total={totalSteps} />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              Vad heter ditt företag?
            </h1>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Fyll i ditt företagsnamn och organisationsnummer så vi kan använda det på rapporter och fakturor.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Företagsnamn
                </label>
                <input
                  autoFocus
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="T.ex. Anna Svensson"
                  className="w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 transition-shadow"
                  style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  För enskild firma är det oftast ditt eget namn
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Organisationsnummer
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={orgNr}
                  onChange={e => setOrgNr(formatOrgNr(e.target.value))}
                  placeholder="ÅÅMMDD-XXXX"
                  className="w-full px-4 py-3 text-sm text-slate-700 bg-white border rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 transition-shadow"
                  style={{
                    borderColor: orgNr.replace(/\D/g, '').length >= 10 && !isValidOrgNr(orgNr) ? '#ef4444' : '#e2e8f0',
                    '--tw-ring-color': NAV_BG,
                  } as React.CSSProperties}
                />
                {orgNr.replace(/\D/g, '').length >= 10 && !isValidOrgNr(orgNr) ? (
                  <p className="text-xs text-red-500 mt-1.5">
                    Ogiltigt organisationsnummer – kontrollera siffrorna.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1.5">
                    För enskild firma är org-numret ditt personnummer
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Tillbaka
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={companyName.trim().length < 2 || !isValidOrgNr(orgNr)}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                style={{ backgroundColor: NAV_BG }}
              >
                Nästa
              </button>
            </div>
          </div>
        )}

        {/* Steg 2 — Verksamhet */}
        {step === 2 && (
          <div>
            <StepBadge current={2} total={totalSteps} />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              Beskriv din verksamhet
            </h1>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Berätta kort vad du säljer eller utför. Det hjälper oss bokföra rätt och ge bättre förslag.
            </p>

            <textarea
              autoFocus
              rows={4}
              value={verksamhet}
              onChange={e => setVerksamhet(e.target.value)}
              placeholder="T.ex. jag driver en enskild firma där jag jobbar som frilansande grafisk designer och säljer logotyper och grafiskt material till företag."
              className="w-full px-4 py-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 resize-none transition-shadow"
              style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
            />

            {/* Följdfråga */}
            <div className="flex flex-col gap-5 mt-6">
              <ChipQuestion
                label="Använder du företagskonto eller privatkonto?"
                hint="Ett företagskonto är ett bankkonto som bara används till företaget, skilt från din privatekonomi. Välj Båda om företagets utgifter betalas från båda hållen."
                options={[
                  { value: 'foretagskonto', label: 'Företagskonto' },
                  { value: 'privatkonto', label: 'Privatkonto' },
                  { value: 'bada', label: 'Båda' },
                ]}
                value={harForetagskonto}
                // ChipQuestion skickar tom sträng när man klickar bort sitt val.
                // Den ska bli null, annars sparas '' i databasen i stället för inget svar.
                onChange={v => setHarForetagskonto((v || null) as KontoTyp | null)}
              />
            </div>

            <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mt-5" style={{ backgroundColor: '#F8FAFC' }}>
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-slate-400 leading-relaxed">
                Du kan alltid ändra detta senare under <span className="font-medium text-slate-500">Mitt konto</span>.
              </p>
            </div>

            {/* Intygandet är en spärr, inte ett sparat fält. Den som inte kan kryssa
                i det är inte en kund vi kan ta emot, så Nästa är låst tills den är
                ikryssad. */}
            <label
              className="w-full flex items-start gap-3 px-4 py-4 rounded-2xl border-2 mt-6 cursor-pointer transition-all duration-100"
              style={{
                borderColor: intygat ? NAV_BG : '#e2e8f0',
                backgroundColor: intygat ? '#F8FAFC' : 'white',
              }}
            >
              <input
                type="checkbox"
                checked={intygat}
                onChange={e => setIntygat(e.target.checked)}
                className="sr-only"
              />
              <span
                className="w-5 h-5 mt-0.5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-colors"
                style={{
                  borderColor: intygat ? NAV_BG : '#cbd5e1',
                  backgroundColor: intygat ? NAV_BG : 'white',
                }}
              >
                {intygat && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="text-xs text-slate-600 leading-relaxed">
                Jag intygar att jag driver en enskild firma utan anställda som omsätter
                under 3 miljoner kronor per år, och att verksamheten varken är skogsbruk,
                lantbruk eller persontransport som till exempel taxi.
              </span>
            </label>

            {error && (
              <p className="mt-4 text-xs text-red-500 text-center">{error}</p>
            )}

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Tillbaka
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={verksamhet.trim().length < 5 || !intygat || saving}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                style={{ backgroundColor: NAV_BG }}
              >
                {saving ? 'Sparar...' : 'Till betalning →'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function ChipQuestion({ label, hint, options, value, onChange }: {
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className={`text-xs font-semibold text-slate-500 ${hint ? 'mb-1' : 'mb-2.5'}`}>{label}</p>
      {hint && <p className="text-xs text-slate-400 mb-2.5 leading-relaxed">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active ? '' : opt.value)}
              className="px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all duration-100"
              style={{
                borderColor: active ? NAV_BG : '#e2e8f0',
                backgroundColor: active ? NAV_BG : 'white',
                color: active ? 'white' : '#475569',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepBadge({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
      style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
    >
      Steg {current} av {total}
    </div>
  );
}
