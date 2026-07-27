import type { Metadata } from 'next';
import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export const metadata: Metadata = {
  title: 'Personuppgiftsbiträdesavtal (PUB) | Enkla Bokslut',
  description: 'Personuppgiftsbiträdesavtal som reglerar behandlingen av personuppgifter mellan kunden och Enkla Bokslut enligt GDPR.',
  alternates: { canonical: 'https://enklabokslut.se/pub' },
};

const LAST_UPDATED = '27 juli 2026';
const PDF_URL = '/PUB.pdf';

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`avsnitt-${num}`} className="scroll-mt-28">
      <h2 className="text-xl sm:text-2xl font-extrabold mb-4" style={{ color: NAV_BG }}>
        {num}. {title}
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PubPage() {
  return (
    <div className="bg-white">

      {/* Hero */}
      <section className="px-6 py-16 sm:py-20" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">GDPR · Bilaga</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">Personuppgiftsbiträdesavtal</h1>
          <p className="text-white/60 text-base leading-relaxed">
            Detta personuppgiftsbiträdesavtal (PUB) reglerar hur Enkla Bokslut behandlar personuppgifter för din räkning
            inom redovisningsuppdraget. Det gäller som bilaga till de allmänna villkoren.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-6">
            <a
              href={PDF_URL}
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: CORAL, boxShadow: `0 8px 20px ${CORAL}40` }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Ladda ner som PDF
            </a>
            <p className="text-white/40 text-xs">Senast uppdaterat: {LAST_UPDATED}</p>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14 sm:py-16 space-y-12">

        <Section num="1" title="Parter och bakgrund">
          <p>
            Detta avtal reglerar behandlingen av personuppgifter mellan <strong className="text-slate-800">Kunden
            (Personuppgiftsansvarig)</strong> och <strong className="text-slate-800">Enkla Bokslut
            (Personuppgiftsbiträde)</strong>, nedan gemensamt kallade Parterna. Detta avtal gäller som bilaga till
            Parternas huvudsakliga uppdragsavtal gällande redovisningstjänster.
          </p>
        </Section>

        <Section num="2" title="Behandlingens syfte och omfattning">
          <Bullets items={[
            <><strong className="text-slate-800">Ändamål:</strong> Biträdet ska behandla personuppgifter uteslutande för att kunna utföra det bokförings-, redovisnings- och deklarationsuppdrag som parterna har avtalat om.</>,
            <><strong className="text-slate-800">Kategorier av registrerade:</strong> Kundens kunder, leverantörer, kontaktpersoner samt (i förekommande fall) styrelsemedlemmar eller delägare.</>,
            <><strong className="text-slate-800">Typer av personuppgifter:</strong> Namn, adresser, telefonnummer, e-postadresser, bankdetaljer, organisationsnummer (för enskilda näringsidkare) samt finansiell information kopplad till verifikationer.</>,
          ]} />
        </Section>

        <Section num="3" title="Biträdets skyldigheter">
          <p>Biträdet förbinder sig att:</p>
          <ol className="space-y-2.5 list-decimal pl-5">
            <li><strong className="text-slate-800">Instruktioner:</strong> Endast behandla personuppgifter i enlighet med Kundens dokumenterade instruktioner och gällande lagstiftning (GDPR). Det huvudsakliga uppdragsavtalet utgör Kundens grundläggande instruktion.</li>
            <li><strong className="text-slate-800">Sekretess:</strong> Bevara strikt konfidentialitet gällande alla personuppgifter. Då Biträdet är enskild företagare utan anställda säkerställs att inga obehöriga har tillgång till uppgifterna.</li>
            <li><strong className="text-slate-800">Säkerhet:</strong> Vidta lämpliga tekniska och organisatoriska åtgärder (såsom starka lösenord, tvåfaktorsautentisering och kryptering där det är möjligt) för att skydda datan mot obehörig åtkomst eller förlust.</li>
            <li><strong className="text-slate-800">Hjälpsamhet:</strong> Assistera Kunden i den mån det är möjligt om en registrerad person kräver att få utöva sina rättigheter (t.ex. registerutdrag).</li>
          </ol>
        </Section>

        <Section num="4" title="Underbiträden (underleverantörer)">
          <Bullets items={[
            'Kunden ger härmed Biträdet ett generellt tillstånd att anlita underbiträden för att fullgöra uppdraget (till exempel databasleverantörer eller motsvarande).',
            'Biträdet ska på begäran kunna uppge vilka system och underleverantörer som används. Om Biträdet byter eller lägger till ett underbiträde ska Kunden informeras i förväg, och Kunden har då rätt att invända mot ändringen.',
          ]} />
        </Section>

        <Section num="5" title="Personuppgiftsincidenter">
          <p>
            Om Biträdet upptäcker en säkerhetsincident (t.ex. ett dataintrång, en stulen dator eller förlorade
            inloggningsuppgifter) som rör Kundens personuppgifter, ska Biträdet informera Kunden skriftligen utan onödigt
            dröjsmål efter att incidenten har upptäckts.
          </p>
        </Section>

        <Section num="6" title="Avtalets giltighet och upphörande">
          <Bullets items={[
            'Detta avtal gäller så länge det huvudsakliga uppdragsavtalet löper.',
            <><strong className="text-slate-800">Bokföringslagen vs GDPR:</strong> Vid uppdragets slut ska Biträdet återlämna eller radera personuppgifterna. Parterna är dock medvetna om att Biträdet är skyldigt enligt svensk bokföringslag att spara räkenskapsinformation (verifikationer, deklarationer etc.) i sju (7) år, vilket går före GDPR:s regler om radering.</>,
          ]} />
        </Section>

        {/* Contact CTA */}
        <div className="rounded-2xl p-7 sm:p-8 text-center" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}15` }}>
          <h3 className="text-lg font-extrabold mb-2" style={{ color: NAV_BG }}>Frågor om personuppgifter?</h3>
          <p className="text-slate-500 text-sm mb-5">
            Se även vår{' '}
            <Link href="/integritetspolicy" className="font-medium hover:opacity-80" style={{ color: CORAL }}>integritetspolicy</Link>
            {' '}och våra{' '}
            <Link href="/allmanna-villkor" className="font-medium hover:opacity-80" style={{ color: CORAL }}>allmänna villkor</Link>.
          </p>
          <Link
            href="/kontakt"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: CORAL, boxShadow: `0 8px 20px ${CORAL}40` }}
          >
            Kontakta oss
          </Link>
        </div>

        <div className="pt-4 text-center">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            ← Tillbaka till startsidan
          </Link>
        </div>

      </div>
    </div>
  );
}
