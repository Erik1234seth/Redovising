import type { Metadata } from 'next';
import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export const metadata: Metadata = {
  title: 'Användarvillkor | Enkla Bokslut',
  description: 'Villkoren för att använda Enkla Boksluts redovisningstjänst för enskilda firmor.',
  alternates: { canonical: 'https://enklabokslut.se/anvandarvillkor' },
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

export default function AnvandarvillkorPage() {
  return (
    <div className="bg-white">

      {/* Hero */}
      <section className="px-6 py-16 sm:py-20" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Avtal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">Användarvillkor</h1>
          <p className="text-white/60 text-base leading-relaxed">
            Dessa villkor gäller när du använder Enkla Bokslut. Läs igenom dem – genom att skapa ett
            konto och använda tjänsten godkänner du villkoren.
          </p>
          <p className="text-white/40 text-xs mt-5">Senast uppdaterad: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14 sm:py-16 space-y-12">

        <Section id="parter" title="1. Om oss och avtalet">
          <p>
            Tjänsten Enkla Bokslut tillhandahålls av <strong className="text-slate-800">Sethapp Innovation</strong>,
            organisationsnummer 559555-3586, c/o Erik Seth, Ulrikedalsvägen 10 C, Lgh 1109, 224 58 Lund
            (”vi”, ”oss” eller ”Enkla Bokslut”).
          </p>
          <p>
            Dessa användarvillkor utgör ett avtal mellan dig som kund (”du” eller ”kunden”) och oss. Genom
            att registrera ett konto, teckna en prenumeration eller på annat sätt använda tjänsten
            accepterar du dessa villkor. Om du ingår avtalet för ett företags räkning intygar du att du har
            rätt att binda företaget till villkoren.
          </p>
        </Section>

        <Section id="tjansten" title="2. Tjänsten">
          <p>
            Enkla Bokslut är en digital tjänst för redovisning riktad till enskilda firmor. Tjänsten kan,
            beroende på vald prenumeration, omfatta löpande bokföring, momsredovisning, årsbokslut,
            NE-bilaga och deklarationsunderlag samt inlämning till Skatteverket.
          </p>
          <p>
            Vi utför tjänsten med omsorg och fackmässighet utifrån de underlag och uppgifter du lämnar. Det
            exakta innehållet i tjänsten framgår vid beställningen och på vår webbplats. Vi förbehåller oss
            rätten att löpande utveckla och förändra tjänsten.
          </p>
        </Section>

        <Section id="konto" title="3. Konto och behörighet">
          <p>
            För att använda tjänsten behöver du skapa ett konto. Du ansvarar för att de uppgifter du lämnar
            är korrekta och för att hålla dina inloggningsuppgifter skyddade. Du ansvarar för all aktivitet
            som sker via ditt konto.
          </p>
          <p>
            Tjänsten riktar sig till enskilda näringsidkare. Du intygar att du bedriver enskild firma och
            att verksamheten uppfyller de förutsättningar som anges på vår webbplats (bland annat vad gäller
            omsättning och verksamhetstyp).
          </p>
        </Section>

        <Section id="kundens-ansvar" title="4. Kundens medverkan och ansvar">
          <p>
            En korrekt redovisning förutsätter att du bidrar med rätt information i tid. Du ansvarar för att:
          </p>
          <ul className="space-y-2.5">
            {[
              'skicka in fullständiga och korrekta underlag (kvitton, fakturor, kontoutdrag m.m.) inom rimlig tid,',
              'lämna riktiga uppgifter om din verksamhet, och',
              'granska och godkänna det material vi tar fram innan det lämnas in till myndighet, i den mån det krävs.',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p>
            Som enskild näringsidkare har du det yttersta ansvaret gentemot Skatteverket och andra
            myndigheter för din bokföring och deklaration. Vi ansvarar inte för fel eller förseningar som
            beror på att underlag saknas, är felaktiga eller lämnas för sent.
          </p>
        </Section>

        <Section id="pris" title="5. Priser och betalning">
          <p>
            Tjänsten tillhandahålls mot en löpande prenumerationsavgift. Gällande priser och betalningsperiod
            (månadsvis eller årsvis) framgår på vår webbplats vid tecknandet. Angivna priser är exklusive moms;
            moms tillkommer enligt vid var tid gällande skattesats.
          </p>
          <p>
            Betalning sker i förskott via vår betalleverantör Stripe. Prenumerationen förnyas automatiskt vid
            varje periods slut till dess att den sägs upp. Vi förbehåller oss rätten att ändra priserna;
            prisändringar meddelas i förväg och träder i kraft tidigast vid nästa betalningsperiod.
          </p>
          <p>
            Vid utebliven betalning kan vi komma att pausa eller begränsa din tillgång till tjänsten till dess
            att betalning skett.
          </p>
        </Section>

        <Section id="uppsagning" title="6. Bindningstid och uppsägning">
          <p>
            Det finns ingen bindningstid. Du kan när som helst säga upp din prenumeration. Uppsägningen får
            verkan vid utgången av den innevarande, redan betalda perioden – du behåller alltså tillgången
            till tjänsten fram till periodens slut. Redan betalda avgifter återbetalas inte, om inte annat
            följer av tvingande lag.
          </p>
        </Section>

        <Section id="angerratt" title="7. Ångerrätt">
          <p>
            Tjänsten riktar sig till näringsidkare. Distansavtalslagens regler om ångerrätt för konsumenter
            gäller därför normalt inte för avtal som ingås inom ramen för din näringsverksamhet. Du kan dock
            alltid avsluta din prenumeration enligt punkt 6.
          </p>
        </Section>

        <Section id="ip" title="8. Immateriella rättigheter">
          <p>
            Vi (eller våra licensgivare) innehar samtliga immateriella rättigheter till tjänsten, dess
            innehåll, programvara och varumärke. Du får en icke-exklusiv, icke-överlåtbar rätt att använda
            tjänsten under avtalstiden. Du behåller äganderätten till de underlag och den data du själv
            laddar upp.
          </p>
        </Section>

        <Section id="ansvar" title="9. Ansvarsbegränsning">
          <p>
            Vi utför tjänsten fackmässigt men lämnar inga garantier om att tjänsten alltid är felfri eller
            tillgänglig utan avbrott. I den utsträckning lagen tillåter ansvarar vi inte för indirekta
            skador, såsom utebliven vinst, förlust av data eller skada som beror på uppgifter eller underlag
            som du lämnat.
          </p>
          <p>
            Vårt sammanlagda ansvar gentemot dig är, i den mån det är tillåtet enligt lag, begränsat till ett
            belopp motsvarande de avgifter du betalat för tjänsten under de tolv (12) månader som föregick den
            händelse som gav upphov till kravet. Begränsningarna gäller inte vid uppsåt eller grov vårdslöshet
            eller där annat följer av tvingande lag.
          </p>
        </Section>

        <Section id="personuppgifter" title="10. Personuppgifter">
          <p>
            Vi behandlar personuppgifter i enlighet med vår{' '}
            <Link href="/integritetspolicy" className="font-medium hover:opacity-80" style={{ color: CORAL }}>
              integritetspolicy
            </Link>
            , som beskriver hur vi samlar in, använder och skyddar dina uppgifter enligt GDPR.
          </p>
        </Section>

        <Section id="sekretess" title="11. Sekretess">
          <p>
            Vi behandlar den information du delar med oss konfidentiellt och använder den endast för att
            leverera tjänsten och fullgöra våra rättsliga skyldigheter. Vi lämnar inte ut information till
            tredje part utöver vad som anges i vår integritetspolicy eller vad som krävs enligt lag.
          </p>
        </Section>

        <Section id="avstangning" title="12. Avstängning och uppsägning från vår sida">
          <p>
            Vi kan stänga av eller säga upp ditt konto med omedelbar verkan om du väsentligt bryter mot dessa
            villkor, använder tjänsten för olagliga ändamål, eller om det krävs enligt lag – till exempel
            enligt regelverket mot penningtvätt. Vi kan även avsluta tjänsten med skäligt varsel.
          </p>
        </Section>

        <Section id="andringar" title="13. Ändringar av villkoren">
          <p>
            Vi kan komma att uppdatera dessa villkor. Den senaste versionen publiceras alltid på denna sida
            med angivet uppdateringsdatum. Vid väsentliga ändringar informerar vi dig på lämpligt sätt.
            Fortsatt användning av tjänsten efter att ändringar trätt i kraft innebär att du accepterar de
            uppdaterade villkoren.
          </p>
        </Section>

        <Section id="tvist" title="14. Tillämplig lag och tvistlösning">
          <p>
            Svensk rätt tillämpas på detta avtal. Tvister som uppstår med anledning av avtalet ska i första
            hand lösas genom överenskommelse mellan parterna och i annat fall avgöras av svensk allmän
            domstol.
          </p>
        </Section>

        {/* Contact CTA */}
        <div className="rounded-2xl p-7 sm:p-8 text-center" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}15` }}>
          <h3 className="text-lg font-extrabold mb-2" style={{ color: NAV_BG }}>Frågor om villkoren?</h3>
          <p className="text-slate-500 text-sm mb-5">Hör av dig så hjälper vi dig.</p>
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
