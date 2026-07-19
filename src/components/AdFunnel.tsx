'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { questions } from '@/data/kvalificera-questions';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

// White body, navy headings, slate body copy — the same language /kvalificera
// and the brev-popup already use. Coral is spent only on the one action that
// moves you forward each screen; everything else reads like the rest of the site.
const TRACK = '#e2e8f0';
const NAV_TINT = `${NAV_BG}14`;

// Every stage fills this on desktop, so the card holds its size regardless of
// how much text a given stage has — no jumping between a tall "hook" and a
// short "how it works".
const DESKTOP_MIN_H = 'sm:min-h-[600px]';

// Each ad variant shows a different photo as its "next frame" — same funnel,
// same copy, just the hook image swapped so it lines up with the specific ad.
const HOOK_IMAGES: Record<string, string> = {
  'fb-pris': '/vinkafacebook.png',
  'fb-b': '/popup1.png',
  'fb-c': '/popup2.png',
  'fb-d': '/popup3.png',
};
const DEFAULT_HOOK_IMAGE = '/vinkafacebook.png';

const howItWorks = [
  { t: 'Du mejlar in dina underlag', d: 'Kvitton och fakturor, precis som de ser ut.' },
  { t: 'Vi sköter resten', d: 'Bokföring, moms och bokslut — allt ingår.' },
  { t: 'Vi lämnar in till Skatteverket', d: 'Deklarationen är klar. Du gör inget mer.' },
];

function Check({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** Top-left back / top-right close controls. Dark-on-photo for the hook stage, light-on-white everywhere else. */
function TopControl({ onClick, label, dark, children }: { onClick: () => void; label: string; dark: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`pointer-events-auto w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors ${
        dark ? 'bg-black/25 text-white/80 hover:text-white hover:bg-black/40' : 'bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

type Stage = 'hook' | 'how' | 'questions' | 'contact' | 'done' | 'fail';

// "Så funkar det"-steget är tillfälligt avstängt: hooken tappade sex gånger
// fler besökare än kontaktformuläret, och ett mellansteg till innan frågorna
// gjorde vägen längre utan att tillföra något de inte redan läst. Sätt till
// true för att ta tillbaka det — steget självt ligger kvar orört nedan.
const SHOW_HOW_STAGE = false;

// Hur långt in i kontaktformuläret besökaren hann. Ordningen är själva poängen:
// vi sparar bara den längsta punkt de nått, så ett avhopp går att läsa som
// "de fyllde i namn och mejl men vände vid telefonnumret".
const CONTACT_PROGRESS = ['opened', 'name', 'email', 'method', 'phone', 'notes'] as const;
type ContactProgress = (typeof CONTACT_PROGRESS)[number];

export default function AdFunnel({ refCode, onClose, source = 'annons', showDeadlineOffer = false, visitId = null }: { refCode: string | null; onClose?: () => void; source?: 'annons' | 'brev' | 'organic'; showDeadlineOffer?: boolean; visitId?: number | null }) {
  const [stage, setStage] = useState<Stage>('hook');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean | 'unknown'>>({});
  const [failReason, setFailReason] = useState('');

  // Records how far this visitor got, on the same qr_visits row logged when
  // the popup was shown — lets us see where people drop off per code.
  const track = useCallback(
    (payload: Record<string, unknown>) => {
      if (!visitId) return;
      fetch('/api/qr-track', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: visitId, ...payload }),
        // Avhoppen är själva det vi mäter, så sista requesten måste överleva
        // att fliken stängs.
        keepalive: true,
      }).catch(() => {});
    },
    [visitId]
  );

  useEffect(() => {
    const payload: Record<string, unknown> = { stage };

    // För 'questions' är steget där de stannade; för 'fail' är det frågan som
    // diskvalificerade dem — det senare säger vilket kriterium som sållar bort
    // annonsens publik.
    if (stage === 'questions' || stage === 'fail') payload.step = step;

    if (stage === 'contact') {
      payload.contactProgress = 'opened';
      payload.isMobile = window.matchMedia('(max-width: 640px)').matches;
      // Testar hypotesen att tangentbordet skymmer skicka-knappen.
      payload.viewportH = Math.round(window.innerHeight);
    }

    track(payload);
  }, [stage, step, track]);

  // Bara framsteg sparas, aldrig ett kliv bakåt — annars skulle en besökare som
  // hoppar tillbaka till namnfältet se ut att ha kommit kortare än de gjorde.
  const progressRef = useRef<ContactProgress>('opened');
  const markProgress = (p: ContactProgress) => {
    if (CONTACT_PROGRESS.indexOf(p) <= CONTACT_PROGRESS.indexOf(progressRef.current)) return;
    progressRef.current = p;
    track({ contactProgress: p });
  };

  const failedSubmits = useRef(0);
  const markFailedSubmit = () => {
    failedSubmits.current += 1;
    track({ submitAttempts: failedSubmits.current });
  };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const answer = (value: boolean) => {
    const q = questions[step];
    setAnswers({ ...answers, [q.id]: value });

    if (value === q.disqualifyOn) {
      setFailReason(q.reason);
      setStage('fail');
      return;
    }
    if (step + 1 >= questions.length) setStage('contact');
    else setStep(step + 1);
  };

  // "Vet inte" never disqualifies — Erik reads these answers by hand in the
  // lead notification, so an unsure visitor still gets through to the form.
  const answerUnknown = () => {
    const q = questions[step];
    setAnswers({ ...answers, [q.id]: 'unknown' });
    if (step + 1 >= questions.length) setStage('contact');
    else setStep(step + 1);
  };

  const back = () => {
    if (stage === 'how') setStage('hook');
    else if (stage === 'questions' && step === 0) setStage(SHOW_HOW_STAGE ? 'how' : 'hook');
    else if (stage === 'questions') setStep(step - 1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/valkommen-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Inget contactMethod: popupen frågar inte längre om preferens, och
        // att gissa åt besökaren hade blivit fel i notismailet.
        body: JSON.stringify({ name, email, phone, notes, ref: refCode, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Något gick fel');
      setStage('done');
    } catch (err: any) {
      setSendError(err.message || 'Något gick fel. Försök igen.');
      markFailedSubmit();
    } finally {
      setSending(false);
    }
  };

  const showBack = stage === 'how' || stage === 'questions';
  const onPhoto = stage === 'hook';
  const hookImage = (refCode && HOOK_IMAGES[refCode]) || DEFAULT_HOOK_IMAGE;

  return (
    <div
      className={`relative w-full rounded-3xl shadow-2xl overflow-hidden bg-white border border-slate-200 sm:flex sm:flex-col ${DESKTOP_MIN_H}`}
    >
      {/* Top controls float above whatever the stage renders */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
        {showBack ? (
          <TopControl onClick={back} label="Tillbaka" dark={onPhoto}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </TopControl>
        ) : <span />}

        {onClose && (
          <TopControl onClick={onClose} label="Stäng" dark={onPhoto}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </TopControl>
        )}
      </div>

      {/* ── Kroken: annonsens nästa bildruta, sen vitt precis som resten av sajten ── */}
      {stage === 'hook' && (
        <div className="sm:flex-1 sm:flex sm:flex-col sm:min-h-0">
          <div className="relative h-40 sm:h-48 flex-shrink-0">
            <Image src={hookImage} alt="" fill priority className="object-cover object-[62%_26%]" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, #ffffff 0%, rgba(255,255,255,0) 22%)' }} />
          </div>

          <div className="px-6 sm:px-9 pt-5 pb-7 sm:pb-9 sm:flex-1 sm:flex sm:flex-col sm:justify-center">
            {source !== 'organic' && (
              <span
                className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full text-xs font-semibold mb-4"
                style={{ backgroundColor: NAV_BG, color: '#fff' }}
              >
                {source === 'brev' ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-5m-1.5-9.5a2.121 2.121 0 013 3L12 12l-4 1 1-4 8.5-8.5z" />
                  </svg>
                )}
                {source === 'brev' ? 'Du kom hit via vårt brev' : 'Du kom hit via vår annons'}
              </span>
            )}

            <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-5" style={{ color: NAV_BG }}>
              Du mejlar in dina underlag. Vi sköter resten.
            </h2>

            <div className="flex items-end gap-2 mb-5">
              <span className="text-5xl sm:text-6xl font-extrabold leading-none" style={{ color: CORAL }}>299</span>
              <span className="text-base sm:text-lg font-bold mb-1 text-slate-500">kr/mån</span>
            </div>

            <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:gap-y-3 mb-5">
              {['Bokföring', 'Moms', 'Bokslut', 'Deklaration'].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span
                    className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: NAV_TINT, color: NAV_BG }}
                  >
                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </span>
                  <span className="text-sm sm:text-base font-semibold" style={{ color: NAV_BG }}>{item}</span>
                </li>
              ))}
            </ul>

            {showDeadlineOffer && (
              <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: `${CORAL}14`, border: `1px solid ${CORAL}40` }}>
                <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="none" stroke={CORAL} strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm sm:text-base font-bold leading-tight" style={{ color: CORAL }}>Registrera dig senast 31 augusti 2026</p>
                  <p className="text-xs sm:text-sm text-slate-500">Vi sköter hela årets redovisning för 2026 — du betalar först från september.</p>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 z-10 pt-3 pb-1 bg-white border-t border-slate-100 sm:static sm:pt-0 sm:pb-0 sm:bg-transparent sm:border-t-0 sm:mt-auto">
              <button
                onClick={() => setStage(SHOW_HOW_STAGE ? 'how' : 'questions')}
                className="w-full py-4 sm:py-5 rounded-xl font-bold text-white text-[15px] sm:text-base transition-all duration-200 hover:opacity-90 hover:scale-[1.01]"
                style={{ backgroundColor: NAV_BG, boxShadow: `0 10px 24px ${NAV_BG}40` }}
              >
                Ja, kolla om det passar →
              </button>
              <p className="text-center text-xs sm:text-sm mt-3 text-slate-400">
                {questions.length} snabba frågor · Tar under en minut · Ingen betalning
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Genomgången: kort, tre led, mail-in-historien ── */}
      {stage === 'how' && (
        <div className="px-6 sm:px-9 pt-14 sm:pt-16 pb-7 sm:pb-9 sm:flex-1 sm:flex sm:flex-col sm:justify-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.15em] mb-2" style={{ color: CORAL }}>Så funkar det</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-6 sm:mb-8" style={{ color: NAV_BG }}>Du mejlar in. Vi gör resten.</h2>

          <div className="space-y-4 sm:space-y-5 mb-7 sm:mb-9">
            {howItWorks.map((s, i) => (
              <div key={s.t} className="flex items-start gap-3.5">
                <span
                  className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold text-white"
                  style={{ backgroundColor: NAV_BG }}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-[15px] sm:text-base font-bold leading-snug" style={{ color: NAV_BG }}>{s.t}</p>
                  <p className="text-sm sm:text-base leading-relaxed mt-0.5 text-slate-500">{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 z-10 pt-3 pb-1 bg-white border-t border-slate-100 sm:static sm:pt-0 sm:pb-0 sm:bg-transparent sm:border-t-0 sm:mt-auto">
            <button
              onClick={() => setStage('questions')}
              className="w-full py-4 sm:py-5 rounded-xl font-bold text-white text-[15px] sm:text-base transition-all duration-200 hover:opacity-90 hover:scale-[1.01]"
              style={{ backgroundColor: NAV_BG, boxShadow: `0 10px 24px ${NAV_BG}40` }}
            >
              Se om det passar min firma →
            </button>
            <p className="text-center text-xs sm:text-sm mt-3 text-slate-400">
              {questions.length} korta ja/nej-frågor
            </p>
          </div>
        </div>
      )}

      {/* ── Kvalificeringen — i popupen, inte på en egen sida ── */}
      {stage === 'questions' && (() => {
        const q = questions[step];
        return (
          <div className="px-6 sm:px-9 pt-14 sm:pt-16 pb-7 sm:pb-9 sm:flex-1 sm:flex sm:flex-col">
            <div className="flex items-center gap-1.5 mb-5 sm:mb-7">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-1 sm:h-1.5 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: i <= step ? NAV_BG : TRACK }}
                />
              ))}
            </div>

            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.1em] mb-4" style={{ color: NAV_BG }}>
              Fråga {step + 1} av {questions.length}
            </p>

            <div className="sm:min-h-[120px]">
              <h2 className="text-xl sm:text-3xl font-extrabold leading-snug mb-2.5 sm:mb-4" style={{ color: NAV_BG }}>{q.text}</h2>
              <p className="text-sm sm:text-base leading-relaxed text-slate-500">{q.help}</p>
            </div>

            <div className="sticky bottom-0 z-10 mt-6 pt-3 pb-1 bg-white border-t border-slate-100 sm:static sm:mt-auto sm:pt-8 sm:pb-0 sm:bg-transparent sm:border-t-0">
              <div className="flex gap-3">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    onClick={() => answer(value)}
                    className="flex-1 py-4 sm:py-5 rounded-xl border-[3px] font-bold text-base sm:text-lg transition-all duration-150 border-slate-400 bg-white hover:border-slate-500 hover:bg-slate-50"
                    style={{ color: NAV_BG }}
                  >
                    {value ? 'Ja' : 'Nej'}
                  </button>
                ))}
              </div>

              <button
                onClick={answerUnknown}
                className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                Vet inte — fortsätt ändå
              </button>

              <button
                onClick={back}
                className="block w-full mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors text-center"
              >
                {step === 0 ? '← Tillbaka' : '← Föregående fråga'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Kontaktuppgifter ── */}
      {stage === 'contact' && (
        <div className="px-6 sm:px-9 pt-10 sm:pt-16 pb-5 sm:pb-9 sm:flex-1 sm:flex sm:flex-col sm:justify-center">
          <div className="flex items-center gap-3 mb-3 sm:mb-5">
            <span
              className="flex-shrink-0 w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#ECFDF5' }}
            >
              <Check className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-500" />
            </span>
            <h2 className="text-xl sm:text-3xl font-extrabold leading-tight" style={{ color: NAV_BG }}>Du passar!</h2>
          </div>

          <p className="text-sm sm:text-base leading-relaxed mb-3 sm:mb-7 text-slate-500">
            Lämna dina uppgifter så hör vi av oss och berättar mer. Sen bestämmer du i lugn och ro om det känns rätt.
          </p>

          <form onSubmit={submit} className="space-y-2.5 sm:space-y-4">
            {([
              { label: 'Namn', value: name, set: setName, type: 'text', autoComplete: 'name', progress: 'name' as const },
              { label: 'E-post', value: email, set: setEmail, type: 'email', autoComplete: 'email', progress: 'email' as const },
            ]).map((f) => (
              <div key={f.label}>
                <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold mb-1 sm:mb-1.5 text-slate-600">
                  {f.label}
                </label>
                <input
                  type={f.type}
                  value={f.value}
                  required
                  autoComplete={f.autoComplete}
                  onChange={(e) => f.set(e.target.value)}
                  // Ett tomt fält som lämnas är inget framsteg — bara ifyllt räknas.
                  onBlur={() => { if (f.value.trim()) markProgress(f.progress); }}
                  className="w-full px-4 py-2.5 sm:py-3.5 rounded-xl text-base outline-none transition-colors bg-white border border-slate-200 focus:border-slate-400 placeholder:text-slate-300"
                  style={{ color: NAV_BG }}
                />
              </div>
            ))}

            <div>
              <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold mb-1 sm:mb-1.5 text-slate-600">
                Telefon
              </label>
              <input
                type="tel"
                value={phone}
                required
                autoComplete="tel"
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => { if (phone.trim()) markProgress('phone'); }}
                className="w-full px-4 py-2.5 sm:py-3.5 rounded-xl text-base outline-none transition-colors bg-white border border-slate-200 focus:border-slate-400 placeholder:text-slate-300"
                style={{ color: NAV_BG }}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold mb-1 sm:mb-1.5 text-slate-600">
                Anteckningar
                <span className="font-normal text-slate-400">· Frivilligt</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => { if (notes.trim()) markProgress('notes'); }}
                rows={2}
                placeholder="T.ex. något särskilt vi bör veta innan vi hör av oss"
                className="w-full px-4 py-2.5 sm:py-3.5 rounded-xl text-base outline-none transition-colors bg-white border border-slate-200 focus:border-slate-400 placeholder:text-slate-300 resize-none"
                style={{ color: NAV_BG }}
              />
            </div>

            <div className="sticky bottom-0 z-10 pt-2 pb-1 space-y-2 bg-white border-t border-slate-100 sm:static sm:pt-0 sm:pb-0 sm:space-y-0 sm:bg-transparent sm:border-t-0">
              {sendError && <p className="text-sm text-center" style={{ color: CORAL }}>{sendError}</p>}

              <button
                type="submit"
                disabled={sending}
                className="w-full py-3.5 sm:py-5 rounded-xl font-bold text-white text-[15px] sm:text-base transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: NAV_BG, boxShadow: `0 10px 24px ${NAV_BG}40` }}
              >
                {sending ? 'Skickar…' : 'Skicka — så hör vi av oss'}
              </button>
            </div>
          </form>

          <p className="text-center text-xs sm:text-sm mt-2 sm:mt-3 text-slate-400">
            Ingen betalning nu · Ingen bindningstid
          </p>
        </div>
      )}

      {/* ── Klart ── */}
      {stage === 'done' && (
        <div className="px-6 sm:px-9 pt-14 sm:pt-16 pb-9 text-center sm:flex-1 sm:flex sm:flex-col sm:justify-center">
          <span
            className="inline-flex w-14 h-14 sm:w-16 sm:h-16 rounded-full items-center justify-center mb-5 mx-auto"
            style={{ backgroundColor: '#ECFDF5' }}
          >
            <Check className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-500" />
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2.5" style={{ color: NAV_BG }}>Tack{name ? `, ${name.split(' ')[0]}` : ''}!</h2>
          <p className="text-sm sm:text-base leading-relaxed mb-5 text-slate-500">
            Vi har tagit emot din förfrågan och går igenom dina svar.
          </p>

          <div className="flex items-start gap-3 text-left rounded-xl px-4 py-3.5 mb-7 bg-slate-50 border border-slate-200">
            <span
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: NAV_TINT, color: NAV_BG }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </span>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: NAV_BG }}>
              Vi ringer dig{phone ? <> på <span className="font-semibold">{phone}</span></> : ''} inom kort. Då går vi igenom hur allt fungerar och stämmer av om det passar din verksamhet.
            </p>
          </div>
          {onClose ? (
            <button
              onClick={onClose}
              className="w-full py-3.5 sm:py-4 rounded-xl font-bold text-[15px] sm:text-base transition-colors border border-slate-200 hover:bg-slate-50"
              style={{ color: NAV_BG }}
            >
              Stäng och titta runt
            </button>
          ) : (
            <Link href="/" className="text-sm sm:text-base font-semibold text-slate-400 transition-colors hover:text-slate-600">
              ← Till startsidan
            </Link>
          )}
        </div>
      )}

      {/* ── Diskvalificerad ── */}
      {stage === 'fail' && (
        <div className="px-6 sm:px-9 pt-14 sm:pt-16 pb-9 text-center sm:flex-1 sm:flex sm:flex-col sm:justify-center">
          <span
            className="inline-flex w-14 h-14 sm:w-16 sm:h-16 rounded-2xl items-center justify-center mb-5 mx-auto"
            style={{ backgroundColor: '#FEF2F2' }}
          >
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2.5" style={{ color: NAV_BG }}>Tyvärr</h2>
          <p className="text-sm sm:text-base leading-relaxed mb-7 text-slate-500">{failReason}</p>

          <Link
            href="/kontakt"
            onClick={onClose}
            className="block w-full py-3.5 sm:py-4 rounded-xl font-bold text-white text-[15px] sm:text-base transition-opacity hover:opacity-90"
            style={{ backgroundColor: NAV_BG }}
          >
            Kontakta oss ändå
          </Link>
          <button
            onClick={() => { setStep(0); setAnswers({}); setFailReason(''); setStage('questions'); }}
            className="mt-3.5 text-sm sm:text-base text-slate-400 transition-colors hover:text-slate-600"
          >
            Svara igen
          </button>
        </div>
      )}
    </div>
  );
}
