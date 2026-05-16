'use client';

import { useState } from 'react';
import Link from 'next/link';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const guides = [
  {
    title: 'Kom igång med bokföring',
    desc: 'Registrera intäkter och kostnader steg för steg. AI:n föreslår rätt konton åt dig.',
    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    href: '/bokforing',
    color: '#2563EB',
    bg: '#EFF6FF',
    steps: ['Välj typ av händelse', 'Fyll i belopp och datum', 'AI tilldelar konton automatiskt'],
  },
  {
    title: 'Skapa din första faktura',
    desc: 'Professionella fakturor på sekunder — med automatisk statushantering och PDF-export.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    href: '/fakturor/ny',
    color: '#D97706',
    bg: '#FFFBEB',
    steps: ['Välj eller skapa en kund', 'Lägg till artiklar och priser', 'Spara och ladda ner som PDF'],
  },
  {
    title: 'Förstå dina rapporter',
    desc: 'NE-bilagan, momsrapporten och preliminär skatt fylls i automatiskt när du bokför.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    href: '/rapporter/ne-bilaga',
    color: '#059669',
    bg: '#ECFDF5',
    steps: ['Bokför dina transaktioner löpande', 'Öppna Rapporter i menyn', 'Exportera som PDF vid behov'],
  },
  {
    title: 'Lager & Inventarier',
    desc: 'Håll koll på maskiner, utrustning och lagervärde — med automatisk avskrivning.',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    href: '/lager',
    color: '#7C3AED',
    bg: '#F5F3FF',
    steps: ['Klicka "Lägg till" på lagersidan', 'Välj typ och fyll i inköpspris', 'Restvärde beräknas automatiskt'],
  },
];

const faqItems = [
  {
    category: 'Bokföring',
    color: '#2563EB',
    bg: '#EFF6FF',
    items: [
      {
        q: 'Hur bokför jag ett köp?',
        a: 'Gå till Bokföring i sidomenyn och välj "Jag köpte något till företaget". Följ de 7 stegen: beskriv vad du köpte (eller ladda upp kvitto), välj var säljaren finns, hur du betalade, datum, belopp och moms. AI:n tilldelar rätt BAS-konton automatiskt.',
      },
      {
        q: 'Hur bokför jag när en kund betalar mig?',
        a: 'Gå till Bokföring och välj "Jag fick betalt av en kund". Fyll i vad du sålde, var kunden finns, betalningssätt, datum, belopp och moms. Systemet skapar rätt verifikation automatiskt.',
      },
      {
        q: 'Kan jag ladda upp ett kvitto istället för att skriva?',
        a: 'Ja! I första steget av bokföringsguiden finns ett uppladdningsområde. Du kan dra och släppa eller klicka för att ladda upp en bild (JPG/PNG) eller PDF. AI:n läser av kvittot och fyller i uppgifter åt dig.',
      },
      {
        q: 'Var ser jag mina bokförda transaktioner?',
        a: 'Längst ner på sidan Bokföring finns en tabell med alla bokförda händelser. Du kan filtrera per år via dropdown-menyn uppe till höger i tabellen.',
      },
    ],
  },
  {
    category: 'Fakturor',
    color: '#D97706',
    bg: '#FFFBEB',
    items: [
      {
        q: 'Hur skapar jag en faktura?',
        a: 'Gå till Fakturor i sidomenyn och klicka "Ny faktura" uppe till höger. Fyll i kunduppgifter, fakturadetaljer och artiklar/tjänster. Klicka "Spara faktura" när du är klar.',
      },
      {
        q: 'Hur markerar jag en faktura som betald?',
        a: 'Gå till Fakturor och håll muspekaren över fakturaraden. En bock-ikon dyker upp till höger — klicka på den för att markera fakturan som betald. Status ändras direkt till grön.',
      },
      {
        q: 'Hur laddar jag ner en faktura som PDF?',
        a: 'Öppna fakturan genom att klicka på pil-ikonen till höger i fakturalistan. Klicka sedan på "Ladda ner PDF"-knappen uppe till höger på fakturasidan.',
      },
      {
        q: 'Kan jag spara kunduppgifter för återanvändning?',
        a: 'Ja. Gå till Fakturor → fliken "Kunder" → klicka "Lägg till". Sparade kunder visas sedan i dropdown-menyn när du skapar nästa faktura.',
      },
    ],
  },
  {
    category: 'Skatt & Moms',
    color: '#059669',
    bg: '#ECFDF5',
    items: [
      {
        q: 'Vad är en NE-bilaga?',
        a: 'NE-bilagan är en blankett från Skatteverket som bifogas till din inkomstdeklaration (INK1). Den sammanfattar årets intäkter och kostnader i din enskilda firma. Enkla Bokslut fyller i den automatiskt utifrån dina bokförda transaktioner — du hittar den under Rapporter → NE-bilaga.',
      },
      {
        q: 'Hur redovisar jag moms?',
        a: 'Under Rapporter → Momsrapport ser du hur mycket utgående moms (från försäljning) och ingående moms (från inköp) du har. Skillnaden är det du betalar till eller får tillbaka från Skatteverket. Rapporten uppdateras automatiskt.',
      },
      {
        q: 'Vad är preliminär skatt?',
        a: 'En uppskattning av den inkomstskatt du förväntas betala för året. Under Rapporter → Preliminär skatt ser du beräknat överskott, egenavgifter (ca 28,97%) och total beräknad skatt. Observera att detta är en uppskattning — Skatteverket beräknar den slutliga skatten.',
      },
      {
        q: 'Vilka momssatser finns?',
        a: '25% – de flesta varor och tjänster\n12% – livsmedel och hotell\n6% – böcker, tidningar och persontransport\n\nOm du är osäker kan du skriva 0 i momsbeloppet vid bokföring, så räknar systemet ut det.',
      },
    ],
  },
  {
    category: 'Mitt konto',
    color: '#7C3AED',
    bg: '#F5F3FF',
    items: [
      {
        q: 'Hur ändrar jag mitt företagsnamn?',
        a: 'Klicka på ditt namn/initialer längst ner i sidomenyn för att komma till Mitt konto. Ändra fältet "Företagsnamn" och klicka "Spara ändringar". Uppgifterna visas automatiskt på fakturor och i rapporter.',
      },
      {
        q: 'Vad är organisationsnummer för enskild firma?',
        a: 'För enskild firma är organisationsnumret detsamma som ditt personnummer (ÅÅMMDD-XXXX). Du fyller i det under Mitt konto.',
      },
      {
        q: 'Hur loggar jag ut?',
        a: 'Gå till Mitt konto (klicka på ditt namn längst ner i sidomenyn). Scrolla ner till "Logga ut"-sektionen och klicka på utloggningsknappen.',
      },
    ],
  },
];

function FaqSection() {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {faqItems.map(cat => (
        <div key={cat.category} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Category header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cat.bg }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
            </div>
            <span className="font-bold text-slate-800">{cat.category}</span>
          </div>

          <div className="divide-y divide-slate-50">
            {cat.items.map(item => {
              const key = `${cat.category}-${item.q}`;
              const isOpen = openKey === key;
              return (
                <div key={key}>
                  <button
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50/70 transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-700 pr-6 leading-relaxed">{item.q}</span>
                    <svg
                      className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5">
                      <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line pl-0 border-l-2 pl-4" style={{ borderColor: cat.color }}>
                        {item.a}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HjalpPage() {
  return (
    <div className="min-h-full bg-slate-50">

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${NAV_BG} 0%, #1a4a6e 100%)` }}>
        <div className="px-8 pt-12 pb-12">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ backgroundColor: `${CORAL}25`, color: CORAL }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CORAL }} />
            Hjälp & support
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-3">
            Hur kan vi hjälpa dig?
          </h1>
          <p className="text-white/60 text-base max-w-lg leading-relaxed">
            Hitta svar på vanliga frågor, följ guider steg för steg — eller fråga AI-assistenten direkt via knappen nere till höger.
          </p>

          {/* Quick stats */}
          <div className="flex items-center gap-8 mt-8">
            {[
              { value: '14', label: 'vanliga frågor' },
              { value: '4', label: 'steg-för-steg-guider' },
              { value: 'AI', label: 'assistent alltid tillgänglig' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-extrabold text-white">{value}</p>
                <p className="text-white/45 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-8 pb-16">

        {/* Guider */}
        <div className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CORAL }}>Guider</p>
            <h2 className="text-xl font-extrabold text-slate-800">Kom igång snabbt</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {guides.map(g => (
              <Link
                key={g.title}
                href={g.href}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
              >
                {/* Colored top stripe */}
                <div className="h-1 w-full" style={{ backgroundColor: g.color }} />
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: g.bg }}>
                      <svg className="w-4.5 h-4.5" style={{ color: g.color, width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={g.icon} />
                      </svg>
                    </div>
                    <p className="font-bold text-slate-800 text-base leading-snug">{g.title}</p>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">{g.desc}</p>
                  <ol className="space-y-2">
                    {g.steps.map((s, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-slate-600">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                          style={{ backgroundColor: g.color, fontSize: 11 }}
                        >
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                  <div className="flex items-center gap-1 mt-5 text-xs font-semibold transition-colors" style={{ color: g.color }}>
                    Öppna
                    <svg className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CORAL }}>FAQ</p>
            <h2 className="text-xl font-extrabold text-slate-800">Vanliga frågor</h2>
          </div>
          <FaqSection />
        </div>

        {/* CTA / Kontakt */}
        <div
          className="mt-12 rounded-2xl px-8 py-8 flex items-center justify-between gap-8"
          style={{ background: `linear-gradient(135deg, ${NAV_BG} 0%, #1a4a6e 100%)` }}
        >
          <div>
            <p className="text-white font-extrabold text-lg mb-1">Hittade du inte svaret?</p>
            <p className="text-white/55 text-sm leading-relaxed max-w-md">
              Skriv till oss så svarar vi inom 1 arbetsdag. Ingen fråga är för liten.
            </p>
            <div className="flex items-center gap-1.5 mt-3">
              {[
                'Snabbt svar',
                'Ingen fråga för liten',
                'Gratis',
              ].map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/kontakt"
            className="flex-shrink-0 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-200 hover:scale-[1.03] shadow-lg"
            style={{ backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 24px ${CORAL}40` }}
          >
            Kontakta oss →
          </Link>
        </div>

      </div>
    </div>
  );
}
