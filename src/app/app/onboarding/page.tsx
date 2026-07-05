'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';
import FlowCheckpoints from '@/components/FlowCheckpoints';
import { useMainSiteUrl } from '@/lib/useMainSiteUrl';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);

const MOMS_OPTIONS: { value: 'månadsvis' | 'kvartalsvis' | 'helår' | 'ingen-moms'; label: string; desc: string }[] = [
  { value: 'helår', label: 'En gång per år', desc: 'Redovisar moms en gång om året' },
  { value: 'kvartalsvis', label: 'Kvartalsvis', desc: 'Redovisar moms var 3:e månad' },
  { value: 'månadsvis', label: 'Månadsvis', desc: 'Redovisar moms varje månad' },
  { value: 'ingen-moms', label: 'Betalar inte moms', desc: 'Verksamheten är inte momspliktig' },
];

type BokforingMetod = 'excel-kalkylark' | 'hemsidan' | 'maila-underlag';
type SkickaInMetod = 'maila-fil' | 'ladda-upp';

const BOKFORING_OPTIONS: { value: BokforingMetod; label: string; desc: string }[] = [
  { value: 'excel-kalkylark', label: 'Excel / Google Kalkylark', desc: 'Jag håller koll i ett kalkylark' },
  { value: 'hemsidan', label: 'På hemsidan', desc: 'Jag bokför direkt på Enkla Bokslut' },
  { value: 'maila-underlag', label: 'Maila in underlag', desc: 'Jag skickar in kvitton och fakturor via mail' },
];

const SKICKA_OPTIONS: { value: SkickaInMetod; label: string; desc: string }[] = [
  { value: 'maila-fil', label: 'Maila filen', desc: 'Jag mailar in mitt Excel / Google Kalkylark' },
  { value: 'ladda-upp', label: 'Ladda upp på hemsidan', desc: 'Jag laddar upp filen direkt på Enkla Bokslut' },
];

// Hjälptexter som visas när man klickar på frågetecknet vid ett momsalternativ
const MOMS_HELP: Record<string, { title: string; body: string }> = {
  kvartalsvis: {
    title: 'Kvartalsvis moms',
    body: 'Kvartalsvis moms innebär att du redovisar moms fyra gånger per år. Det är vanligt för företag som har högre omsättning än 1 miljon kronor men högst 40 miljoner kronor per år.',
  },
  helår: {
    title: 'Årsvis moms',
    body: 'Du kan normalt redovisa moms en gång per år om företagets beskattningsunderlag är högst 1 miljon kronor per år.',
  },
  månadsvis: {
    title: 'Månadsvis moms',
    body: 'Månadsvis moms innebär att du redovisar moms varje månad. Det är obligatoriskt om företagets beskattningsunderlag är högre än 40 miljoner kronor per år, men mindre företag kan också välja månadsvis redovisning om de vill ha tätare kontroll.',
  },
  'ingen-moms': {
    title: 'Ingen moms',
    body: 'Välj detta om företaget inte är momsregistrerat, till exempel om du omfattas av reglerna för momsbefrielse vid låg årsomsättning. Företag med årsomsättning i Sverige på högst 120 000 kronor kan i vissa fall vara undantagna från momsplikt. Det kräver bland annat att gränsen inte har överskridits under det aktuella kalenderåret eller något av de två föregående kalenderåren.',
  },
};

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
  const [momsPeriod, setMomsPeriod] = useState<'månadsvis' | 'kvartalsvis' | 'helår' | 'ingen-moms' | null>(null);
  const [startAr, setStartAr] = useState<number | null>(null);
  const [saljerTill, setSaljerTill] = useState<'privat' | 'foretag' | null>(null);
  const [saljerI, setSaljerI] = useState<'sverige' | 'eu' | 'utanfor-eu' | null>(null);
  const [koperI, setKoperI] = useState<'sverige' | 'eu' | 'import' | null>(null);
  const [bokforingMetod, setBokforingMetod] = useState<BokforingMetod | null>(null);
  const [skickaInMetod, setSkickaInMetod] = useState<SkickaInMetod | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Förfyll formuläret med redan sparade uppgifter så man kan gå tillbaka och ändra
  useEffect(() => {
    if (hydrated || !profile) return;
    if (profile.company_name) setCompanyName(profile.company_name);
    if (profile.org_nr) setOrgNr(profile.org_nr);
    if (profile.verksamhet) setVerksamhet(profile.verksamhet);
    if (profile.moms_period) setMomsPeriod(profile.moms_period);
    if (profile.start_ar) setStartAr(profile.start_ar);
    if (profile.saljer_till) setSaljerTill(profile.saljer_till);
    if (profile.saljer_i) setSaljerI(profile.saljer_i);
    if (profile.koper_i) setKoperI(profile.koper_i);
    if (profile.bokforing_metod) setBokforingMetod(profile.bokforing_metod);
    if (profile.skicka_in_metod) setSkickaInMetod(profile.skicka_in_metod);
    setHydrated(true);
  }, [profile, hydrated]);

  const totalSteps = bokforingMetod === 'excel-kalkylark' ? 6 : 5;

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
          moms_period: momsPeriod,
          start_ar: startAr,
          saljer_till: saljerTill,
          saljer_i: saljerI,
          koper_i: koperI,
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

            {/* Chip-frågor */}
            <div className="flex flex-col gap-5 mt-6">
              <ChipQuestion
                label="Jag säljer mest till"
                options={[{ value: 'privat', label: 'Privat' }, { value: 'foretag', label: 'Företag' }]}
                value={saljerTill}
                onChange={v => setSaljerTill(v as 'privat' | 'foretag')}
              />
              <ChipQuestion
                label="Jag säljer mest i"
                options={[{ value: 'sverige', label: 'Sverige' }, { value: 'eu', label: 'EU' }, { value: 'utanfor-eu', label: 'Utanför EU' }]}
                value={saljerI}
                onChange={v => setSaljerI(v as 'sverige' | 'eu' | 'utanfor-eu')}
              />
              <ChipQuestion
                label="Jag köper mina produkter mest i"
                options={[{ value: 'sverige', label: 'Sverige' }, { value: 'eu', label: 'EU' }, { value: 'import', label: 'Import / utanför EU' }]}
                value={koperI}
                onChange={v => setKoperI(v as 'sverige' | 'eu' | 'import')}
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
                onClick={() => setStep(3)}
                disabled={verksamhet.trim().length < 5}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                style={{ backgroundColor: NAV_BG }}
              >
                Nästa
              </button>
            </div>
          </div>
        )}

        {/* Steg 3 — Momsredovisning */}
        {step === 3 && (
          <div>
            <StepBadge current={3} total={totalSteps} />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              Hur ofta redovisar du moms?
            </h1>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Välj hur ofta du lämnar in momsdeklaration till Skatteverket.
            </p>

            <div className="flex flex-col gap-3">
              {MOMS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMomsPeriod(opt.value)}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 text-left transition-all duration-100"
                  style={{
                    borderColor: momsPeriod === opt.value ? NAV_BG : '#e2e8f0',
                    backgroundColor: momsPeriod === opt.value ? NAV_BG : 'white',
                  }}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold" style={{ color: momsPeriod === opt.value ? 'white' : '#1e293b' }}>
                        {opt.label}
                      </p>
                      {MOMS_HELP[opt.value] && (
                        <span className="relative inline-flex group">
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`Mer information om ${MOMS_HELP[opt.value].title}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border cursor-help"
                            style={{
                              borderColor: momsPeriod === opt.value ? 'rgba(255,255,255,0.6)' : '#94a3b8',
                              color: momsPeriod === opt.value ? 'white' : '#64748b',
                            }}
                          >
                            ?
                          </span>
                          <span
                            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 scale-95 rounded-xl bg-white p-3 text-left opacity-0 shadow-xl border border-slate-200 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
                          >
                            <span className="block text-xs font-bold text-slate-800 mb-1">{MOMS_HELP[opt.value].title}</span>
                            <span className="block text-xs leading-relaxed text-slate-500">{MOMS_HELP[opt.value].body}</span>
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: momsPeriod === opt.value ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>
                      {opt.desc}
                    </p>
                  </div>
                  {momsPeriod === opt.value && (
                    <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mt-4" style={{ backgroundColor: '#F8FAFC' }}>
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-slate-400 leading-relaxed">
                Är du osäker? Logga in med BankID på{' '}
                <a
                  href="https://www7.skatteverket.se/portal/minasidor/moms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline"
                  style={{ color: NAV_BG }}
                >
                  Skatteverkets Mina sidor
                </a>{' '}
                och öppna fliken moms. Där ser du &quot;Redovisningsperiod&quot; År–Kvartal–Månad. Vill du ändra period så kontaktar du oss så hjälper vi dig.
              </p>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Tillbaka
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={momsPeriod === null}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                style={{ backgroundColor: NAV_BG }}
              >
                Nästa
              </button>
            </div>
          </div>
        )}

        {/* Steg 4 — Startår */}
        {step === 4 && (
          <div>
            <StepBadge current={4} total={totalSteps} />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              Vilket år startade du?
            </h1>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Välj det år du registrerade din enskilda firma hos Skatteverket.
            </p>

            <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {YEARS.map(year => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setStartAr(year)}
                  className="py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-100"
                  style={{
                    borderColor: startAr === year ? NAV_BG : '#e2e8f0',
                    backgroundColor: startAr === year ? NAV_BG : 'white',
                    color: startAr === year ? 'white' : '#475569',
                    boxShadow: startAr === year ? `0 0 0 1px ${NAV_BG}` : undefined,
                  }}
                >
                  {year}
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Tillbaka
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                disabled={startAr === null}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                style={{ backgroundColor: NAV_BG }}
              >
                Nästa
              </button>
            </div>
          </div>
        )}

        {/* Steg 5 — Hur vill du bokföra? */}
        {step === 5 && (
          <div>
            <StepBadge current={5} total={totalSteps} />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              Hur vill du bokföra?
            </h1>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Välj det sätt som passar dig bäst. Du kan alltid använda hemsidan oavsett vad du väljer här.
            </p>

            <div className="flex flex-col gap-3">
              {BOKFORING_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setBokforingMetod(opt.value);
                    if (opt.value !== 'excel-kalkylark') setSkickaInMetod(null);
                  }}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 text-left transition-all duration-100"
                  style={{
                    borderColor: bokforingMetod === opt.value ? NAV_BG : '#e2e8f0',
                    backgroundColor: bokforingMetod === opt.value ? NAV_BG : 'white',
                  }}
                >
                  <div>
                    <p className="text-sm font-bold" style={{ color: bokforingMetod === opt.value ? 'white' : '#1e293b' }}>
                      {opt.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: bokforingMetod === opt.value ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>
                      {opt.desc}
                    </p>
                  </div>
                  {bokforingMetod === opt.value && (
                    <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mt-4" style={{ backgroundColor: '#F8FAFC' }}>
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-slate-400 leading-relaxed">
                Oavsett vad du väljer kan du alltid bokföra direkt på <span className="font-medium text-slate-500">Enkla Bokslut</span>.
              </p>
            </div>

            {error && (
              <p className="mt-4 text-xs text-red-500 text-center">{error}</p>
            )}

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Tillbaka
              </button>
              <button
                type="button"
                onClick={() => bokforingMetod === 'excel-kalkylark' ? setStep(6) : handleFinish()}
                disabled={bokforingMetod === null || saving}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                style={{ backgroundColor: NAV_BG }}
              >
                {bokforingMetod === 'excel-kalkylark' ? 'Nästa' : (saving ? 'Sparar...' : 'Till betalning →')}
              </button>
            </div>
          </div>
        )}

        {/* Steg 6 — Hur vill du skicka in? (visas bara om excel valdes) */}
        {step === 6 && (
          <div>
            <StepBadge current={6} total={totalSteps} />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              Hur vill du skicka in?
            </h1>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Hur vill du skicka in ditt Excel / Google Kalkylark till oss?
            </p>

            <div className="flex flex-col gap-3">
              {SKICKA_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSkickaInMetod(opt.value)}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 text-left transition-all duration-100"
                  style={{
                    borderColor: skickaInMetod === opt.value ? NAV_BG : '#e2e8f0',
                    backgroundColor: skickaInMetod === opt.value ? NAV_BG : 'white',
                  }}
                >
                  <div>
                    <p className="text-sm font-bold" style={{ color: skickaInMetod === opt.value ? 'white' : '#1e293b' }}>
                      {opt.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: skickaInMetod === opt.value ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>
                      {opt.desc}
                    </p>
                  </div>
                  {skickaInMetod === opt.value && (
                    <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mt-4" style={{ backgroundColor: '#F8FAFC' }}>
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-slate-400 leading-relaxed">
                Du kan alltid ladda upp filer direkt på <span className="font-medium text-slate-500">Enkla Bokslut</span> även om du mailar in dem.
              </p>
            </div>

            {error && (
              <p className="mt-4 text-xs text-red-500 text-center">{error}</p>
            )}

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Tillbaka
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={skickaInMetod === null || saving}
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

function ChipQuestion({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-2.5">{label}</p>
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
