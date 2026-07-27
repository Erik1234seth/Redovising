import type { Metadata } from 'next';
import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export const metadata: Metadata = {
  title: 'Allmänna villkor | Enkla Bokslut',
  description: 'Allmänna villkor för Enkla Boksluts redovisningstjänst för enskilda näringsidkare.',
  alternates: { canonical: 'https://enklabokslut.se/allmanna-villkor' },
};

const LAST_UPDATED = '27 juli 2026';
const PDF_URL = '/allmanavillkor.pdf';

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

export default function AllmannaVillkorPage() {
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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">Allmänna villkor</h1>
          <p className="text-white/60 text-base leading-relaxed">
            Dessa allmänna villkor gäller när du beställer eller använder redovisningstjänsten Enkla Bokslut.
            Genom att beställa tjänsten, skapa ett konto eller på annat sätt ingå avtal om tjänsten accepterar du villkoren.
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
            <p className="text-white/40 text-xs">Senast uppdaterade: {LAST_UPDATED}</p>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14 sm:py-16 space-y-12">

        <Section num="1" title="Inledning">
          <p>
            Dessa allmänna villkor gäller när en kund beställer eller använder redovisningstjänsten Enkla Bokslut.
          </p>
          <p>
            Genom att beställa tjänsten, skapa ett konto eller på annat sätt ingå avtal om tjänsten accepterar kunden dessa villkor.
          </p>
          <p>
            Tjänsten är avsedd för enskilda näringsidkare och tillhandahålls endast inom ramen för kundens
            näringsverksamhet. Kunden ingår således avtalet i egenskap av näringsidkare och inte huvudsakligen
            för privat ändamål.
          </p>
        </Section>

        <Section num="2" title="Avtalspart och kontaktuppgifter">
          <p>Tjänsten Enkla Bokslut tillhandahålls av:</p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 space-y-1">
            <p><strong className="text-slate-800">Sethapp Innovation AB</strong></p>
            <p>Organisationsnummer: 559555-3586</p>
            <p>Adress: c/o Erik Seth, Ulrikedalsvägen 10 C, lägenhet 1109, 224 58 Lund</p>
            <p>E-post:{' '}
              <a href="mailto:info@enklabokslut.se" className="font-medium hover:opacity-80" style={{ color: CORAL }}>
                info@enklabokslut.se
              </a>
            </p>
            <p>Telefon: +46 79 311 96 76</p>
            <p>Webbplats: enklabokslut.se</p>
          </div>
          <p>
            Sethapp Innovation AB benämns i dessa villkor ”Enkla Bokslut”, ”vi”, ”oss” eller ”vår”. Den enskilda
            näringsidkare som beställer tjänsten benämns ”kunden” eller ”du”.
          </p>
        </Section>

        <Section num="3" title="Avtalets omfattning och handlingar">
          <p>Avtalet mellan kunden och Enkla Bokslut består av:</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>kundens beställning,</li>
            <li>dessa allmänna villkor,</li>
            <li>personuppgiftsbiträdesavtal,</li>
            <li>andra skriftliga överenskommelser mellan parterna.</li>
          </ol>
          <p>
            Om handlingarna innehåller motstridiga uppgifter gäller de i ovanstående ordning, om inte annat
            uttryckligen anges.
          </p>
        </Section>

        <Section num="4" title="När avtalet börjar gälla">
          <p>Avtalet börjar gälla när Enkla Bokslut har bekräftat kundens beställning.</p>
          <p>Enkla Bokslut har rätt att avvakta med att påbörja arbetet till dess att:</p>
          <Bullets items={[
            'första betalningen har genomförts,',
            'kunden har lämnat efterfrågade företags- och identitetsuppgifter,',
            'nödvändiga kundkännedomsåtgärder har genomförts,',
            'kunden har lämnat nödvändiga fullmakter eller ombudsbehörigheter, och',
            'kunden har lämnat de underlag som krävs för att arbetet ska kunna påbörjas.',
          ]} />
          <p>
            Att kunden skapar ett konto innebär inte i sig att Enkla Bokslut har åtagit sig att utföra ett visst
            redovisningsarbete.
          </p>
        </Section>

        <Section num="5" title="Tjänstens målgrupp">
          <p>
            Enkla Bokslut är en standardiserad redovisningstjänst avsedd för mindre enskilda näringsidkare med
            relativt enkla ekonomiska förhållanden.
          </p>
          <p>Om inget annat anges i beställningen förutsätter tjänsten att kunden:</p>
          <Bullets items={[
            'bedriver enskild näringsverksamhet,',
            'inte har några anställda,',
            'har en nettoomsättning som inte överstiger 3 000 000 kronor per år,',
            'får upprätta förenklat årsbokslut enligt tillämpliga regler,',
            'inte bedriver verksamhet som kräver särskilda redovisningslösningar,',
            'inte har omfattande internationell handel eller komplicerade momsfrågor, och',
            'i övrigt uppfyller de kvalificeringskrav som anges i beställningen eller på Enkla Boksluts webbplats.',
          ]} />
          <p>
            Enkla Bokslut har rätt att före eller efter beställningen bedöma om kundens verksamhet passar tjänsten.
          </p>
          <p>
            Att kunden har kunnat registrera ett konto eller genomföra en betalning innebär inte att Enkla Bokslut
            har godkänt alla delar av kundens verksamhet.
          </p>
        </Section>

        <Section num="6" title="Förändringar i kundens verksamhet">
          <p>
            Kunden ska utan dröjsmål informera Enkla Bokslut om förändringar som kan påverka tjänstens lämplighet,
            omfattning eller pris.
          </p>
          <p>Det gäller exempelvis om kunden:</p>
          <Bullets items={[
            'anställer personal,',
            'ändrar företagsform,',
            'startar en ny verksamhetsgren,',
            'börjar bedriva verksamhet utomlands,',
            'börjar köpa eller sälja varor eller tjänster internationellt i större omfattning,',
            'får komplicerade moms-, import- eller exportförhållanden,',
            'börjar tillämpa vinstmarginalbeskattning,',
            'börjar hantera punktskatter,',
            'påbörjar skogs-, lantbruks-, taxi- eller persontransportverksamhet,',
            'överskrider tjänstens omsättningsgräns, eller',
            'på annat sätt inte längre uppfyller tjänstens förutsättningar.',
          ]} />
          <p>Om verksamheten inte längre passar tjänsten får Enkla Bokslut:</p>
          <Bullets items={[
            'avstå från att utföra arbete utanför beställningen, eller',
            'säga upp avtalet enligt punkt 24.',
          ]} />
        </Section>

        <Section num="7" title="Vad tjänsten kan omfatta">
          <p>Tjänsten omfattar ett eller flera av följande moment:</p>
          <Bullets items={[
            'löpande bokföring,',
            'avstämning av bokföringen,',
            'momsberäkning och momsdeklaration,',
            'förenklat årsbokslut,',
            'NE-bilaga,',
            'deklarationsunderlag,',
            'upprättande av Inkomstdeklaration 1 för företaget,',
            'inlämning av deklarationer och uppgifter till Skatteverket,',
            'sammanställningar och rapporter, och',
            'redovisningshjälp rörande företaget.',
          ]} />
          <p>
            Endast de moment som uttryckligen framgår av kundens beställning eller uppdragsbekräftelse ingår.
          </p>
          <p>Om tjänsten anges omfatta ”deklaration” ska det framgå av beställningen om detta innebär:</p>
          <Bullets items={[
            'endast NE-bilaga och deklarationsunderlag, eller',
            'hela Inkomstdeklaration 1 inklusive överenskomna privata deklarationsuppgifter.',
          ]} />
          <p>
            Enkla Bokslut ansvarar inte för privata deklarationsuppgifter som ligger utanför den överenskomna
            omfattningen.
          </p>
        </Section>

        <Section num="8" title="Vad som normalt inte ingår">
          <p>Om inget annat skriftligen har avtalats ingår inte:</p>
          <Bullets items={[
            'rättelse eller rekonstruktion av tidigare års bokföring,',
            'hantering av bristfällig bokföring från tiden före uppdragets början,',
            'skattejuridisk eller annan juridisk rådgivning,',
            'affärsrådgivning eller ekonomisk rådgivning utöver enklare frågor som direkt hör till uppdraget,',
            'budget, prognos eller finansieringsunderlag,',
            'löneadministration eller arbetsgivardeklarationer,',
            'upprättande av kontrolluppgifter,',
            'omfattande kontakt eller korrespondens med myndigheter,',
            'ansökningar om ROT- eller RUT-utbetalning,',
            'löpande kontroll av kundens rätt till ROT- eller RUT-avdrag,',
            'hantering av lager, komplicerade inventeringar eller avancerade värderingsfrågor,',
            'redovisning enligt reglerna om vinstmarginalbeskattning,',
            'redovisning av punktskatter,',
            'avancerad internationell beskattning,',
            'omfattande EU-handel, import eller export,',
            'bokföring för andra företag eller verksamheter än den som omfattas av beställningen,',
            'bouppteckning, bodelning eller deklaration för dödsbo, och',
            'annat arbete som inte uttryckligen omfattas av beställningen.',
          ]} />
          <p>Enkla Bokslut har rätt att avstå från att utföra arbete som ligger utanför uppdragets omfattning.</p>
          <p>Parterna kan komma överens om att ytterligare arbete ska utföras mot separat ersättning.</p>
        </Section>

        <Section num="9" title="Hur tjänsten utförs">
          <p>Enkla Bokslut utför uppdraget med omsorg och på ett fackmässigt sätt utifrån:</p>
          <Bullets items={[
            'den information och de underlag kunden lämnar,',
            'den uppdragsomfattning parterna har avtalat,',
            'de förutsättningar kunden har uppgett,',
            'tillämpliga regler, och',
            'de bedömningar som skäligen kan göras utifrån tillgänglig information.',
          ]} />
          <p>
            Enkla Bokslut har rätt att använda standardiserade rutiner, automatiserade funktioner, programvara och
            underleverantörer vid utförandet av tjänsten.
          </p>
          <p>
            Enkla Bokslut har rätt att välja arbetsmetod, bokföringsprogram, tekniska lösningar och interna rutiner,
            under förutsättning att tjänsten utförs på ett fackmässigt sätt.
          </p>
          <p>
            Tjänsten innebär inte en garanti för ett visst skattemässigt resultat, ett visst myndighetsbeslut eller
            att Skatteverket godtar varje bedömning som görs.
          </p>
        </Section>

        <Section num="10" title="Kundens allmänna ansvar">
          <p>
            Kunden är bokföringsskyldig och har det yttersta ansvaret för sin bokföring, sina deklarationer och de
            uppgifter som lämnas till Skatteverket eller andra myndigheter.
          </p>
          <p>
            Detta ansvar gäller även när Enkla Bokslut har upprättat eller lämnat in uppgifterna för kundens räkning.
          </p>
          <p>Kunden ansvarar för att:</p>
          <Bullets items={[
            'uppgifter och underlag som lämnas är fullständiga och korrekta,',
            'samtliga affärshändelser redovisas,',
            'privata och företagsrelaterade transaktioner kan skiljas åt,',
            'Enkla Bokslut informeras om förhållanden som kan påverka redovisningen eller beskattningen,',
            'underlagen är äkta och avser verkliga affärshändelser,',
            'företaget har rätt att göra de avdrag som kunden begär,',
            'nödvändiga tillstånd och registreringar finns,',
            'kassaregister, personalliggare och andra verksamhetsspecifika krav följs när sådana krav gäller, och',
            'material som Enkla Bokslut lämnar för granskning kontrolleras.',
          ]} />
          <p>
            Enkla Bokslut är inte skyldigt att självständigt undersöka om kundens uppgifter är riktiga, om det inte
            finns särskilda skäl att ifrågasätta dem.
          </p>
        </Section>

        <Section num="11" title="Kundens skyldighet att lämna underlag">
          <p>Kunden ska lämna de underlag som Enkla Bokslut efterfrågar, exempelvis:</p>
          <Bullets items={[
            'kvitton,',
            'leverantörsfakturor,',
            'kundfakturor,',
            'kontoutdrag,',
            'betalningsunderlag,',
            'uppgifter om Swish och andra betaltjänster,',
            'uppgifter från kortinlösare,',
            'kassaunderlag,',
            'låne- och leasinghandlingar,',
            'uppgifter om inventarier,',
            'uppgifter om lager,',
            'uppgifter om obetalda kund- och leverantörsfakturor,',
            'underlag avseende bil, resor och arbetsrum,',
            'uppgifter om privata insättningar och uttag,',
            'avtal och andra handlingar som påverkar redovisningen, och',
            'övriga uppgifter som behövs för uppdraget.',
          ]} />
          <p>Kunden ska lämna underlagen genom den kanal och i det format som Enkla Bokslut anvisar.</p>
          <p>
            Enkla Bokslut får förutsätta att allt material som kunden skickar in ska beaktas i uppdraget, om kunden
            inte tydligt anger något annat.
          </p>
        </Section>

        <Section num="12" title="Tidsfrister och försenade underlag">
          <p>Kunden ska lämna underlag och besvara frågor inom de tidsfrister som Enkla Bokslut meddelar.</p>
          <p>
            Om ingen särskild tidsfrist har meddelats ska underlagen lämnas så snart som möjligt och senast inom den
            tid som rimligen krävs för att arbetet ska kunna utföras före tillämplig myndighetsfrist.
          </p>
          <p>Kunden ska normalt besvara kompletterande frågor inom fem arbetsdagar.</p>
          <p>
            Inför bokslut och deklaration ska kunden lämna fullständiga bokslutsunderlag senast det datum som Enkla
            Bokslut meddelar.
          </p>
          <p>Om underlag eller svar lämnas för sent:</p>
          <Bullets items={[
            'kan Enkla Bokslut inte garantera att arbetet blir färdigt före myndighetens tidsfrist,',
            'har Enkla Bokslut rätt att prioritera andra kunder som har lämnat material i tid,',
            'kan arbetet behöva utföras mot särskild ersättning,',
            'kan Enkla Bokslut lämna en deklaration eller rapport till kunden för egen inlämning, och',
            'ansvarar kunden själv för förseningsavgifter, skattetillägg, ränta och andra följder som beror på förseningen.',
          ]} />
          <p>Enkla Bokslut är inte skyldigt att utföra arbete med oskäligt kort varsel.</p>
        </Section>

        <Section num="13" title="Frågor, antaganden och ofullständigt material">
          <p>Om underlag saknas eller är oklart får Enkla Bokslut begära kompletteringar.</p>
          <p>Om kunden inte besvarar en fråga får Enkla Bokslut:</p>
          <Bullets items={[
            'avvakta med arbetet,',
            'utgå från ett rimligt och försiktigt antagande,',
            'lämna posten obehandlad till dess att kunden svarar,',
            'färdigställa materialet med tydlig reservation,',
            'avstå från att lämna in uppgifter till myndighet, eller',
            'säga upp eller pausa uppdraget.',
          ]} />
          <p>
            Enkla Bokslut är inte ansvarigt för följderna av ett antagande som varit rimligt utifrån den information
            som kunden har lämnat.
          </p>
          <p>
            Om Enkla Bokslut upptäcker att redan utfört arbete bygger på felaktigt eller ofullständigt material ska
            kunden utan dröjsmål lämna de uppgifter som krävs för rättelse.
          </p>
          <p>Rättelsearbete som beror på kunden kan debiteras separat.</p>
        </Section>

        <Section num="14" title="Kundens granskning och godkännande">
          <p>Kunden ska granska rapporter, deklarationer och andra handlingar som Enkla Bokslut lämnar för godkännande.</p>
          <p>Kunden ska kontrollera att:</p>
          <Bullets items={[
            'intäkter och kostnader framstår som fullständiga,',
            'lämnade uppgifter har återgetts korrekt,',
            'bankkonton, kontanta medel och betalningstjänster har beaktats,',
            'privata uppgifter är riktiga,',
            'begärda avdrag är riktiga, och',
            'inga väsentliga omständigheter saknas.',
          ]} />
          <p>
            Kundens godkännande innebär att kunden bekräftar att materialet, såvitt kunden känner till, är fullständigt
            och korrekt.
          </p>
          <p>Om kunden inte invänder inom den tid som anges i meddelandet får Enkla Bokslut avvakta med inlämningen.</p>
          <p>
            Tystnad ska inte betraktas som ett godkännande, om det krävs ett uttryckligt godkännande enligt lag,
            myndighetskrav eller Enkla Boksluts rutiner.
          </p>
        </Section>

        <Section num="15" title="Inlämning till Skatteverket och ombudsbehörighet">
          <p>
            Om uppdraget omfattar inlämning till Skatteverket ska kunden i god tid ge den fysiska person som Enkla
            Bokslut anvisar nödvändig behörighet som deklarationsombud eller annat ombud.
          </p>
          <p>Kunden ansvarar för att:</p>
          <Bullets items={[
            'ansöka om eller godkänna ombudsbehörigheten,',
            'behörigheten omfattar aktuella deklarationer och tjänster,',
            'behörigheten börjar gälla i tillräckligt god tid, och',
            'inte återkalla behörigheten innan uppdraget har slutförts.',
          ]} />
          <p>
            Om nödvändig ombudsbehörighet saknas har Enkla Bokslut rätt att lämna det färdiga materialet till kunden
            för egen inlämning.
          </p>
          <p>Kunden ansvarar i så fall för att materialet lämnas in i tid.</p>
          <p>Enkla Bokslut får begära ett särskilt godkännande från kunden före varje inlämning.</p>
        </Section>

        <Section num="16" title="Priser">
          <p>Priset och betalningsperioden framgår av kundens beställning.</p>
          <p>
            Alla priser anges exklusive mervärdesskatt, om inte annat uttryckligen anges. Mervärdesskatt tillkommer
            enligt vid var tid gällande skattesats.
          </p>
          <p>
            Abonnemangsavgiften avser den standardiserade tjänst och den omfattning som framgår av beställningen.
          </p>
          <p>Enkla Bokslut har rätt att ta separat betalt för arbete som:</p>
          <Bullets items={[
            'ligger utanför den beställda tjänsten,',
            'beror på för sent, felaktigt eller ofullständigt material,',
            'avser rättelse av tidigare bokföring,',
            'kräver osedvanligt omfattande utredning,',
            'beror på att kundens verksamhet har förändrats,',
            'avser en myndighetsförfrågan, omprövning eller kontroll,',
            'utförs efter att avtalet har upphört, eller',
            'annars inte rimligen ingår i standardpriset.',
          ]} />
          <p>Sådant arbete ska normalt godkännas av kunden innan det utförs.</p>
          <p>
            Enkla Bokslut får dock utföra en mindre och brådskande åtgärd utan föregående godkännande om åtgärden
            skäligen behövs för att undvika en omedelbar skada eller missad myndighetsfrist. Kunden ska då informeras
            så snart som möjligt.
          </p>
        </Section>

        <Section num="17" title="Betalning">
          <p>Betalning sker i förskott genom den betallösning som Enkla Bokslut anvisar, exempelvis Stripe.</p>
          <p>Vid månadsbetalning debiteras avgiften inför varje ny månadsperiod.</p>
          <p>Vid årsbetalning debiteras avgiften efter inlämnad deklaration.</p>
          <p>Prenumerationen förnyas automatiskt vid varje betalningsperiods slut till dess att den sägs upp.</p>
          <p>Kunden ansvarar för att:</p>
          <Bullets items={[
            'registrerade betalningsuppgifter är korrekta,',
            'det finns tillräckliga medel för betalningen, och',
            'uppdatera betalningsuppgifterna när det behövs.',
          ]} />
          <p>Vid sen betalning har Enkla Bokslut rätt att ta ut:</p>
          <Bullets items={[
            'dröjsmålsränta enligt räntelagen,',
            'lagstadgad påminnelseavgift,',
            'inkassokostnader, och',
            'andra kostnader som följer av lag.',
          ]} />
        </Section>

        <Section num="18" title="Utebliven betalning">
          <p>Om betalning uteblir får Enkla Bokslut:</p>
          <Bullets items={[
            'göra ett nytt betalningsförsök,',
            'skicka betalningspåminnelse,',
            'pausa pågående arbete,',
            'begränsa kundens tillgång till tjänsten,',
            'avstå från att lämna in deklarationer eller andra uppgifter,',
            'säga upp avtalet, och',
            'överlämna fordran för inkasso.',
          ]} />
          <p>
            Kundens ansvar för myndighetsfrister påverkas inte av att tjänsten har pausats på grund av utebliven
            betalning.
          </p>
          <p>
            Enkla Bokslut ansvarar inte för förseningsavgift, skattetillägg, ränta eller annan skada som uppstår till
            följd av att arbetet pausats på grund av kundens betalningsdröjsmål.
          </p>
        </Section>

        <Section num="19" title="Prisändringar">
          <p>Enkla Bokslut har rätt att ändra priset.</p>
          <p>
            Prisändringar ska meddelas minst 30 dagar innan de träder i kraft. De avtalade priserna kan justeras högst
            en gång per år. Justeringen baseras på utvecklingen av Konsumentprisindex (KPI), som publiceras av
            Statistiska centralbyrån (SCB). Som bas för beräkningen gäller det fastställda indextalet för den månad då
            avtalet tecknades.
          </p>
          <p>
            För en månadsbetald tjänst träder det nya priset i kraft tidigast vid den första betalningsperiod som
            börjar efter att meddelandetiden löpt ut.
          </p>
          <p>För en årsbetald tjänst träder det nya priset normalt i kraft vid nästa avtals- eller betalningsår.</p>
          <p>Kunden har rätt att säga upp tjänsten innan prisändringen träder i kraft.</p>
          <p>Prisändringar påverkar inte en redan betald period.</p>
        </Section>

        <Section num="20" title="Ingen bindningstid och kundens uppsägning">
          <p>Om inget annat uttryckligen anges i beställningen har tjänsten ingen bindningstid.</p>
          <p>
            Kunden kan när som helst säga upp prenumerationen genom kontot, via e-post eller genom annan anvisad
            kontaktväg.
          </p>
          <p>Uppsägningen får verkan vid utgången av den innevarande betalda perioden.</p>
          <p>Kunden behåller normalt tillgången till tjänsten till periodens slut.</p>
          <p>
            Redan betalda avgifter återbetalas inte, om inte annat skriftligen har avtalats eller följer av tvingande lag.
          </p>
        </Section>

        <Section num="21" title="Vad som händer med redovisningen vid uppsägning">
          <p>Vid uppsägning slutför Enkla Bokslut endast arbete som:</p>
          <Bullets items={[
            'omfattas av den betalda perioden,',
            'bygger på fullständigt material som lämnats i tid, och',
            'skäligen kan utföras före avtalets upphörande.',
          ]} />
          <p>
            Månadsavgifter som kunden har betalat före uppsägningen ger inte i sig rätt till ett framtida bokslut eller
            en framtida deklaration efter att abonnemanget har upphört, om inte annat framgår av beställningen.
          </p>
          <p>Enkla Bokslut har rätt att ta separat betalt för:</p>
          <Bullets items={[
            'sammanställning av en ofullständig period,',
            'rättelser inför överlämning,',
            'särskild export eller anpassning av material,',
            'kontakt med en ny redovisningskonsult, och',
            'annat överlämningsarbete utöver standardexporten.',
          ]} />
          <p>
            Kunden ansvarar efter avtalets upphörande för att anlita annan hjälp och säkerställa att bokföring och
            deklarationer fullgörs i tid.
          </p>
        </Section>

        <Section num="23" title="Avtal med näringsidkare och ångerrätt">
          <p>
            Avtalet ingås av kunden i egenskap av näringsidkare och inom ramen för kundens näringsverksamhet.
          </p>
          <p>Konsumenträttsliga regler om ångerrätt är därför inte tillämpliga.</p>
          <p>Kunden har rätt att säga upp prenumerationen enligt dessa villkor.</p>
        </Section>

        <Section num="24" title="Enkla Boksluts rätt att pausa eller säga upp avtalet">
          <p>Enkla Bokslut får med omedelbar verkan pausa tjänsten eller säga upp avtalet om:</p>
          <Bullets items={[
            'kunden väsentligt bryter mot avtalet,',
            'kunden inte betalar i tid,',
            'kunden inte lämnar nödvändiga underlag eller svar,',
            'kunden lämnar felaktiga eller vilseledande uppgifter,',
            'kunden inte medverkar till kundkännedom,',
            'kundens verksamhet inte längre passar tjänsten,',
            'Enkla Bokslut bedömer att uppdraget inte kan utföras lagenligt eller fackmässigt,',
            'kunden använder tjänsten för ett olagligt ändamål,',
            'kunden hotar eller utsätter Enkla Boksluts personal eller uppdragstagare för olämpligt beteende,',
            'fortsatt arbete skulle kunna medföra överträdelse av lag, myndighetsbeslut eller yrkesmässiga skyldigheter, eller',
            'annat väsentligt skäl föreligger.',
          ]} />
          <p>
            Enkla Bokslut får även säga upp avtalet utan att kunden har brutit mot det, med minst 30 dagars skriftligt
            varsel.
          </p>
          <p>
            Kortare varsel får användas om det krävs enligt lag, myndighetsbeslut, säkerhetsskäl eller reglerna om
            åtgärder mot penningtvätt och finansiering av terrorism.
          </p>
          <p>
            Vid uppsägning ska kunden själv säkerställa att annan hjälp anlitas och att kommande myndighetsfrister följs.
          </p>
        </Section>

        <Section num="25" title="Kundkännedom och åtgärder mot penningtvätt">
          <p>
            Enkla Bokslut omfattas av skyldigheter avseende åtgärder mot penningtvätt och finansiering av terrorism.
          </p>
          <p>Kunden ska därför lämna de uppgifter och handlingar som Enkla Bokslut begär för att:</p>
          <Bullets items={[
            'identifiera kunden,',
            'kontrollera kundens identitet,',
            'förstå verksamhetens art och syfte,',
            'bedöma kundrelationens risk,',
            'följa upp transaktioner och affärsförbindelsen, och',
            'fullgöra andra skyldigheter enligt lag.',
          ]} />
          <p>Enkla Bokslut får begära exempelvis:</p>
          <Bullets items={[
            'identitetshandling,',
            'uppgifter om verksamheten,',
            'information om transaktioners syfte,',
            'kontoutdrag,',
            'avtal,',
            'uppgifter om pengars ursprung, och',
            'andra kompletterande handlingar.',
          ]} />
          <p>Om tillräcklig kundkännedom inte kan uppnås får Enkla Bokslut:</p>
          <Bullets items={[
            'avstå från att inleda uppdraget,',
            'pausa arbetet,',
            'vägra genomföra en viss åtgärd, eller',
            'avsluta kundrelationen.',
          ]} />
          <p>
            Enkla Bokslut kan enligt lag vara förhindrat att informera kunden om vissa kontroller, bedömningar eller
            rapporteringar.
          </p>
        </Section>

        <Section num="26" title="Immateriella rättigheter">
          <p>Enkla Bokslut eller dess licensgivare innehar samtliga immateriella rättigheter till:</p>
          <Bullets items={[
            'tjänsten,',
            'webbplatsen,',
            'programvaran,',
            'databaser,',
            'mallar,',
            'arbetsmetoder,',
            'grafiskt material,',
            'texter,',
            'varumärken, och',
            'annat material som Enkla Bokslut har tagit fram.',
          ]} />
          <p>
            Kunden får under avtalstiden en begränsad, personlig, icke-exklusiv och icke-överlåtbar rätt att använda
            tjänsten för sin egen näringsverksamhet.
          </p>
          <p>Kunden får inte:</p>
          <Bullets items={[
            'kopiera eller vidarelicensiera tjänsten,',
            'försöka få åtkomst till källkod,',
            'kringgå tekniska skydd,',
            'använda tjänsten för någon annans verksamhet, eller',
            'använda Enkla Boksluts material i konkurrerande verksamhet.',
          ]} />
          <p>Kunden behåller rättigheterna till de underlag och den information som kunden själv tillhandahåller.</p>
          <p>Enkla Boksluts generella arbetsmetoder, mallar, programkod och kunskap övergår inte till kunden.</p>
        </Section>

        <Section num="27" title="Räkenskapsinformation och kundens material">
          <p>Kunden äger sina originalhandlingar och har rätt till sin räkenskapsinformation.</p>
          <p>Enkla Bokslut får behandla och lagra materialet i den omfattning som behövs för att:</p>
          <Bullets items={[
            'utföra uppdraget,',
            'uppfylla lagkrav,',
            'säkerställa kvalitet och spårbarhet,',
            'hantera rättsliga anspråk, och',
            'fullgöra skyldigheter enligt avtalet.',
          ]} />
          <p>
            Kunden ansvarar för att även själv säkerställa att räkenskapsinformationen bevaras under hela den
            lagstadgade arkiveringstiden, om inte parterna skriftligen har avtalat att Enkla Bokslut åtar sig hela
            eller delar av arkiveringen.
          </p>
          <p>
            Att handlingar eller uppgifter finns tillgängliga i Enkla Boksluts system innebär inte automatiskt att
            Enkla Bokslut har övertagit kundens lagstadgade arkiveringsansvar.
          </p>
        </Section>

        <Section num="28" title="Utlämning och export">
          <p>
            Under avtalstiden har kunden rätt att få tillgång till det material och den bokföringsdata som omfattas av
            uppdraget.
          </p>
          <p>Vid avtalets upphörande kan kunden begära:</p>
          <Bullets items={[
            'uppladdade underlag,',
            'bokföringsrapporter,',
            'huvudbok,',
            'verifikationslista,',
            'resultatrapport,',
            'balansrapport,',
            'färdigställda deklarationer, och',
            'SIE-fil eller annat sedvanligt exportformat, i den mån sådan export är tekniskt tillgänglig.',
          ]} />
          <p>Standardexport lämnas utan särskild kostnad om den kan tas fram med normala funktioner i tjänsten.</p>
          <p>
            Särskilt anpassad export, sortering, omfattande sammanställning eller överlämning till en ny konsult kan
            debiteras separat.
          </p>
          <p>
            Kunden ska begära export senast 90 dagar efter avtalets upphörande, om inte en längre tid följer av lag
            eller särskild överenskommelse.
          </p>
          <p>Efter denna period får Enkla Bokslut radera material som inte måste sparas enligt lag, avtal eller rättsligt intresse.</p>
          <p>
            Enkla Bokslut får inte hålla inne kundens originalhandlingar enbart på grund av en betalningstvist. Enkla
            Bokslut har dock rätt att avvakta med särskilt överlämningsarbete och material som Enkla Bokslut inte är
            skyldigt att lämna ut innan förfallen betalning har skett.
          </p>
        </Section>

        <Section num="29" title="Arkivering">
          <p>
            Den bokföringsskyldige kunden har det yttersta ansvaret för att räkenskapsinformationen arkiveras under den
            tid och på det sätt som följer av bokföringslagen och andra tillämpliga regler.
          </p>
          <p>
            Om Enkla Bokslut enligt beställningen ansvarar för viss teknisk lagring innebär detta inte att kundens
            lagstadgade ansvar upphör.
          </p>
          <p>
            Kunden ska löpande hämta och säkerhetskopiera sådant material som kunden behöver för att fullgöra sitt
            arkiveringsansvar.
          </p>
          <p>Enkla Bokslut får behålla kopior av material efter avtalets upphörande när detta krävs för att:</p>
          <Bullets items={[
            'fullgöra lagkrav,',
            'dokumentera kundkännedom,',
            'uppfylla bokförings- eller skatterättsliga skyldigheter,',
            'tillvarata rättsliga anspråk, eller',
            'försvara sig mot krav.',
          ]} />
        </Section>

        <Section num="30" title="Elektronisk kommunikation">
          <p>Parterna får kommunicera genom:</p>
          <Bullets items={[
            'e-post,',
            'kundportal,',
            'sms,',
            'telefon, och',
            'andra elektroniska kontaktvägar som Enkla Bokslut anvisar.',
          ]} />
          <p>Kunden ansvarar för att:</p>
          <Bullets items={[
            'lämnade kontaktuppgifter är korrekta,',
            'meddela förändrade kontaktuppgifter,',
            'regelbundet kontrollera sin e-post och kundportal,',
            'kontrollera skräppostfilter, och',
            'utan dröjsmål reagera på tidskritiska meddelanden.',
          ]} />
          <p>
            Ett meddelande som skickats till den senaste e-postadress som kunden har uppgett anses ha kommit kunden
            till handa senast nästföljande arbetsdag, om det inte framgår att leveransen misslyckats.
          </p>
          <p>Kunden ska inte skicka lösenord, BankID-koder eller andra personliga säkerhetskoder till Enkla Bokslut.</p>
          <p>Enkla Bokslut kan kräva att särskilt känsligt material lämnas genom en anvisad säker kanal.</p>
        </Section>

        <Section num="31" title="Sekretess">
          <p>Enkla Bokslut ska behandla konfidentiell information om kunden och kundens verksamhet med sekretess.</p>
          <p>Information får användas och lämnas ut när det behövs för att:</p>
          <Bullets items={[
            'utföra uppdraget,',
            'anlita underleverantörer,',
            'administrera kundrelationen,',
            'uppfylla rättsliga skyldigheter,',
            'genomföra kundkännedom,',
            'rapportera enligt lag,',
            'tillvarata rättsliga anspråk, eller',
            'skydda Enkla Boksluts, kundens eller annans rättigheter.',
          ]} />
          <p>Sekretessen gäller inte information som:</p>
          <Bullets items={[
            'redan är allmänt känd,',
            'blir offentlig utan att Enkla Bokslut bryter mot avtalet,',
            'Enkla Bokslut har fått från en tredje part utan sekretesskyldighet,',
            'Enkla Bokslut har utvecklat självständigt, eller',
            'måste lämnas ut enligt lag, myndighetsbeslut eller domstolsbeslut.',
          ]} />
          <p>
            Enkla Bokslut ska säkerställa att personal, konsulter och relevanta underleverantörer omfattas av lämpliga
            sekretessåtaganden.
          </p>
          <p>Sekretesskyldigheten fortsätter att gälla efter att avtalet har upphört.</p>
        </Section>

        <Section num="32" title="Personuppgifter">
          <p>
            Enkla Bokslut behandlar personuppgifter i enlighet med tillämplig dataskyddslagstiftning och Enkla Boksluts{' '}
            <Link href="/integritetspolicy" className="font-medium hover:opacity-80" style={{ color: CORAL }}>
              integritetspolicy
            </Link>
            .
          </p>
          <p>Enkla Bokslut är personuppgiftsansvarigt för behandling som sker för egna ändamål, exempelvis:</p>
          <Bullets items={[
            'kundadministration,',
            'avtalshantering,',
            'fakturering,',
            'betalning,',
            'kundkännedom,',
            'säkerhet,',
            'rättsliga skyldigheter,',
            'kvalitetsarbete, och',
            'tillvaratagande av rättsliga anspråk.',
          ]} />
          <p>
            När Enkla Bokslut behandlar personuppgifter för kundens räkning inom ramen för redovisningsuppdraget gäller
            ett separat{' '}
            <Link href="/pub" className="font-medium hover:opacity-80" style={{ color: CORAL }}>
              personuppgiftsbiträdesavtal
            </Link>{' '}
            i den utsträckning Enkla Bokslut är personuppgiftsbiträde.
          </p>
          <p>Kunden ansvarar för att det finns laglig grund för de personuppgifter som kunden lämnar till Enkla Bokslut.</p>
          <p>Kunden ska inte lämna fler personuppgifter än vad som behövs för uppdraget.</p>
        </Section>

        <Section num="33" title="Underleverantörer och tekniska tjänster">
          <p>Enkla Bokslut har rätt att anlita underleverantörer för exempelvis:</p>
          <Bullets items={[
            'datalagring,',
            'e-post,',
            'kommunikation,',
            'betalningar,',
            'programvara,',
            'IT-drift,',
            'säkerhetskopiering,',
            'support,',
            'redovisning, och',
            'granskning.',
          ]} />
          <p>
            Enkla Bokslut ansvarar för underleverantörernas arbete i den utsträckning som följer av avtalet och
            tillämplig lag.
          </p>
          <p>Information om personuppgiftsunderbiträden lämnas i personuppgiftsbiträdesavtalet eller på annat anvisat sätt.</p>
          <p>
            Enkla Bokslut har rätt att byta teknisk leverantör eller underleverantör, förutsatt att kundens rättigheter
            och säkerheten inte väsentligt försämras.
          </p>
        </Section>

        <Section num="34" title="Säkerhet och drift">
          <p>Enkla Bokslut ska vidta rimliga tekniska och organisatoriska säkerhetsåtgärder med hänsyn till:</p>
          <Bullets items={[
            'tjänstens art,',
            'tillgänglig teknik,',
            'kostnaden för åtgärderna, och',
            'riskerna med behandlingen.',
          ]} />
          <p>Planerat underhåll ska när det är rimligt genomföras på ett sätt som begränsar störningen.</p>
          <p>
            Kunden ska omedelbart meddela Enkla Bokslut vid misstanke om obehörig åtkomst till kontot eller annan
            säkerhetsincident.
          </p>
        </Section>

        <Section num="35" title="Konto och inloggningsuppgifter">
          <p>Kunden ansvarar för att uppgifterna i kontot är korrekta och aktuella.</p>
          <p>Inloggningsuppgifter är personliga och ska skyddas mot obehörig användning.</p>
          <p>
            Kunden ansvarar för aktivitet som sker genom kundens konto, om inte aktiviteten beror på säkerhetsbrister
            som Enkla Bokslut ansvarar för.
          </p>
          <p>Kunden får inte:</p>
          <Bullets items={[
            'dela inloggningsuppgifter med obehöriga,',
            'försöka komma åt andra kunders uppgifter,',
            'belasta tjänsten på ett oskäligt sätt,',
            'sprida skadlig kod, eller',
            'försöka kringgå tjänstens säkerhet.',
          ]} />
          <p>Enkla Bokslut har rätt att tillfälligt spärra ett konto vid misstänkt obehörig användning.</p>
        </Section>

        <Section num="36" title="Fel och reklamation">
          <p>Kunden ska granska levererat material inom skälig tid.</p>
          <p>
            Om kunden upptäcker ett möjligt fel ska kunden meddela Enkla Bokslut utan oskäligt dröjsmål och lämna den
            information som behövs för att bedöma felet.
          </p>
          <p>Enkla Bokslut har rätt att i första hand:</p>
          <Bullets items={[
            'undersöka det påstådda felet,',
            'rätta felet,',
            'komplettera materialet, eller',
            'vidta annan skälig avhjälpande åtgärd.',
          ]} />
          <p>
            Kunden ska ge Enkla Bokslut skälig möjlighet att rätta ett fel innan kunden anlitar någon annan på Enkla
            Boksluts bekostnad.
          </p>
          <p>Kunden ska vidta rimliga åtgärder för att begränsa sin skada.</p>
          <p>Ersättning lämnas inte för den del av skadan som kunden skäligen hade kunnat undvika.</p>
        </Section>

        <Section num="37" title="Enkla Boksluts ansvar">
          <p>Enkla Bokslut ska utföra det avtalade uppdraget med omsorg och på ett fackmässigt sätt.</p>
          <p>
            Enkla Bokslut ska under avtalstiden ha en gällande ansvarsförsäkring som är anpassad för den redovisnings-
            och bokföringsverksamhet som omfattas av tjänsten. Försäkringen ska omfatta ansvar för ren
            förmögenhetsskada i den utsträckning som är sedvanlig och kommersiellt tillgänglig för verksamheten.
          </p>
          <p>
            På kundens begäran ska Enkla Bokslut kunna visa att en sådan försäkring finns. Försäkringens omfattning,
            försäkringsbelopp, självrisk och övriga villkor bestäms av det vid var tid gällande försäkringsavtalet. Att
            försäkring finns innebär inte att varje skada eller varje ersättningskrav omfattas av försäkringen.
          </p>
          <p>
            Enkla Bokslut ansvarar för direkt ekonomisk skada som kunden visar har orsakats genom fel eller vårdslöshet
            vid utförandet av ett arbete som omfattas av det avtalade uppdraget.
          </p>
          <p>
            För att ansvar ska föreligga ska det finnas ett direkt orsakssamband mellan Enkla Boksluts fel eller
            vårdslöshet och den skada som kunden har drabbats av.
          </p>
          <p>Enkla Bokslut ansvarar inte för fel, försening eller skada som helt eller delvis beror på:</p>
          <Bullets items={[
            'felaktiga, ofullständiga, otydliga eller sena uppgifter från kunden,',
            'att kunden har utelämnat en affärshändelse eller annan relevant omständighet,',
            'att kunden inte granskat eller godkänt material,',
            'att kunden inte lämnat nödvändig fullmakt eller ombudsbehörighet,',
            'att kunden inte följt Enkla Boksluts instruktioner eller tidsfrister,',
            'fel eller brister i kundens tidigare bokföring,',
            'arbete eller förhållanden som ligger utanför uppdragets omfattning,',
            'förändringar i kundens verksamhet som inte meddelats till Enkla Bokslut,',
            'att kunden själv eller genom någon annan har ändrat det material som Enkla Bokslut har tagit fram,',
            'beslut, omprövning eller bedömning från Skatteverket eller annan myndighet, om Enkla Boksluts bedömning varit fackmässig och rimlig utifrån tillgängliga uppgifter och det rättsläge som gällde när arbetet utfördes,',
            'fel eller avbrott i en myndighets eller tredje parts system,',
            'externa tjänster eller system utanför Enkla Boksluts rimliga kontroll, eller',
            'en omständighet enligt punkt 40.',
          ]} />
          <p>
            Om kunden har bidragit till skadan genom fel, försummelse eller bristande medverkan ska Enkla Boksluts
            ansvar jämkas i den omfattning som är skälig.
          </p>
          <p>
            Enkla Bokslut ansvarar inte för skatt, moms, egenavgift eller annan offentlig avgift som kunden skulle ha
            varit skyldig att betala även om uppdraget hade utförts korrekt.
          </p>
          <p>
            Enkla Bokslut ansvarar inte för att ett avdrag, ett yrkande eller en skatterättslig bedömning underkänns
            enbart på grund av att Skatteverket eller en domstol gör en annan bedömning, under förutsättning att Enkla
            Boksluts bedömning varit fackmässig och rimlig utifrån de uppgifter och det rättsläge som förelåg.
          </p>
          <p>
            Enkla Bokslut kan däremot, inom ramen för punkt 38, ansvara för en direkt ekonomisk merkostnad, exempelvis
            en förseningsavgift eller ett skattetillägg, om kunden visar att merkostnaden direkt har orsakats genom
            Enkla Boksluts vårdslöshet och inte skulle ha uppkommit om uppdraget hade utförts korrekt.
          </p>
          <p>
            Böter, viten och andra straffrättsliga eller offentligrättsliga sanktioner ersätts endast i den utsträckning
            ett sådant ansvar lagligen kan överföras och följer av dessa villkor.
          </p>
        </Section>

        <Section num="38" title="Ansvarsbegränsning">
          <p>Enkla Bokslut ansvarar inte för indirekt skada, exempelvis:</p>
          <Bullets items={[
            'utebliven vinst,',
            'produktionsbortfall,',
            'förlorad omsättning,',
            'förlorad affärsmöjlighet,',
            'goodwillförlust,',
            'följdskada,',
            'skada i kundens förhållande till tredje man, eller',
            'kostnader som inte är en omedelbar och rimligen förutsebar följd av felet.',
          ]} />
          <p>
            Detta undantag omfattar inte en direkt och skälig kostnad för att rätta ett fel som Enkla Bokslut ansvarar
            för enligt punkt 37.
          </p>
          <p>
            Enkla Boksluts sammanlagda ansvar för samtliga krav som grundas på samma fel, handling, underlåtenhet eller
            serie av sammanhängande händelser är begränsat till 1 000 000 kronor.
          </p>
          <p>
            Samtliga krav som har samma grundorsak eller som uppkommit genom samma eller sammanhängande handlingar eller
            underlåtenheter ska betraktas som ett enda skadefall vid tillämpning av ansvarstaket.
          </p>
          <p>Ansvarstaket gäller oavsett om kravet grundas på avtalet, vårdslöshet, skadeståndsrätt eller annan rättslig grund.</p>
          <p>Ersättning kan aldrig överstiga kundens styrkta, direkta ekonomiska skada.</p>
          <p>
            Kunden har inte någon självständig rätt till ersättning ur Enkla Boksluts försäkring. Enkla Boksluts ansvar
            gentemot kunden bestäms av detta avtal och tillämplig lag, medan försäkringsgivarens ersättningsskyldighet
            bestäms av försäkringsavtalet.
          </p>
          <p>
            Ansvarsbegränsningarna gäller i den utsträckning som är tillåten enligt lag och gäller inte vid uppsåt eller
            grov vårdslöshet.
          </p>
          <p>
            Kunden ska framställa ett ersättningskrav skriftligen utan oskäligt dröjsmål efter att kunden märkt eller
            borde ha märkt den omständighet som kravet grundas på.
          </p>
        </Section>

        <Section num="39" title="Förlust av data och cyberincidenter">
          <p>
            Enkla Bokslut ska upprätthålla rimliga rutiner för säkerhetskopiering och återställning av kritisk
            information i enlighet med punkt 34.
          </p>
          <p>Enkla Bokslut ansvarar inte för förlust, förvanskning eller otillgänglighet av data som beror på:</p>
          <Bullets items={[
            'kunden,',
            'kundens utrustning eller system,',
            'att kunden lämnat ut eller inte skyddat sina inloggningsuppgifter,',
            'obehörig användning som kunden ansvarar för,',
            'att kunden inte hämtat eller exporterat sitt material inom den tid som anges efter avtalets upphörande,',
            'ett fel eller en incident hos en extern tjänst som ligger utanför Enkla Boksluts rimliga kontroll,',
            'ett cyberangrepp som inte skäligen hade kunnat förhindras genom rimliga och fackmässiga säkerhetsåtgärder, eller',
            'en omständighet enligt punkt 40.',
          ]} />
          <p>
            Undantaget gäller inte om dataförlusten direkt har orsakats genom Enkla Boksluts vårdslöshet och hade kunnat
            förhindras genom de säkerhetsåtgärder som skäligen kunde krävas.
          </p>
          <p>Enkla Boksluts ansvar vid ersättningsbar dataförlust är begränsat till den skäliga och nödvändiga kostnaden för att:</p>
          <Bullets items={[
            'återställa tillgängliga säkerhetskopior,',
            'återskapa förlorad räkenskapsinformation, eller',
            'återställa materialet till närmast möjliga skick före incidenten.',
          ]} />
          <p>
            Enkla Bokslut ansvarar inte för värdet av information som inte kan återskapas eller för indirekta följder av
            dataförlust, annat än när annat följer av tvingande lag, uppsåt eller grov vårdslöshet.
          </p>
          <p>Ansvaret enligt denna punkt omfattas av ansvarstaket i punkt 38.</p>
        </Section>

        <Section num="40" title="Force majeure">
          <p>
            Enkla Bokslut ansvarar inte för försening eller underlåtenhet som beror på en omständighet utanför Enkla
            Boksluts rimliga kontroll.
          </p>
          <p>Det kan exempelvis vara:</p>
          <Bullets items={[
            'krig,',
            'myndighetsbeslut,',
            'naturkatastrof,',
            'epidemi eller pandemi,',
            'omfattande el- eller internetavbrott,',
            'cyberangrepp trots rimliga skyddsåtgärder,',
            'brand,',
            'strejk eller annan arbetskonflikt,',
            'fel i myndigheters e-tjänster,',
            'omfattande driftstörning hos en central underleverantör, eller',
            'ändrad lagstiftning som omedelbart påverkar tjänsten.',
          ]} />
          <p>Enkla Bokslut ska när det är rimligt informera kunden och försöka begränsa konsekvenserna.</p>
          <p>Om hindret består under längre tid än 60 dagar får vardera parten säga upp avtalet med omedelbar verkan.</p>
        </Section>

        <Section num="41" title="Ändringar i tjänsten">
          <p>Enkla Bokslut har rätt att utveckla och förändra tjänstens funktioner, tekniska utformning och arbetsmetoder.</p>
          <p>Ändringar får göras för att exempelvis:</p>
          <Bullets items={[
            'förbättra tjänsten,',
            'öka säkerheten,',
            'följa lag eller myndighetskrav,',
            'byta teknisk leverantör,',
            'effektivisera arbetsprocessen, eller',
            'avveckla funktioner som inte längre är lämpliga.',
          ]} />
          <p>
            En ändring får inte väsentligt minska den redovisningstjänst som kunden redan har betalat för utan att kunden
            får en skälig alternativ lösning eller rätt att säga upp tjänsten.
          </p>
        </Section>

        <Section num="42" title="Ändringar av villkoren">
          <p>Enkla Bokslut får ändra dessa villkor.</p>
          <p>Väsentliga ändringar meddelas normalt minst 30 dagar innan de träder i kraft.</p>
          <p>Kunden har rätt att säga upp avtalet innan en väsentlig ändring träder i kraft.</p>
          <p>
            Ändringar som krävs på grund av lag, myndighetsbeslut, säkerhetsskäl eller en omedelbar risk får träda i
            kraft med kortare varsel.
          </p>
          <p>Ändringar påverkar inte redan utfört arbete eller en redan betald period på ett oskäligt sätt.</p>
          <p>Den senaste versionen av villkoren finns på Enkla Boksluts webbplats.</p>
        </Section>

        <Section num="43" title="Överlåtelse">
          <p>Kunden får inte överlåta avtalet till någon annan utan Enkla Boksluts skriftliga godkännande.</p>
          <p>
            Enkla Bokslut får överlåta avtalet till ett annat bolag inom samma koncern eller i samband med överlåtelse av
            verksamheten, under förutsättning att kundens rättigheter inte väsentligt försämras.
          </p>
        </Section>

        <Section num="44" title="Fullständigt avtal">
          <p>Avtalshandlingarna utgör parternas fullständiga reglering av de frågor som avtalet omfattar.</p>
          <p>Muntliga uppgifter eller överenskommelser gäller endast om de har bekräftats skriftligen.</p>
          <p>Att en part inte omedelbart åberopar en rättighet innebär inte att parten har avstått från den.</p>
          <p>
            Om en bestämmelse är ogiltig ska övriga delar av avtalet fortsätta att gälla. Bestämmelsen ska i första hand
            justeras så att den så långt som möjligt uppnår sitt avsedda syfte på ett giltigt och skäligt sätt.
          </p>
        </Section>

        <Section num="45" title="Tillämplig lag och tvist">
          <p>Svensk rätt ska tillämpas på avtalet.</p>
          <p>Parterna ska i första hand försöka lösa en tvist genom dialog.</p>
          <p>Om parterna inte kan komma överens ska tvisten avgöras av svensk allmän domstol.</p>
        </Section>

        <Section num="46" title="Kontakt">
          <p>Frågor om dessa villkor eller tjänsten kan skickas till:</p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 space-y-1">
            <p><strong className="text-slate-800">Enkla Bokslut – Sethapp Innovation AB</strong></p>
            <p>E-post:{' '}
              <a href="mailto:info@enklabokslut.se" className="font-medium hover:opacity-80" style={{ color: CORAL }}>
                info@enklabokslut.se
              </a>
            </p>
            <p>Telefon: 0793-119676</p>
            <p>Adress: c/o Erik Seth, Ulrikedalsvägen 10 C, lägenhet 1109, 224 58 Lund</p>
          </div>
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
