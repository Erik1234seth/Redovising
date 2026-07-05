import type { Metadata } from 'next';
import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export const metadata: Metadata = {
  title: 'Integritetspolicy | Enkla Bokslut',
  description: 'Så samlar in, använder och skyddar Enkla Bokslut dina personuppgifter enligt GDPR.',
  alternates: { canonical: 'https://enklabokslut.se/integritetspolicy' },
};

const LAST_UPDATED = '5 juli 2026';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="text-xl sm:text-2xl font-extrabold mb-4" style={{ color: NAV_BG }}>{title}</h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function IntegritetspolicyPage() {
  return (
    <div className="bg-white">

      {/* Hero */}
      <section className="px-6 py-16 sm:py-20" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">GDPR</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">Integritetspolicy</h1>
          <p className="text-white/60 text-base leading-relaxed">
            Din integritet är viktig för oss. Här beskriver vi vilka personuppgifter vi samlar in,
            varför, och vilka rättigheter du har.
          </p>
          <p className="text-white/40 text-xs mt-5">Senast uppdaterad: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14 sm:py-16 space-y-12">

        <Section id="ansvarig" title="1. Personuppgiftsansvarig">
          <p>
            Personuppgiftsansvarig för behandlingen av dina personuppgifter är:
          </p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 space-y-1">
            <p><strong className="text-slate-800">Sethapp Innovation</strong>{' '}
              <span className="text-slate-400">(varumärket Enkla Bokslut)</span></p>
            <p>Organisationsnummer: 559555-3586</p>
            <p>c/o Erik Seth, Ulrikedalsvägen 10 C, Lgh 1109, 224 58 Lund</p>
            <p>E-post:{' '}
              <a href="mailto:erik@enklabokslut.se" className="font-medium hover:opacity-80" style={{ color: CORAL }}>
                erik@enklabokslut.se
              </a>
            </p>
          </div>
          <p className="text-sm text-slate-400">
            Har du frågor om hur vi hanterar dina uppgifter är du alltid välkommen att kontakta oss på adressen ovan.
          </p>
        </Section>

        <Section id="uppgifter" title="2. Vilka uppgifter vi samlar in">
          <p>Beroende på hur du använder tjänsten kan vi behandla följande kategorier av personuppgifter:</p>
          <ul className="space-y-2.5">
            {[
              ['Kontouppgifter', 'namn, e-postadress och lösenord (lösenordet lagras krypterat).'],
              ['Verksamhets- och identitetsuppgifter', 'personnummer och/eller organisationsnummer, uppgifter om din enskilda firma.'],
              ['Bokföringsunderlag', 'kvitton, fakturor, kontoutdrag och annan information du skickar in för att vi ska kunna sköta din bokföring, moms, bokslut och deklaration.'],
              ['Betalningsuppgifter', 'uppgifter kopplade till din prenumeration. Kortuppgifter hanteras direkt av vår betalleverantör Stripe – vi lagrar aldrig fullständiga kortnummer.'],
              ['Kommunikation', 'meddelanden du skickar till oss via e-post, kontaktformulär eller chatt.'],
              ['Teknisk data', 'IP-adress, enhets- och webbläsarinformation samt cookies (se avsnitt 7).'],
            ].map(([label, body]) => (
              <li key={label} className="flex gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL }} />
                <span><strong className="text-slate-800">{label}:</strong> {body}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="andamal" title="3. Varför vi behandlar dina uppgifter och rättslig grund">
          <p>Vi behandlar dina personuppgifter för följande ändamål och med följande rättsliga grunder enligt GDPR:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left" style={{ color: NAV_BG }}>
                  <th className="border-b-2 border-slate-200 py-2.5 pr-4 font-bold">Ändamål</th>
                  <th className="border-b-2 border-slate-200 py-2.5 font-bold">Rättslig grund</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {[
                  ['Tillhandahålla och administrera tjänsten (konto, bokföring, bokslut, deklaration)', 'Fullgörande av avtal'],
                  ['Hantera betalning och prenumeration', 'Fullgörande av avtal'],
                  ['Bokföring och lagring av räkenskapsinformation', 'Rättslig förpliktelse (bokföringslagen)'],
                  ['Kundkännedom och åtgärder mot penningtvätt', 'Rättslig förpliktelse (penningtvättslagen)'],
                  ['Support och kommunikation med dig', 'Berättigat intresse / fullgörande av avtal'],
                  ['Förbättra och säkra tjänsten samt statistik', 'Berättigat intresse'],
                  ['Analys via cookies och marknadsföring', 'Samtycke'],
                ].map(([purpose, basis]) => (
                  <tr key={purpose} className="align-top">
                    <td className="border-b border-slate-100 py-3 pr-4">{purpose}</td>
                    <td className="border-b border-slate-100 py-3 font-medium text-slate-700">{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="mottagare" title="4. Vilka vi delar uppgifter med">
          <p>
            Vi säljer aldrig dina personuppgifter. För att kunna leverera tjänsten anlitar vi utvalda
            leverantörer som behandlar uppgifter för vår räkning (personuppgiftsbiträden). Med samtliga
            har vi personuppgiftsbiträdesavtal. Dessa är bland andra:
          </p>
          <ul className="space-y-2.5">
            {[
              ['Supabase', 'databas, inloggning och säker lagring av data.'],
              ['Stripe', 'hantering av betalningar och prenumerationer.'],
              ['Resend', 'utskick av transaktions- och systemmejl.'],
              ['OpenAI', 'AI-driven hjälp och support i tjänsten.'],
              ['Vercel', 'drift och hosting av webbplatsen och applikationen.'],
              ['Google Analytics', 'webbstatistik och analys (endast med ditt samtycke).'],
            ].map(([name, body]) => (
              <li key={name} className="flex gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL }} />
                <span><strong className="text-slate-800">{name}:</strong> {body}</span>
              </li>
            ))}
          </ul>
          <p>
            Vi kan också komma att lämna ut uppgifter till myndigheter, till exempel Skatteverket, när
            det krävs enligt lag eller för att fullgöra vårt uppdrag åt dig.
          </p>
        </Section>

        <Section id="overforing" title="5. Överföring till tredje land">
          <p>
            Vissa av våra leverantörer kan behandla uppgifter utanför EU/EES (till exempel i USA). När så
            sker säkerställer vi att överföringen skyddas av lämpliga skyddsåtgärder, såsom EU-kommissionens
            standardavtalsklausuler (SCC) eller att mottagaren är ansluten till EU–US Data Privacy Framework.
          </p>
        </Section>

        <Section id="lagring" title="6. Hur länge vi sparar dina uppgifter">
          <p>Vi sparar dina personuppgifter så länge det behövs för det ändamål de samlades in för:</p>
          <ul className="space-y-2.5">
            {[
              ['Kontouppgifter', 'så länge du har ett aktivt konto hos oss. När du avslutar kontot raderas eller anonymiseras uppgifterna, om vi inte är skyldiga att spara dem enligt lag.'],
              ['Räkenskapsinformation', 'i minst 7 år efter räkenskapsårets utgång enligt bokföringslagen.'],
              ['Uppgifter för kundkännedom', 'i minst 5 år enligt penningtvättslagen.'],
              ['Supportärenden och kommunikation', 'så länge det behövs för att hantera ärendet och en rimlig tid därefter.'],
            ].map(([label, body]) => (
              <li key={label} className="flex gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL }} />
                <span><strong className="text-slate-800">{label}:</strong> {body}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="cookies" title="7. Cookies">
          <p>
            Vi använder cookies och liknande tekniker för att webbplatsen ska fungera samt, med ditt
            samtycke, för statistik och analys (bland annat Google Analytics). Nödvändiga cookies krävs
            för grundläggande funktioner som inloggning. Du kan när som helst ändra dina inställningar
            eller blockera cookies i din webbläsare.
          </p>
        </Section>

        <Section id="rattigheter" title="8. Dina rättigheter">
          <p>Enligt dataskyddsförordningen (GDPR) har du rätt att:</p>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {[
              'Begära tillgång till dina uppgifter (registerutdrag)',
              'Få felaktiga uppgifter rättade',
              'Få dina uppgifter raderade i vissa fall',
              'Begära begränsning av behandlingen',
              'Invända mot viss behandling',
              'Få ut dina uppgifter (dataportabilitet)',
              'Återkalla ett lämnat samtycke',
              'Klaga hos tillsynsmyndigheten',
            ].map((r) => (
              <li key={r} className="flex gap-2.5 items-start">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p>
            För att utöva någon av dina rättigheter, kontakta oss på{' '}
            <a href="mailto:erik@enklabokslut.se" className="font-medium hover:opacity-80" style={{ color: CORAL }}>
              erik@enklabokslut.se
            </a>.
          </p>
        </Section>

        <Section id="klagomal" title="9. Klagomål till tillsynsmyndigheten">
          <p>
            Om du anser att vi behandlar dina personuppgifter i strid med gällande regler har du rätt att
            lämna in ett klagomål till Integritetsskyddsmyndigheten (IMY), som är tillsynsmyndighet i
            Sverige. Läs mer på{' '}
            <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" className="font-medium hover:opacity-80" style={{ color: CORAL }}>
              imy.se
            </a>.
          </p>
        </Section>

        <Section id="sakerhet" title="10. Säkerhet">
          <p>
            Vi vidtar tekniska och organisatoriska säkerhetsåtgärder för att skydda dina uppgifter mot
            obehörig åtkomst, förlust eller förändring. Data överförs krypterat och åtkomst begränsas till
            de personer som behöver den för att utföra sitt arbete.
          </p>
        </Section>

        <Section id="andringar" title="11. Ändringar i denna policy">
          <p>
            Vi kan komma att uppdatera denna integritetspolicy. Den senaste versionen finns alltid
            publicerad på denna sida med angivet uppdateringsdatum. Vid väsentliga ändringar informerar vi
            dig på lämpligt sätt.
          </p>
        </Section>

        {/* Contact CTA */}
        <div className="rounded-2xl p-7 sm:p-8 text-center" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}15` }}>
          <h3 className="text-lg font-extrabold mb-2" style={{ color: NAV_BG }}>Frågor om din integritet?</h3>
          <p className="text-slate-500 text-sm mb-5">Hör av dig så hjälper vi dig.</p>
          <a
            href="mailto:erik@enklabokslut.se"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: CORAL, boxShadow: `0 8px 20px ${CORAL}40` }}
          >
            Kontakta oss
          </a>
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
