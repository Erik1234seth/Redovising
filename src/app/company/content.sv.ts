import { en, type Innehall } from './content';

/**
 * Sidan på svenska. Samma form som den engelska i content.ts — TypeScript
 * säger till om något fält saknas. Figurernas siffror lånas från den
 * engelska versionen, så de kan inte glida isär mellan språken.
 */
export const sv: Innehall = {
  meny: {
    varumarke: 'Enkla Bokslut',
    del: 'en del av Sethapp Innovation',
    etikett: 'Meny',
    lankar: [
      { text: 'Marknad', href: '#market' },
      { text: 'Ekonomi', href: '#economics' },
      { text: 'Plattform', href: '#platform' },
      { text: 'Vägen framåt', href: '#path' },
    ],
    kontakt: { text: 'Kontakt', href: '#contact' },
  },

  hero: {
    spine: 'Översikt',
    rubrik: 'Vi bygger skalbar redovisning för småföretag',
    stycken: [
      'Sethapp utvecklar teknikdrivna finansiella tjänster som gör redovisning enklare, effektivare och mer skalbar.',
      'Vår första tjänst, Enkla Bokslut — en del av Sethapp Innovation — har redan betalande kunder och har visat att en standardiserad, teknikstödd verksamhetsmodell kan leverera redovisning av hög kvalitet, lönsamt och till ett lågt pris.',
      'På den grunden bygger vi en skalbar plattform för nästa generations finansiella tjänster för småföretag.',
    ],
    cta: { text: 'Kontakta oss', href: en.hero.cta.href },
  },

  fokus: {
    spine: 'Fokus',
    rubrik: 'Fokuserad marknad',
    stycken: [
      'Enkla Bokslut är byggt för ett tydligt avgränsat segment av småföretag med återkommande redovisningsbehov och relativt standardiserade krav.',
      'Fokuset gör att tjänsten kan vara enklare, effektivare och bättre anpassad till kunden än bredare lösningar som ska passa många olika typer av företag.',
    ],
    figur: {
      ...en.fokus.figur,
      etikett: 'Segmentet Enkla Bokslut är byggt för',
      bildtext:
        'Småföretag med återkommande behov och standardiserade krav. Allt utanför ramen är en annan tjänst med en annan ekonomi.',
    },
  },

  efterfragan: {
    spine: 'Efterfrågan',
    rubrik: 'Bevisad efterfrågan',
    stycken: [
      'Enkla Bokslut används redan av betalande kunder i målsegmentet, vilket visar att det finns en verklig efterfrågan på en enklare och mer prisvärd redovisningstjänst.',
      'Tjänsten är prövad på marknaden med riktiga företag, riktiga redovisningsflöden och återkommande kundrelationer — konceptet är inte längre en idé utan en bevisad verksamhetsmodell.',
    ],
    figur: {
      ...en.efterfragan.figur,
      etikett: 'betalande kunder',
      bildtext: 'Varje ruta är en betalande kund.',
    },
  },

  lonsamhet: {
    spine: 'Ekonomi',
    rubrik: 'Bevisad lönsamhet',
    stycken: [
      'Modellen är redan lönsam i liten skala. Enkla Bokslut kan betjäna kunder med vinst utan att vara beroende av framtida volym för att verksamheten ska gå ihop.',
      'Det ger en stark grund för tillväxt: när kundbasen växer och driften blir effektivare har den underliggande ekonomin potential att bli ännu bättre.',
    ],
    figur: {
      ...en.lonsamhet.figur,
      axel: 'Volym',
      brytpunkt: { ...en.lonsamhet.figur.brytpunkt, etikett: 'Nollpunkt' },
      nulage: { ...en.lonsamhet.figur.nulage, etikett: 'Nuvarande skala' },
      kvar: 'Utrymme',
      bildtext:
        'Illustrativ. Poängen är ordningen mellan de två markeringarna, inte avståndet mellan dem: verksamheten är inte beroende av framtida volym.',
    },
  },

  standard: {
    spine: 'Leverans',
    rubrik: 'Standardiserad leverans',
    stycken: [
      'Enkla Bokslut bygger på en standardiserad verksamhetsmodell som är utformad specifikt för ett tydligt avgränsat kundsegment.',
      'Genom att minska onödig variation och hantera kunderna i enhetliga processer kan verksamheten leverera jämn kvalitet, samtidigt som driften hålls effektiv och lättare att skala.',
    ],
    figur: {
      ...en.standard.figur,
      fore: 'Hantering från fall till fall',
      efter: 'En enhetlig process',
      bildtext:
        'Illustrativ. Variationen mellan kunder är det som gör redovisning dyr att leverera. Att ta bort den är det som gör modellen upprepbar.',
    },
  },

  skalbarhet: {
    spine: 'Skala',
    rubrik: 'Skalbarhet',
    stycken: [
      'Verksamhetsmodellen är utformad så att fler kunder inte kräver en motsvarande ökning av manuellt arbete.',
      'När volymen ökar gör standardiserade processer och teknik att fler kunder kan hanteras inom samma organisation, vilket ger potential för bättre effektivitet och marginaler över tid.',
    ],
    figur: {
      kunder: 'Kunder',
      arbete: 'Manuellt arbete',
      axel: 'Tid',
      bildtext:
        'Illustrativ. Glappet mellan de två linjerna är marginalen modellen är byggd för att skapa.',
    },
  },

  plattform: {
    spine: 'Plattform',
    rubrik: 'Egen teknikplattform',
    stycken: [
      'Sethapp har utvecklat en egen teknikplattform för att leverera och vidareutveckla Enkla Bokslut.',
      'Plattformen är byggd kring verksamhetens specifika behov och ger en grund för högre effektivitet, jämnare kvalitet och framtida skala.',
    ],
    lager: [
      { titel: 'Dokumenttolkning', text: 'PDF:er, bilder och SIE-filer läses in och struktureras till transaktioner.' },
      { titel: 'Indexerad regelbas', text: 'Svenska regler är sökbara, så systemet slår upp i stället för att gissa.' },
      { titel: 'Kundkommunikation', text: 'Mejl och sms hanteras av plattformen, med hela konversationen som underlag.' },
      { titel: 'Framtagning av bokslut', text: 'Färdiga underlag kommer ut i andra änden, redo att lämnas in.' },
      { titel: 'Driftpanel', text: 'Hela kundresan i en vy, byggd för att en person ska kunna hantera många.' },
    ],
    bildtext: 'Byggt i egen regi. Ingenting är inköpt eller white label.',
  },

  forsvar: {
    spine: 'Försvar',
    rubrik: 'Försvarbar verksamhetsmodell',
    stycken: [
      'Kombinationen av ett fokuserat kundsegment, standardiserade processer, egen teknik och erfarenhet från verkliga kundärenden skapar en verksamhetsmodell som blir starkare i takt med att verksamheten utvecklas.',
      'Över tid kan den samlade kunskapen förbättra effektiviteten, kvaliteten och förmågan att hantera allt fler situationer som uppstår i verkligheten.',
    ],
    delar: [
      'Ett fokuserat kundsegment',
      'Standardiserade processer',
      'Egen teknik',
      'Erfarenhet från verkliga ärenden',
    ],
    nav: 'En verksamhetsmodell som växer i värde',
  },

  vagen: {
    spine: 'Framåt',
    rubrik: 'Vägen mot skala',
    stycken: [
      'Modellen har först bevisats i liten skala, vilket ger en grund för kontrollerad tillväxt.',
      'Nästa steg är att utöka kundbasen, öka effektiviteten i driften och fortsätta utveckla plattformen — utan att tumma på tjänstens enkelhet och kvalitet.',
    ],
    etapper: [
      { titel: 'Bevisad i liten skala', text: 'Betalande kunder, riktiga flöden, fungerande ekonomi.', klar: true },
      { titel: 'Kontrollerad tillväxt', text: 'En större kundbas inom samma struktur.', klar: false },
      { titel: 'Fortsatt utveckling', text: 'Plattformen tar över mer av arbetet över tid.', klar: false },
    ],
  },

  grundare: {
    ...en.grundare,
    spine: 'Grundare',
    roll: 'Grundare, Sethapp Innovation',
    stycken: [
      'Erik grundade Sethapp Innovation och har byggt Enkla Bokslut från den första kunden.',
      'Han leder bolagets produkt, teknik och drift, och ansvarar för verksamhetsmodellen som tjänsten bygger på.',
    ],
  },

  kontakt: {
    ...en.kontakt,
    spine: 'Kontakt',
    rubrik: 'Vill du veta mer om Sethapp?',
    text: 'Hör av dig direkt till mig så pratar vi.',
    roll: 'grundare',
    fotnot: 'Enkla Bokslut, en del av Sethapp Innovation',
  },
};
