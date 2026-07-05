'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

interface Question {
  id: string;
  text: string;
  disqualifyOn: boolean;
  reason: string;
  help: string;
}

const questions: Question[] = [
  { id: 'enskild', text: 'Driver du en enskild firma?', disqualifyOn: false, reason: 'Enkla Bokslut är byggt specifikt för enskilda firmor.', help: 'Aktiebolag, handelsbolag och andra företagsformer har andra regler och omfattas därför inte av tjänsten.' },
  { id: 'omsattning', text: 'Har din verksamhet en årsomsättning på högst 3 miljoner kronor?', disqualifyOn: false, reason: 'Vi riktar oss till enskilda firmor med en årsomsättning på högst 3 miljoner kronor.', help: 'Enkla Bokslut bygger på de förenklade regler som gäller för verksamheter med en årsomsättning på högst 3 miljoner kronor.' },
  { id: 'anstallda', text: 'Har du anställd personal?', disqualifyOn: true, reason: 'I dagsläget kan vi tyvärr inte hjälpa företag som har anställd personal.', help: 'Vi menar anställd personal. Att köpa tjänster från andra företag eller anlita underentreprenörer räknas inte som anställd personal.' },
  { id: 'skog', text: 'Bedriver du skogs- eller lantbruksverksamhet?', disqualifyOn: true, reason: 'Vi kan tyvärr inte hjälpa skogs- eller lantbruksverksamhet.', help: 'Skogs- och lantbruksverksamheter omfattas av särskilda regler, till exempel kring skogskonto, skogsavdrag och andra skatteregler. Därför omfattas de inte av Enkla Bokslut.' },
  { id: 'taxi', text: 'Driver du taxi- eller annan yrkesmässig persontransport?', disqualifyOn: true, reason: 'Vi kan tyvärr inte hjälpa taxiverksamhet.', help: 'Taxi- och persontransportverksamheter har särskilda regler för bland annat kassahantering, redovisning och beskattning. Därför omfattas de inte av Enkla Bokslut.' },
  { id: 'vmb', text: 'Använder din verksamhet vinstmarginalbeskattning (VMB)?', disqualifyOn: true, reason: 'Vi kan tyvärr inte hjälpa verksamheter som använder vinstmarginalbeskattning (VMB).', help: 'Vi syftar på verksamheter som handlar med exempelvis begagnade bilar, konst, tavlor, antikviteter, samlarföremål eller andra begagnade varor där vinstmarginalbeskattning (VMB) kan användas. Dessa omfattas av särskilda momsregler som inte stöds av Enkla Bokslut.' },
  { id: 'utlandsmoms', text: 'Redovisar du moms i något annat land än Sverige, eller använder du OSS (One Stop Shop)?', disqualifyOn: true, reason: 'Enkla Bokslut är utvecklat för företag som endast redovisar svensk moms. Redovisning i flera länder innebär andra regler och deklarationer som inte ingår i tjänsten.', help: 'Osäker? Den här frågan gäller främst företag som säljer till privatpersoner i andra EU-länder eller är momsregistrerade utanför Sverige.' },
];

export default function KvalificeraPage() {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<'pass' | 'fail' | null>(null);
  const [failReason, setFailReason] = useState('');

  const answer = (value: boolean) => {
    const q = questions[step];
    if (value === q.disqualifyOn) {
      setFailReason(q.reason);
      setResult('fail');
      return;
    }
    if (step + 1 >= questions.length) {
      setResult('pass');
    } else {
      setStep(step + 1);
    }
  };

  const restart = () => {
    setStep(0);
    setResult(null);
    setFailReason('');
  };

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-10 sm:p-12 text-center shadow-sm">
          <h1 className="text-3xl font-extrabold mb-6" style={{ color: NAV_BG }}>EnklaBokslut passar inte alla – och det är medvetet.</h1>
          <p className="text-slate-500 text-base leading-relaxed mb-10">Vi har byggt tjänsten för enskilda firmor med enklare bokföring. Genom att fokusera på en tydlig målgrupp kan vi erbjuda en tjänst som är enklare, snabbare och mer prisvärd. Svara på några korta frågor så ser vi om Enkla Bokslut passar din verksamhet.</p>
          <button
            onClick={() => setStarted(true)}
            className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.01]"
            style={{ backgroundColor: NAV_BG, boxShadow: `0 8px 20px ${NAV_BG}40` }}
          >
            Starta →
          </button>
          <Link href="/" className="block mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            ← Tillbaka till startsidan
          </Link>
        </div>
      </div>
    );
  }

  if (result === 'pass') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: `linear-gradient(180deg, ${NAV_BG}10, #f8fafc 55%)` }}>
        <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-12 sm:p-14 text-center shadow-xl relative overflow-hidden">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#ECFDF5' }}>
            <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4" style={{ color: NAV_BG }}>Grattis!</h1>
          <p className="text-slate-500 text-base sm:text-lg leading-relaxed mb-10">Enkla Bokslut passar dig perfekt. Nu kan du välja hur du vill betala.</p>
          <button
            onClick={() => router.push('/skaffa')}
            className="w-full py-5 rounded-2xl font-bold text-base text-white transition-all duration-200 hover:scale-[1.02]"
            style={{ backgroundColor: CORAL, boxShadow: `0 12px 28px ${CORAL}50` }}
          >
            Fortsätt →
          </button>
          <Link href="/" className="block mt-5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            ← Tillbaka till startsidan
          </Link>
        </div>
      </div>
    );
  }

  if (result === 'fail') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#FEF2F2' }}>
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: NAV_BG }}>Tyvärr</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">{failReason}</p>
          <Link
            href="/kontakt"
            className="flex w-full items-center justify-center gap-2 px-5 py-4 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: NAV_BG }}
          >
            Kontakta oss
          </Link>
          <button onClick={restart} className="block w-full mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Svara igen
          </button>
        </div>
      </div>
    );
  }

  const q = questions[step];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Fixed-height intro area so the question/buttons below always land at the same height */}
        <div className="h-[240px] flex flex-col justify-start text-center mb-8">
          {step === 0 && (
            <>
              <p className="font-bold text-lg mb-2.5" style={{ color: NAV_BG }}>Driver du en enskild firma?</p>
              <p className="text-slate-500 text-base leading-relaxed">Vi fokuserar enbart på enskilda firmor. Det gör att vi kan använda de förenklade reglerna och erbjuda en enklare och mer prisvärd tjänst.</p>
            </>
          )}

          {step === 1 && (
            <>
              <p className="font-bold text-lg mb-2.5" style={{ color: NAV_BG }}>Har din verksamhet en årsomsättning under 3 miljoner kronor?</p>
              <p className="text-slate-500 text-base leading-relaxed">De förenklade reglerna gäller endast för enskilda firmor med en årsomsättning på högst 3 miljoner kronor. Har du en högre omsättning behöver du följa ett annat regelverk, och då passar EnklaBokslut tyvärr inte.</p>
            </>
          )}

          {step === 2 && (
            <>
              <p className="font-bold text-lg mb-2.5" style={{ color: NAV_BG }}>Har du anställd personal?</p>
              <p className="text-slate-500 text-base leading-relaxed">Vi fokuserar på enskilda firmor utan anställda. Anställd personal innebär bland annat lönehantering, arbetsgivardeklarationer och fler regler att ta hänsyn till. Genom att rikta oss till företag utan anställda kan vi hålla tjänsten enkel, effektiv och prisvärd.</p>
            </>
          )}

          {step === 3 && (
            <>
              <p className="font-bold text-lg mb-2.5" style={{ color: NAV_BG }}>Bedriver du skogs- eller lantbruksverksamhet?</p>
              <p className="text-slate-500 text-base leading-relaxed">Skogs- och lantbruksverksamheter omfattas ofta av särskilda skatte- och bokföringsregler. För att kunna erbjuda en enkel och trygg tjänst riktar vi oss därför inte till dessa verksamheter.</p>
            </>
          )}

          {step === 4 && (
            <>
              <p className="font-bold text-lg mb-2.5" style={{ color: NAV_BG }}>Driver du taxi- eller annan yrkesmässig persontransport?</p>
              <p className="text-slate-500 text-base leading-relaxed">Persontransportverksamheter har ofta särskilda regler och en mer omfattande redovisning. För att hålla tjänsten enkel och prisvärd omfattas de inte av Enkla Bokslut.</p>
            </>
          )}

          {step === 5 && (
            <>
              <p className="font-bold text-lg mb-2.5" style={{ color: NAV_BG }}>Använder din verksamhet vinstmarginalbeskattning (VMB)?</p>
              <p className="text-slate-500 text-base leading-relaxed">Vinstmarginalbeskattning används vid handel med exempelvis begagnade bilar, konst, antikviteter och andra begagnade varor. Eftersom det innebär särskilda momsregler passar dessa verksamheter inte för Enkla Bokslut.</p>
            </>
          )}

          {step === 6 && (
            <>
              <p className="font-bold text-lg mb-2.5" style={{ color: NAV_BG }}>Redovisar du moms i något annat land än Sverige, eller använder du OSS (One Stop Shop)?</p>
              <p className="text-slate-500 text-base leading-relaxed">Enkla Bokslut är utvecklat för företag som endast redovisar svensk moms. Redovisning i andra länder eller via OSS innebär särskilda momsregler som inte ingår i tjänsten.</p>
            </>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-8">
          {questions.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-colors"
              style={{ backgroundColor: i <= step ? NAV_BG : '#e2e8f0' }}
            />
          ))}
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: CORAL }}>
          Fråga {step + 1} av {questions.length}
        </p>
        <div className="h-[92px] flex items-center justify-center mb-10">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-center leading-snug" style={{ color: NAV_BG }}>{q.text}</h2>
            <div className="relative group flex-shrink-0">
              <button
                type="button"
                aria-label="Förklaring"
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors hover:bg-slate-100"
                style={{ borderColor: NAV_BG, color: NAV_BG }}
              >
                ?
              </button>
              <div
                className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 w-64 -translate-x-1/2 scale-95 rounded-xl p-3 text-xs leading-relaxed text-white opacity-0 shadow-xl transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
                style={{ backgroundColor: NAV_BG }}
              >
                {q.help}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => answer(true)}
            className="flex-1 py-5 rounded-2xl border-[3px] font-bold text-base transition-all duration-150 border-slate-400 bg-white hover:border-slate-500 hover:bg-slate-50"
            style={{ color: NAV_BG }}
          >
            Ja
          </button>
          <button
            onClick={() => answer(false)}
            className="flex-1 py-5 rounded-2xl border-[3px] font-bold text-base transition-all duration-150 border-slate-400 bg-white hover:border-slate-500 hover:bg-slate-50"
            style={{ color: NAV_BG }}
          >
            Nej
          </button>
        </div>

        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="block w-full mt-6 text-sm text-slate-400 hover:text-slate-600 transition-colors text-center">
            ← Föregående fråga
          </button>
        )}
      </div>
    </div>
  );
}
