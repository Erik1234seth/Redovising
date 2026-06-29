'use client';

import Link from 'next/link';

const NAV_BG = '#173b57';

const STEPS = [
  {
    nr: 1,
    title: 'Gå till Bokföra',
    desc: 'På startsidan klickar du på kortet "Bokföra". Där väljer du vilken typ av händelse du vill lägga in.',
    href: '/bokforing',
    linkLabel: 'Öppna Bokföra',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    nr: 2,
    title: 'Välj vad som hände',
    desc: 'Välj rätt kategori — fick du betalt av en kund, köpte du något till företaget, betalade du skatt, osv.',
    href: null,
    linkLabel: null,
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    nr: 3,
    title: 'Fyll i uppgifterna',
    desc: 'Ange datum, belopp, moms och en kort beskrivning. Det behöver inte vara perfekt — vi hjälper dig tolka det rätt.',
    href: null,
    linkLabel: null,
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    nr: 4,
    title: 'Spara och klart',
    desc: 'Klicka på "Bokför" — händelsen sparas direkt och syns sedan under "Bokförda händelser".',
    href: null,
    linkLabel: null,
    color: '#059669',
    bg: '#ECFDF5',
  },
];

const TYPES = [
  {
    label: 'Jag fick betalt av en kund',
    desc: 'En kund betalar en faktura eller direkt för en tjänst/vara.',
    color: '#059669',
    bg: '#ECFDF5',
    href: '/bokforing/kund-betalat',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'Jag köpte något till företaget',
    desc: 'Verktyg, material, prenumeration — allt du betalar med företagets pengar.',
    color: '#2563EB',
    bg: '#EFF6FF',
    href: '/bokforing/kopt-nagot',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    label: 'Privata pengar in eller ut',
    desc: 'Du satte in egna pengar, eller tog ut pengar för privat bruk.',
    color: '#7C3AED',
    bg: '#F5F3FF',
    href: '/bokforing/privat-pengar',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    label: 'Betalade skatt eller moms',
    desc: 'Inbetalning till Skatteverket för skatt eller moms.',
    color: '#DB2777',
    bg: '#FDF2F8',
    href: '/bokforing/skatteverket',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: 'Övrigt',
    desc: 'Något som inte passar in i de andra kategorierna.',
    color: '#0891B2',
    bg: '#ECFEFF',
    href: '/bokforing/ovrigt',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
];

export default function HemsidanGuidePage() {
  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d2236 0%, #173b57 100%)' }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative px-8 pt-10 pb-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-8">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tillbaka
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
              Steg-för-steg guide
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Bokföra på hemsidan</h1>
          <p className="text-white/55 text-sm mt-2 leading-relaxed max-w-xs">
            Lägg in transaktioner direkt här — enkelt och precis som det ska vara.
          </p>
          <div className="flex gap-3 mt-7 flex-wrap">
            {[{ value: '4', label: 'steg' }, { value: '~2 min', label: 'per transaktion' }, { value: '5', label: 'händelsetyper' }].map(s => (
              <div key={s.label} className="rounded-xl px-4 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-white font-extrabold text-base leading-none">{s.value}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pb-12 max-w-2xl flex flex-col gap-5 mt-6">

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-6">Så här gör du</h2>
          <div className="relative">
            <div className="absolute left-[17px] top-9 bottom-4 w-0.5" style={{ background: 'linear-gradient(to bottom, #e2e8f0 60%, transparent)' }} />
            <div className="flex flex-col">
              {STEPS.map((step) => (
                <div key={step.nr} className="relative flex gap-5 pb-7 last:pb-0">
                  <div
                    className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-extrabold border-2 border-white shadow-sm"
                    style={{ backgroundColor: step.bg, color: step.color }}
                  >
                    {step.nr}
                  </div>
                  <div className="flex-1 pt-1.5">
                    <p className="font-bold text-slate-800 text-sm">{step.title}</p>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{step.desc}</p>
                    {step.href && (
                      <Link href={step.href} className="inline-flex items-center gap-1 mt-2.5 text-xs font-semibold" style={{ color: step.color }}>
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
        </div>

        {/* Transaction types */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">Bokför direkt</h2>
            <p className="text-xs text-slate-400 mt-0.5">Välj kategori och kom igång med ett klick.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {TYPES.map(t => (
              <Link
                key={t.label}
                href={t.href}
                className="group flex items-center gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                  style={{ backgroundColor: t.bg, color: t.color }}
                >
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t.desc}</p>
                </div>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5"
                  style={{ backgroundColor: t.bg }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke={t.color} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}18` }}>
          <div className="flex items-center gap-2 mb-3.5">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: NAV_BG }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="font-bold text-slate-800 text-sm">Bra att veta</h2>
          </div>
          <ul className="flex flex-col gap-2.5">
            {[
              'Bokför så nära händelsen i tid som möjligt — det är lättare när du minns vad det gäller.',
              'Det behöver inte vara perfekt. Vi hjälper dig rätta till om något ser konstigt ut.',
              'Har du många transaktioner? Ladda upp en fil under Bokföra → Ladda upp transaktionslista.',
              'Alla sparade händelser ingår automatiskt i dina rapporter och momsredovisning.',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className="flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 hover:-translate-y-0.5"
          style={{ backgroundColor: NAV_BG, boxShadow: `0 8px 24px ${NAV_BG}35` }}
        >
          Gå till Bokföra nu
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

      </div>
    </div>
  );
}
