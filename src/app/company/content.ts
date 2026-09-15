/**
 * Allt innehåll på company.enklabokslut.se ligger i den här filen och i
 * content.sv.ts.
 *
 * Sidan finns på engelska (här) och svenska (content.sv.ts). Besökaren byter
 * med flaggorna uppe till höger, som sätter ?lang=sv eller ?lang=en.
 * Engelska är förval. Ändrar du en mening här, ändra den i den svenska filen
 * också. Siffrorna i figurerna ligger bara här — den svenska filen lånar dem.
 *
 * Sidan (page.tsx) innehåller bara layout — du behöver aldrig läsa någon JSX.
 *
 * Texten är hämtad ur bolagsdokumentet och medvetet försiktig: inga siffror,
 * inga påståenden som kräver underlag. Figurerna är därför också schematiska
 * och saknar skalor — de visar formen på ett argument, inte ett mätvärde.
 * Lägger du in siffror någonstans, se till att du kan visa dem i ett
 * due diligence-samtal.
 */

export type Sprak = 'en' | 'sv';

/**
 * Filmen bakom heron. Saknas filerna bär bakgrundens gradient sig själv, så
 * sidan ser hel ut även utan film.
 *
 * Lägg till fler filer i listan så tonar heron över till nästa när ett klipp
 * tar slut, i stället för att loopa samma. Med ett klipp loopar det.
 *
 * Filen som ligger där nu är en platshållare: "Close up of a tall stack of
 * papers" från Mixkit (mixkit.co, klipp 45923), 1280x720, 9,7 sekunder,
 * 3,0 MB. Mixkit Free License — fri även kommersiellt, ingen attribution
 * krävs.
 *
 * Ersättare bör vara tysta, 8–15 sekunder och under ~4 MB. Viktigast:
 * texten ligger till vänster, så välj klipp där den vänstra tredjedelen är
 * lugn och det som händer ligger till höger.
 */
export const heroVideo = {
  /**
   * Vad heron visar som standard: 'kod' är det animerade rutnätet
   * (HeroRutnat.tsx), annars namnet på en filmkandidat nedan.
   */
  standard: 'kod' as Videonamn | 'kod',
  poster: '',
};

/**
 * PROVKÖRNING — välj en och ta bort resten (och deras filer i /public).
 *
 * Öppna sidan med ?video=<namn> för att se en kandidat, t.ex.
 * localhost:3000/company?video=black, eller ?video=kod för rutnätet.
 * Alla klipp är från Mixkit under
 * "Mixkit Stock Video Free License": fria även kommersiellt, ingen
 * attribution krävs.
 *
 * filter gör klippen svartvita innan heron lägger sin mörkblå ton över dem,
 * så de läser som ljus och rörelse i era färger — inte som ett fotograferat
 * motiv. Bläckklippet är vitt i original och inverteras till ljust bläck på
 * mörk botten.
 */
export const videokandidater = {
  /** Blått satintyg i långsamma veck, närbild. Mixkit 51005, 3,2 MB. */
  satin: { src: '/company-hero-51005.mp4', filter: 'grayscale(1) brightness(0.75) contrast(1.2)' },
  /** Samma tyg, lugnare rörelse och mjukare ljus. Mixkit 51002, 3,5 MB. */
  tyg: { src: '/company-hero-51002.mp4', filter: 'grayscale(1) brightness(0.75) contrast(1.15)' },
  /** Bläck som flyter ut i vätska, inverterat. Mixkit 44818, 6,6 MB. */
  black: { src: '/company-hero-44818.mp4', filter: 'invert(1) grayscale(1) brightness(0.85) contrast(1.1)' },
  /** Den tidigare pappersbunten, med samma ton som de andra. Mixkit 45923. */
  papper: { src: '/company-hero.mp4', filter: 'grayscale(1) contrast(1.1)' },
};

export type Videonamn = keyof typeof videokandidater;

export const en = {
  /**
   * Menyn i toppen. Håll den kort — fyra länkar räcker. href pekar på
   * avsnittens id i page.tsx.
   */
  meny: {
    varumarke: 'Enkla Bokslut',
    del: 'part of Sethapp Innovation',
    /** Texten på dropdown-knappen. */
    etikett: 'Menu',
    lankar: [
      { text: 'Market', href: '#market' },
      { text: 'Economics', href: '#economics' },
      { text: 'Platform', href: '#platform' },
      { text: 'Path to scale', href: '#path' },
    ],
    kontakt: { text: 'Contact', href: '#contact' },
  },

  hero: {
    spine: 'Overview',
    rubrik: 'Building scalable accounting for small businesses',
    stycken: [
      'Sethapp develops technology-enabled financial services designed to make accounting simpler, more efficient and more scalable.',
      'Our first service, Enkla Bokslut — part of Sethapp Innovation — is already serving paying customers and has demonstrated that a standardized, technology-supported operating model can deliver high-quality accounting profitably at a low price point.',
      'We are building on that foundation to create a scalable platform for the next generation of small-business financial services.',
    ],
    cta: { text: 'Get in touch', href: 'mailto:erik@enklabokslut.se' },
  },

  /**
   * Fokuserad marknad.
   *
   * Figuren: ett fält av rutor där ett avgränsat block skärps till och ramas
   * in medan resten bleknar. Den visar vad "clearly defined segment" betyder
   * utan att påstå någon storlek.
   */
  fokus: {
    spine: 'Focus',
    rubrik: 'Focused market',
    stycken: [
      'Enkla Bokslut is built for a clearly defined segment of small businesses with recurring accounting needs and relatively standardized requirements.',
      'This focus allows the service to be simpler, more efficient and better adapted to the customer than broader solutions designed to serve many different types of businesses.',
    ],
    figur: {
      kolumner: 24,
      rader: 12,
      /** Blockets storlek i rutor, räknat från övre vänstra hörnet. */
      segmentKolumner: 6,
      segmentRader: 4,
      etikett: 'The segment Enkla Bokslut is built for',
      bildtext:
        'Small businesses with recurring needs and standardized requirements. Everything outside the frame is a different service with different economics.',
    },
  },

  /**
   * Bevisad efterfrågan. Medvetet utan kundremsa — inga kunder visas på sidan.
   *
   * Figuren: siffran räknar upp till antal och en ruta fylls i per kund, i
   * takt med siffran. Rutnätet har alltid 100 rutor, så över 100 är alla
   * fyllda och tillägget ("+") säger resten.
   */
  efterfragan: {
    spine: 'Demand',
    rubrik: 'Proven demand',
    stycken: [
      'Enkla Bokslut is already used by paying customers in the target segment, demonstrating real demand for a simpler and more affordable accounting service.',
      'The service has been validated in the market with real businesses, real accounting workflows and recurring customer relationships — moving the concept beyond an idea and into a proven operating model.',
    ],
    figur: {
      antal: 100,
      tillagg: '+',
      etikett: 'paying customers',
      bildtext: 'Each square is one paying customer.',
    },
  },

  /**
   * Bevisad lönsamhet.
   *
   * Figuren: en skala där brytpunkten ligger tidigt och nuläget redan
   * passerat den. Medvetet utan siffror — den visar ordningen mellan två
   * punkter, inte hur långt det är mellan dem.
   */
  lonsamhet: {
    spine: 'Economics',
    rubrik: 'Proven profitability',
    stycken: [
      'The model is already economically viable at a small scale, demonstrating that Enkla Bokslut can serve customers profitably without relying on future volume to make the business work.',
      'This provides a strong foundation for growth: as the customer base expands and operations become more efficient, the underlying economics have the potential to improve further.',
    ],
    figur: {
      axel: 'Volume',
      brytpunkt: { position: 26, etikett: 'Break-even' },
      nulage: { position: 48, etikett: 'Current scale' },
      kvar: 'Headroom',
      bildtext:
        'Illustrative. The point is the order of the two markers, not the distance between them: the business does not depend on future volume to work.',
    },
  },

  /**
   * Standardiserad leverans.
   *
   * Figuren: staplar med olika höjd som rättar in sig i samma höjd. Det är
   * "reducing unnecessary variation", visat i stället för sagt.
   */
  standard: {
    spine: 'Delivery',
    rubrik: 'Standardized delivery',
    stycken: [
      'Enkla Bokslut is built around a standardized operating model designed specifically for a clearly defined customer segment.',
      'By reducing unnecessary variation and handling customers through consistent processes, the business can deliver reliable quality while keeping operations efficient and easier to scale.',
    ],
    figur: {
      /** Utgångshöjder i procent. De rättar in sig i samma höjd vid avslöjandet. */
      fran: [38, 82, 55, 94, 47, 71, 33, 88, 62, 76, 41, 68],
      till: 66,
      fore: 'Case-by-case handling',
      efter: 'One consistent process',
      bildtext:
        'Illustrative. Variation between customers is what makes accounting expensive to deliver. Removing it is what makes the model repeatable.',
    },
  },

  /**
   * Skalbarhet.
   *
   * Figuren: två kurvor som glider isär. Kunder stiger, manuellt arbete gör
   * det nästan inte. Ingen skala — formen är hela påståendet.
   */
  skalbarhet: {
    spine: 'Scale',
    rubrik: 'Scalability',
    stycken: [
      'The operating model is designed so that customer growth does not require a proportional increase in manual work.',
      'As volume increases, standardized processes and technology allow more customers to be handled within the same operational structure, creating the potential for improving efficiency and margins over time.',
    ],
    figur: {
      kunder: 'Customers',
      arbete: 'Manual work',
      axel: 'Time',
      bildtext:
        'Illustrative. The gap between the two lines is the margin the model is designed to create.',
    },
  },

  /**
   * Egen teknikplattform.
   *
   * Figuren: lagren som byggs upp. Komponenterna nedan finns på riktigt i
   * kodbasen — byt bara om något stämmer illa.
   */
  plattform: {
    spine: 'Platform',
    rubrik: 'Proprietary technology platform',
    stycken: [
      'Sethapp has developed its own technology platform to support the delivery and continued development of Enkla Bokslut.',
      'The platform is built around the specific needs of the business and provides a foundation for greater efficiency, consistency and future scale.',
    ],
    lager: [
      { titel: 'Document parsing', text: 'PDF, images and SIE files read and structured into transactions.' },
      { titel: 'Indexed rule base', text: 'Swedish rules searchable, so the system looks up instead of guessing.' },
      { titel: 'Customer communication', text: 'Email and SMS handled by the platform, with full thread context.' },
      { titel: 'Accounts generation', text: 'Finished filings out the other end, ready to submit.' },
      { titel: 'Operations console', text: 'The whole customer journey in one view, built for one person to run many.' },
    ],
    bildtext: 'Built in-house. Nothing is bought in or white-labelled.',
  },

  /**
   * Försvarbar modell.
   *
   * Figuren: fyra delar som löper ihop till en. Poängen är att ingen av dem
   * ensam är ett försvar — det är kombinationen.
   */
  forsvar: {
    spine: 'Moat',
    rubrik: 'Defensible operating model',
    stycken: [
      'The combination of a focused customer segment, standardized processes, proprietary technology and experience from real customer cases creates an operating model that becomes stronger as the business develops.',
      'Over time, this accumulated knowledge can improve efficiency, consistency and the ability to handle a growing range of real-world situations.',
    ],
    delar: [
      'A focused customer segment',
      'Standardized processes',
      'Proprietary technology',
      'Experience from real cases',
    ],
    nav: 'An operating model that compounds',
  },

  /**
   * Vägen framåt.
   *
   * Figuren: etapper på en linje. Den första är avklarad och fylld, resten
   * står öppna — inga löften om tidpunkter.
   */
  vagen: {
    spine: 'Ahead',
    rubrik: 'Path to scale',
    stycken: [
      'The model has first been proven at a small scale, creating a foundation for controlled growth.',
      'The next stage is to expand the customer base, increase operational efficiency and continue developing the platform while maintaining the simplicity and quality of the service.',
    ],
    etapper: [
      { titel: 'Proven at small scale', text: 'Paying customers, real workflows, viable economics.', klar: true },
      { titel: 'Controlled growth', text: 'A larger customer base handled within the same structure.', klar: false },
      { titel: 'Continued development', text: 'More of the work absorbed by the platform over time.', klar: false },
    ],
  },

  /**
   * Grundaren.
   *
   * Texten är en platshållare skriven utan fakta om din bakgrund. Byt ut
   * stycken mot din egen berättelse innan sidan delas.
   *
   * bild: lägg ett porträtt i /public (t.ex. /erik-seth.jpg, gärna ungefär
   * kvadratiskt) och skriv sökvägen här. Tom sträng visar initialerna.
   */
  grundare: {
    spine: 'Founder',
    namn: 'Erik Seth',
    roll: 'Founder, Sethapp Innovation',
    bild: '',
    stycken: [
      'Erik founded Sethapp Innovation and built Enkla Bokslut from its first customer.',
      'He leads the company’s product, technology and operations, and is responsible for the operating model the service is built on.',
    ],
  },

  kontakt: {
    spine: 'Contact',
    rubrik: 'Want to know more about Sethapp?',
    text: 'Reach out to me directly and we will talk.',
    namn: 'Erik Seth',
    roll: 'founder',
    epost: 'erik@enklabokslut.se',
    fotnot: 'Enkla Bokslut, part of Sethapp Innovation',
    lank: 'enklabokslut.se',
  },
};

export type Innehall = typeof en;
