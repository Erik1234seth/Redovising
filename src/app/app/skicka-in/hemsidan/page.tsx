'use client';

import Link from 'next/link';

const NAV_BG = '#173b57';

const STEPS = [
  {
    nr: '1',
    title: 'Gå till Bokföra',
    desc: 'På startsidan klickar du på kortet "Bokföra". Där väljer du vilken typ av händelse du vill lägga in.',
    href: '/bokforing',
    linkLabel: 'Öppna Bokföra',
    color: '#2563EB',
    bg: '#EFF6FF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    nr: '2',
    title: 'Välj vad som hände',
    desc: 'Välj rätt kategori — fick du betalt av en kund, köpte du något till företaget, betalade du skatt, osv.',
    href: null,
    linkLabel: null,
    color: '#059669',
    bg: '#ECFDF5',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    nr: '3',
    title: 'Fyll i uppgifterna',
    desc: 'Ange datum, belopp, moms och en kort beskrivning. Det behöver inte vara perfekt — vi hjälper dig tolka det rätt.',
    href: null,
    linkLabel: null,
    color: '#D97706',
    bg: '#FFFBEB',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    nr: '4',
    title: 'Spara',
    desc: 'Klicka på "Bokför" så sparas händelsen direkt. Den syns sedan under "Bokförda händelser" på bokföringssidan.',
    href: null,
    linkLabel: null,
    color: '#059669',
    bg: '#ECFDF5',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
];

const TYPES = [
  { label: 'Jag fick betalt av en kund', desc: 'En kund betalar en faktura eller direkt för en tjänst/vara.', color: '#059669', bg: '#ECFDF5', href: '/bokforing/kund-betalat' },
  { label: 'Jag köpte något till företaget', desc: 'Verktyg, material, prenumeration — allt du betalar med företagets pengar.', color: '#2563EB', bg: '#EFF6FF', href: '/bokforing/kopt-nagot' },
  { label: 'Privata pengar in eller ut', desc: 'Du satte in egna pengar, eller tog ut pengar för privat bruk.', color: '#7C3AED', bg: '#F5F3FF', href: '/bokforing/privat-pengar' },
  { label: 'Betalade skatt eller moms', desc: 'Inbetalning till Skatteverket för skatt eller moms.', color: '#DB2777', bg: '#FDF2F8', href: '/bokforing/skatteverket' },
  { label: 'Övrigt', desc: 'Något som inte passar in i de andra kategorierna.', color: '#0891B2', bg: '#ECFEFF', href: '/bokforing/ovrigt' },
];

export default function HemsidanGuidePage() {
  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="px-8 pt-10 pb-0 max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-7">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </Link>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Bokföra på hemsidan</h1>
        <p className="text-slate-400 text-sm mt-2 mb-8 leading-relaxed">
          Så här lägger du till transaktioner direkt här — enkelt och steg för steg.
        </p>
      </div>

      <div className="px-8 pb-12 max-w-2xl flex flex-col gap-6">

        {/* Steg-för-steg */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">Så här gör du</h2>
            <p className="text-sm text-slate-400 mt-0.5">Fyra steg för att bokföra en händelse.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {STEPS.map(step => (
              <div key={step.nr} className="flex gap-4 px-6 py-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: step.bg, color: step.color }}
                >
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">STEG {step.nr}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{step.title}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.desc}</p>
                  {step.href && (
                    <Link
                      href={step.href}
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold transition-colors"
                      style={{ color: step.color }}
                    >
                      {step.linkLabel}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Snabbstart */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">Typer av händelser</h2>
            <p className="text-sm text-slate-400 mt-0.5">Klicka direkt för att lägga in en transaktion.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {TYPES.map(t => (
              <Link
                key={t.label}
                href={t.href}
                className="group flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: t.bg }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t.desc}</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-3">Bra att veta</h2>
          <ul className="flex flex-col gap-3">
            {[
              'Bokför så nära händelsen i tid som möjligt — det är lättare när du minns vad det gäller.',
              'Du behöver inte vara perfekt. Vi hjälper dig rätta till om något ser konstigt ut.',
              'Har du många transaktioner på en gång? Ladda upp en fil under "Bokföra" → "Ladda upp transaktionslista".',
              'Alla sparade händelser syns under "Bokförda händelser" och ingår automatiskt i dina rapporter.',
            ].map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-600">
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <Link
          href="/bokforing"
          className="flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: NAV_BG }}
        >
          Gå till Bokföra
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

      </div>
    </div>
  );
}
