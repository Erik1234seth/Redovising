'use client';

import { useState, useMemo } from 'react';
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
    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    items: [
      { q: 'Hur bokför jag ett köp?', a: 'Gå till Bokföring i sidomenyn och välj "Jag köpte något till företaget". Följ de 7 stegen: beskriv vad du köpte (eller ladda upp kvitto), välj var säljaren finns, hur du betalade, datum, belopp och moms. AI:n tilldelar rätt BAS-konton automatiskt.' },
      { q: 'Hur bokför jag när en kund betalar mig?', a: 'Gå till Bokföring och välj "Jag fick betalt av en kund". Fyll i vad du sålde, var kunden finns, betalningssätt, datum, belopp och moms. Systemet skapar rätt verifikation automatiskt.' },
      { q: 'Kan jag ladda upp ett kvitto istället för att skriva?', a: 'Ja! I första steget av bokföringsguiden finns ett uppladdningsområde. Du kan dra och släppa eller klicka för att ladda upp en bild (JPG/PNG) eller PDF. AI:n läser av kvittot och fyller i uppgifter åt dig.' },
      { q: 'Var ser jag mina bokförda transaktioner?', a: 'Längst ner på sidan Bokföring finns en tabell med alla bokförda händelser. Du kan filtrera per år via dropdown-menyn uppe till höger i tabellen.' },
    ],
  },
  {
    category: 'Fakturor',
    color: '#D97706',
    bg: '#FFFBEB',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    items: [
      { q: 'Hur skapar jag en faktura?', a: 'Gå till Fakturor i sidomenyn och klicka "Ny faktura" uppe till höger. Fyll i kunduppgifter, fakturadetaljer och artiklar/tjänster. Klicka "Spara faktura" när du är klar.' },
      { q: 'Hur markerar jag en faktura som betald?', a: 'Gå till Fakturor och håll muspekaren över fakturaraden. En bock-ikon dyker upp till höger — klicka på den för att markera fakturan som betald. Status ändras direkt till grön.' },
      { q: 'Hur laddar jag ner en faktura som PDF?', a: 'Öppna fakturan genom att klicka på pil-ikonen till höger i fakturalistan. Klicka sedan på "Ladda ner PDF"-knappen uppe till höger på fakturasidan.' },
      { q: 'Kan jag spara kunduppgifter för återanvändning?', a: 'Ja. Gå till Fakturor → fliken "Kunder" → klicka "Lägg till". Sparade kunder visas sedan i dropdown-menyn när du skapar nästa faktura.' },
    ],
  },
  {
    category: 'Skatt & Moms',
    color: '#059669',
    bg: '#ECFDF5',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    items: [
      { q: 'Vad är en NE-bilaga?', a: 'NE-bilagan är en blankett från Skatteverket som bifogas till din inkomstdeklaration (INK1). Den sammanfattar årets intäkter och kostnader i din enskilda firma. Enkla Bokslut fyller i den automatiskt utifrån dina bokförda transaktioner — du hittar den under Rapporter → NE-bilaga.' },
      { q: 'Hur redovisar jag moms?', a: 'Under Rapporter → Momsrapport ser du hur mycket utgående moms (från försäljning) och ingående moms (från inköp) du har. Skillnaden är det du betalar till eller får tillbaka från Skatteverket. Rapporten uppdateras automatiskt.' },
      { q: 'Vad är preliminär skatt?', a: 'En uppskattning av den inkomstskatt du förväntas betala för året. Under Rapporter → Preliminär skatt ser du beräknat överskott, egenavgifter (ca 28,97%) och total beräknad skatt. Observera att detta är en uppskattning — Skatteverket beräknar den slutliga skatten.' },
      { q: 'Vilka momssatser finns?', a: '25% – de flesta varor och tjänster\n12% – livsmedel och hotell\n6% – böcker, tidningar och persontransport\n\nOm du är osäker kan du skriva 0 i momsbeloppet vid bokföring, så räknar systemet ut det.' },
    ],
  },
  {
    category: 'Mitt konto',
    color: '#7C3AED',
    bg: '#F5F3FF',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    items: [
      { q: 'Hur ändrar jag mitt företagsnamn?', a: 'Klicka på ditt namn/initialer längst ner i sidomenyn för att komma till Mitt konto. Ändra fältet "Företagsnamn" och klicka "Spara ändringar". Uppgifterna visas automatiskt på fakturor och i rapporter.' },
      { q: 'Vad är organisationsnummer för enskild firma?', a: 'För enskild firma är organisationsnumret detsamma som ditt personnummer (ÅÅMMDD-XXXX). Du fyller i det under Mitt konto.' },
      { q: 'Hur loggar jag ut?', a: 'Gå till Mitt konto (klicka på ditt namn längst ner i sidomenyn). Scrolla ner till "Logga ut"-sektionen och klicka på utloggningsknappen.' },
    ],
  },
];

function FaqSection({ items }: { items: typeof faqItems }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const isFiltered = items !== faqItems;
  const cat = items[isFiltered ? 0 : activeCategory] ?? items[0];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-500">Inga frågor matchar din sökning</p>
      </div>
    );
  }

  const displayItems = isFiltered ? items : [items[activeCategory]].filter(Boolean);

  return (
    <div className="flex gap-5">
      {/* Category tabs — hidden when filtering */}
      {!isFiltered && (
        <div className="flex flex-col gap-1.5 w-44 flex-shrink-0 pt-0.5">
          {faqItems.map((c, i) => (
            <button
              key={c.category}
              onClick={() => { setActiveCategory(i); setOpenKey(null); }}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150"
              style={activeCategory === i
                ? { backgroundColor: c.bg, color: c.color, boxShadow: `0 0 0 1px ${c.color}30` }
                : { color: '#64748b' }
              }
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: activeCategory === i ? c.color : '#94a3b8' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={c.icon} />
              </svg>
              {c.category}
            </button>
          ))}
        </div>
      )}

      {/* Questions */}
      <div className="flex-1 min-w-0 space-y-2">
        {(isFiltered ? items : displayItems).map(c => (
          <div key={c.category}>
            {isFiltered && (
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: c.color }}>{c.category}</p>
            )}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {c.items.map((item, idx) => {
                const key = `${c.category}-${item.q}`;
                const isOpen = openKey === key;
                return (
                  <div key={key} className={idx !== 0 ? 'border-t border-slate-100' : ''}>
                    <button
                      onClick={() => setOpenKey(isOpen ? null : key)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors group"
                    >
                      <span className="text-sm font-medium text-slate-700 pr-4 leading-relaxed">{item.q}</span>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
                        style={isOpen ? { backgroundColor: c.bg } : { backgroundColor: '#f1f5f9' }}
                      >
                        <svg
                          className="w-3 h-3 transition-transform duration-200"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', color: isOpen ? c.color : '#94a3b8' }}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1">
                        <div className="pl-4 border-l-2 text-sm text-slate-500 leading-relaxed whitespace-pre-line" style={{ borderColor: c.color }}>
                          {item.a}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HjalpPage() {
  const [search, setSearch] = useState('');

  const filteredGuides = useMemo(() => {
    if (!search.trim()) return guides;
    const q = search.toLowerCase();
    return guides.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.desc.toLowerCase().includes(q) ||
      g.steps.some(s => s.toLowerCase().includes(q))
    );
  }, [search]);

  const filteredFaq = useMemo(() => {
    if (!search.trim()) return faqItems;
    const q = search.toLowerCase();
    return faqItems
      .map(cat => ({ ...cat, items: cat.items.filter(item => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)) }))
      .filter(cat => cat.items.length > 0);
  }, [search]);

  const isSearching = search.trim().length > 0;

  return (
    <div className="min-h-full bg-slate-50">

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAV_BG} 0%, #1e5278 100%)` }}>
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10" style={{ background: CORAL }} />
        <div className="absolute -bottom-24 -left-12 w-72 h-72 rounded-full opacity-5" style={{ background: 'white' }} />
        <div className="absolute top-8 right-32 w-20 h-20 rounded-full opacity-5" style={{ background: 'white' }} />

        <div className="relative px-8 pt-10 pb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{ backgroundColor: `${CORAL}28`, color: CORAL, border: `1px solid ${CORAL}30` }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Hjälp & support
          </div>

          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2 leading-tight">
            Vi hjälper dig
          </h1>
          <p className="text-white/55 text-sm max-w-md leading-relaxed mb-7">
            Hitta svar på vanliga frågor, följ guider steg för steg — eller fråga AI-assistenten direkt via knappen nere till höger.
          </p>

          {/* Search */}
          <div className="relative max-w-md">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.35)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Sök bland guider och frågor..."
              className="w-full pl-11 pr-10 py-3.5 rounded-xl text-sm text-white placeholder-white/35 outline-none transition-all"
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 pb-16">

        {/* Guider */}
        {(!isSearching || filteredGuides.length > 0) && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${CORAL}15` }}>
                <svg className="w-4 h-4" style={{ color: CORAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: CORAL }}>Guider</p>
                <h2 className="text-lg font-extrabold text-slate-800 leading-tight">Kom igång snabbt</h2>
              </div>
            </div>

            {filteredGuides.length === 0 ? (
              <p className="text-sm text-slate-400 pl-1">Inga guider matchar din sökning.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredGuides.map(g => (
                  <Link
                    key={g.title}
                    href={g.href}
                    className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${g.color}, ${g.color}88)` }} />
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: g.bg }}>
                          <svg style={{ color: g.color, width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={g.icon} />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm leading-snug">{g.title}</p>
                          <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{g.desc}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 pl-1">
                        {g.steps.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                            <span
                              className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                              style={{ backgroundColor: g.color, fontSize: 9 }}
                            >
                              {i + 1}
                            </span>
                            {s}
                          </div>
                        ))}
                      </div>
                      <div
                        className="flex items-center gap-1 mt-4 text-xs font-semibold"
                        style={{ color: g.color }}
                      >
                        Öppna guide
                        <svg className="w-3 h-3 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FAQ */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${CORAL}15` }}>
              <svg className="w-4 h-4" style={{ color: CORAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: CORAL }}>FAQ</p>
              <h2 className="text-lg font-extrabold text-slate-800 leading-tight">Vanliga frågor</h2>
            </div>
          </div>
          <FaqSection items={filteredFaq} />
        </div>

        {/* CTA */}
        <div
          className="mt-12 rounded-2xl overflow-hidden relative"
          style={{ background: `linear-gradient(135deg, ${NAV_BG} 0%, #1e5278 100%)` }}
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10" style={{ background: CORAL }} />
          <div className="relative px-8 py-7 flex items-center justify-between gap-8">
            <div>
              <p className="text-white font-extrabold text-lg mb-1">Hittade du inte svaret?</p>
              <p className="text-white/50 text-sm leading-relaxed max-w-sm">
                Skriv till oss så svarar vi inom 1 arbetsdag. Ingen fråga är för liten.
              </p>
              <div className="flex items-center gap-2 mt-3.5">
                {['Snabbt svar', 'Ingen fråga för liten', 'Gratis'].map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/kontakt"
              className="flex-shrink-0 flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-200 hover:scale-[1.03]"
              style={{ backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 24px ${CORAL}50` }}
            >
              Kontakta oss
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
