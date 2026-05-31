'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const mainReports = [
  {
    href: '/rapporter/resultatrapport',
    title: 'Resultatrapport',
    desc: 'Vinst eller förlust under perioden.',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    href: '/rapporter/balansrapport',
    title: 'Balansrapport',
    desc: 'Vad du äger och vad du är skyldig.',
    icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    href: '/rapporter/momsredovisning',
    title: 'Momsredovisning',
    desc: 'Moms att betala eller få tillbaka.',
    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    href: '/rapporter/transaktionslista',
    title: 'Transaktionslista',
    desc: 'Alla händelser i en sökbar lista.',
    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
    color: '#0891B2',
    bg: '#ECFEFF',
  },
  {
    href: '/rapporter/kontosaldo',
    title: 'Kontosaldo',
    desc: 'Siffror bakom alla rapporter.',
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    color: '#B45309',
    bg: '#FEF3C7',
  },
  {
    href: '/rapporter/historik',
    title: 'Historik',
    desc: 'Rapporter från tidigare år.',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    color: '#475569',
    bg: '#F1F5F9',
  },
];

const FRAGE_COLOR = '#2563EB';
const FRAGE_BG = '#EFF6FF';

const bokslutQuestions = [
  {
    id: 1,
    question: 'Har du skickat underlag för alla pengar som kommit in och gått ut från företaget?',
    jaText: 'Bra! Då har vi det vi behöver för att bokföra rätt.',
    nejText: 'Skicka in dina underlag så kan vi hjälpa dig att få allt på plats.',
    vetInteText: 'Underlag är kvitton, fakturor och bankutdrag som visar vad som hänt i företaget. Är du osäker på om du har allt — skicka in det du har så hjälper vi dig identifiera vad som eventuellt saknas.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    id: 2,
    question: 'Vill du att vi gör din momsredovisning?',
    jaText: 'Toppen! Ingår i tjänsten — vi sköter det åt dig.',
    nejText: 'Ok, du sköter momsredovisningen själv.',
    vetInteText: 'Om ditt företag är momsregistrerat ska moms redovisas till Skatteverket. Det ingår i tjänsten, så om du är osäker rekommenderar vi att vi sköter det åt dig.',
    badge: 'Ingår',
    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
  },
  {
    id: 3,
    question: 'Har du lager?',
    jaText: 'Notera lagervärdet vid årets slut så tar vi med det i bokslutet.',
    nejText: 'Inga problem, vi hoppar över den delen.',
    vetInteText: 'Lager är varor du köpt in för att sälja, eller material i din produktion. Har du produkter hemma eller i ett förråd som väntar på att säljas — då har du förmodligen lager.',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    id: 4,
    question: 'Har företaget köpt datorer, verktyg, maskiner eller annan utrustning som fortfarande används i verksamheten?',
    jaText: 'Bra att veta! Vi tar med det i bokslutet och beräknar eventuella avskrivningar.',
    nejText: 'Ok, inga inventarier att ta hänsyn till.',
    vetInteText: 'Inventarier är utrustning som används i verksamheten och kostar mer än ca 29 000 kr. Billigare saker bokförs direkt som kostnad. Är du osäker — lista vad ni köpt så hjälper vi dig bedöma vad som räknas.',
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    id: 5,
    question: 'Gäller någon kostnad eller inkomst ett annat år?',
    jaText: 'Vi hjälper dig att periodisera rätt så att bokslutet stämmer.',
    nejText: 'Bra, då behöver vi inte göra några periodiseringar.',
    vetInteText: 'Det kan vara svårt att veta! Till exempel: om du betalar en försäkring i december som gäller hela nästa år ska den kostnaden delas upp — en del på det här året, en del på nästa. Samma sak om du fakturerar i december för jobb du gör i januari. Det kallas periodisering. Är du osäker hjälper vi dig att gå igenom det.',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 6,
    question: 'Är det första året du gör bokslut för din firma?',
    jaText: 'Välkommen! Vi börjar från noll — inget tidigare underlag behövs.',
    nejText: 'Bra! Skicka in förra årets NE-bilaga och resultat- och balansrapport så kan vi göra ett korrekt bokslut.',
    vetInteText: 'Du kan kontrollera startdatumet hos Skatteverket under Mina sidor. Är det en enskild firma brukar du minnas när du registrerade den. Hör av dig om du är osäker.',
    icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  },
];

const year = new Date().getFullYear();

type View = null | 'rapporter' | 'bokslut';

export default function RapporterLandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get('v') as View) ?? null;

  const setView = (v: View) => {
    if (v === null) router.push('/rapporter');
    else router.push(`/rapporter?v=${v}`);
  };

  const [answers, setAnswers] = useState<Record<number, 'ja' | 'nej' | 'vetinte'>>({});
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAnswers({});
    setSelectedAction(null);
  }, [view]);

  useEffect(() => {
    if (selectedAction && confirmRef.current) {
      confirmRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedAction]);

  const answer = (id: number, val: 'ja' | 'nej' | 'vetinte') =>
    setAnswers(prev => prev[id] === val ? { ...prev, [id]: undefined as any } : { ...prev, [id]: val });

  const progress = Math.round((Object.keys(answers).length / bokslutQuestions.length) * 100);

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* Header */}
      <div className="px-8 pt-12 pb-4 flex items-start justify-between flex-shrink-0">
        <div className="flex items-start gap-3">
          {view && (
            <button
              onClick={() => setView(null)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600 flex-shrink-0 mt-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              {view === 'rapporter' ? 'Rapporter' : view === 'bokslut' ? 'Bokslut' : 'Rapporter & Bokslut'}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Räkenskapsår {year} · Uppdateras automatiskt</p>
          </div>
        </div>
        {view === 'bokslut' && (
          <div className="flex items-center gap-3 mt-2">
            <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#22c55e' : CORAL }}
              />
            </div>
            <span className="text-xs font-medium text-slate-400">{Object.keys(answers).length}/{bokslutQuestions.length}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">

          {/* Startvy */}
          {view === null && (
            <div className="grid grid-cols-2 gap-[4.5rem] h-full">

              {/* Rapporter-kort */}
              <button
                onClick={() => setView('rapporter')}
                className="group text-left bg-white rounded-2xl border border-slate-200 p-9 hover:border-blue-200 hover:shadow-lg transition-all duration-200 relative overflow-hidden w-full flex flex-col"
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 55%)' }}
                />
                <div className="relative flex flex-col h-full">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-xl font-extrabold text-slate-800 mb-2">Rapporter</p>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6 min-h-[3rem]">
                    Se hur din ekonomi ser ut just nu — alltid uppdaterat.
                  </p>
                  <div className="space-y-2">
                    {mainReports.map(r => (
                      <div key={r.href} className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-400" />
                        {r.title}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-auto pt-8 text-sm font-semibold text-blue-600">
                    Öppna rapporter
                    <svg className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Bokslut-kort */}
              <button
                onClick={() => setView('bokslut')}
                className="group text-left bg-white rounded-2xl border border-slate-200 p-9 hover:border-emerald-200 hover:shadow-lg transition-all duration-200 relative overflow-hidden w-full flex flex-col"
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 55%)' }}
                />
                <div className="relative flex flex-col h-full">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <p className="text-xl font-extrabold text-slate-800 mb-2">Bokslut</p>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6 min-h-[3rem]">
                    Här avslutar du ditt år — steg för steg fram till inlämnad deklaration.
                  </p>
                  <div className="space-y-2">
                    {['Stäm av transaktioner', 'Kontrollera moms', 'Ladda ned NE-bilaga', 'Lämna in deklaration'].map(r => (
                      <div key={r} className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        {r}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-auto pt-8 text-sm font-semibold text-emerald-600">
                    Starta bokslut
                    <svg className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Rapporter-vy */}
          {view === 'rapporter' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mainReports.map(r => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="group flex items-center gap-5 bg-white rounded-2xl border border-slate-200 px-7 py-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: r.bg }}>
                    <svg className="w-7 h-7" style={{ color: r.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={r.icon} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-800">{r.title}</p>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{r.desc}</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}

          {/* Bokslut-vy */}
          {view === 'bokslut' && (
            <div className="space-y-3">
              {/* Förklarande intro */}
              <div className="bg-white rounded-2xl border border-slate-200 px-7 py-6 mb-2">
                <p className="text-sm font-semibold text-slate-700 mb-2">Vad är ett bokslut?</p>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Bokslut innebär att du sammanställer allt som påverkat företaget ekonomiskt under året. Det ger dig en tydlig bild av hur det gått och är grunden för din deklaration till Skatteverket.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    'Alla intäkter och kostnader bokförda',
                    'Momsredovisning',
                    'Tillgångar och skulder kontrollerade',
                    'NE-bilaga klar för deklaration',
                  ].map(item => (
                    <span key={item} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              {bokslutQuestions.map(q => {
                const ans = answers[q.id];
                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 ${ans ? 'border-slate-200' : 'border-slate-200'}`}
                  >
                    <div className="px-6 py-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: FRAGE_BG }}>
                          <svg className="w-5 h-5" style={{ color: FRAGE_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={q.icon} />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3">
                            <p className="text-sm font-semibold text-slate-800 leading-snug">{q.question}</p>
                            {q.badge && (
                              <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: FRAGE_BG, color: FRAGE_COLOR }}>
                                {q.badge}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => answer(q.id, 'ja')}
                              className="px-4 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all duration-150"
                              style={ans === 'ja'
                                ? { backgroundColor: FRAGE_COLOR, borderColor: FRAGE_COLOR, color: 'white' }
                                : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#64748b' }
                              }
                            >
                              Ja
                            </button>
                            <button
                              onClick={() => answer(q.id, 'nej')}
                              className="px-4 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all duration-150"
                              style={ans === 'nej'
                                ? { backgroundColor: FRAGE_COLOR, borderColor: FRAGE_COLOR, color: 'white' }
                                : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#64748b' }
                              }
                            >
                              Nej
                            </button>
                            <button
                              onClick={() => answer(q.id, 'vetinte')}
                              className="px-4 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all duration-150"
                              style={ans === 'vetinte'
                                ? { backgroundColor: FRAGE_COLOR, borderColor: FRAGE_COLOR, color: 'white' }
                                : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#64748b' }
                              }
                            >
                              Vet inte
                            </button>
                          </div>
                          {ans && (
                            <div className="mt-3">
                              <p className="text-sm text-slate-500 leading-relaxed">
                                {ans === 'ja' ? q.jaText : ans === 'vetinte' ? q.vetInteText : q.nejText}
                              </p>
                              {ans === 'nej' && q.id === 1 && (
                                <Link
                                  href="/rapporter/bokslut/underlag"
                                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                                  style={{ backgroundColor: FRAGE_COLOR }}
                                >
                                  Hjälp mig komma igång
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </Link>
                              )}
                              {ans === 'ja' && q.id === 3 && (
                                <Link
                                  href="/rapporter/bokslut/lager"
                                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                                  style={{ backgroundColor: FRAGE_COLOR }}
                                >
                                  Hjälp mig redovisa lagret
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </Link>
                              )}
                              {ans === 'ja' && q.id === 4 && (
                                <Link
                                  href="/rapporter/bokslut/inventarier"
                                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                                  style={{ backgroundColor: FRAGE_COLOR }}
                                >
                                  Hjälp mig fylla i inventarielistan
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </Link>
                              )}
                              {ans === 'ja' && q.id === 5 && (
                                <Link
                                  href="/rapporter/bokslut/periodisering"
                                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                                  style={{ backgroundColor: FRAGE_COLOR }}
                                >
                                  Hjälp mig periodisera rätt
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </Link>
                              )}
                              {ans === 'nej' && q.id === 6 && (
                                <Link
                                  href="/rapporter/bokslut/forraaret"
                                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                                  style={{ backgroundColor: FRAGE_COLOR }}
                                >
                                  Skicka in förra årets dokument
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Åtgärdsknappar */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  {
                    label: 'Gör klart och lämna in',
                    desc: 'Vi färdigställer bokslutet och lämnar in till Skatteverket åt dig.',
                  },
                  {
                    label: 'Gör klart och skicka för godkännande',
                    desc: 'Vi skickar resultatet till dig för granskning innan vi lämnar in.',
                  },
                  {
                    label: 'Gör klart och skicka till mig',
                    desc: 'Du får resultatet och lämnar själv in till Skatteverket.',
                  },
                ].map(btn => {
                  const isSelected = selectedAction === btn.label;
                  return (
                    <button
                      key={btn.label}
                      onClick={() => setSelectedAction(isSelected ? null : btn.label)}
                      className="flex flex-col items-start text-left rounded-2xl border-2 px-5 py-5 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
                      style={{
                        backgroundColor: 'white',
                        borderColor: isSelected ? FRAGE_COLOR : '#e2e8f0',
                        color: '#1e293b',
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center mb-3 transition-all duration-150"
                        style={{
                          borderColor: isSelected ? FRAGE_COLOR : '#cbd5e1',
                          backgroundColor: isSelected ? FRAGE_COLOR : 'white',
                        }}
                      >
                        {isSelected && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <p className="text-sm font-bold leading-snug mb-1.5">{btn.label}</p>
                      <p className="text-xs leading-relaxed text-slate-500">{btn.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Bekräftelse vid valt alternativ */}
              {selectedAction && (
                <div ref={confirmRef} className="flex items-start gap-4 bg-blue-50 border border-blue-200 rounded-2xl px-6 py-5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: FRAGE_COLOR }}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-900 mb-0.5">Tack för ditt val!</p>
                    <p className="text-sm text-blue-700 leading-relaxed">
                      Du har valt <span className="font-semibold">"{selectedAction}"</span> — vi återkommer till dig via mail inom kort.
                    </p>
                  </div>
                </div>
              )}

              {Object.keys(answers).length === bokslutQuestions.length && (
                <div className="mt-2 flex items-center gap-4 bg-green-50 border border-green-200 rounded-2xl px-6 py-5">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-800">Tack! Vi har fått all information vi behöver.</p>
                    <p className="text-xs text-green-600 mt-0.5">Vi återkommer till dig med nästa steg.</p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
