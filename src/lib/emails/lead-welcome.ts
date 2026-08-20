/**
 * Välkomstmejlet till nya leads från Facebooks snabbformulär.
 *
 * Skickades tidigare av Zapier, vilket gjorde det osynligt för adminpanelen.
 * Nu går det härifrån tillsammans med välkomst-SMS:et, så att båda hamnar i
 * personens tidslinje.
 *
 * SMS:et säger uttryckligen "vi har precis skickat ett mejl till dig", så det
 * här mejlet är det som bär innehållet — SMS:et pekar bara hit.
 *
 * Medvetet utan formgivning: ingen logotyp, inga färger, inga ramar. Mejlet
 * går från Eriks egen Gmail och ska se ut som om han skrivit det i fönstret,
 * för det är den sortens mejl man svarar på. Ett nyhetsbrevsutseende hade
 * signalerat massutskick, och hela poängen är att svaret ska landa i tråden
 * som mail-AI:n bevakar.
 *
 * Därav också: inga <style>, inga inline-stilar, inga tabeller. Bara stycken.
 * Gmail renderar då i mottagarens vanliga brödtext, precis som ett skrivet
 * mejl. `stripHtml` i Apps Script gör textversionen av samma stycken.
 */

const START_URL = 'https://www.enklabokslut.se/kvalificera';
const SITE_URL = 'https://www.enklabokslut.se/';

/** Länkar skrivs ut i klartext, som när man klistrar in en adress själv. */
function link(url: string): string {
  return `<a href="${url}">${url}</a>`;
}

const PARAGRAPHS = [
  'Hej,',

  'Du fyllde nyligen i vårt formulär för att få veta mer om EnklaBokslut och det är vi glada för!',

  'Vi har valt att fokusera på mindre företag med relativt enkla verksamheter. '
    + 'Det gör att vi kan hålla nere priset samtidigt som vi tar hand om det som '
    + 'behövs för att redovisningen ska bli rätt.',

  'Upplägget är enkelt. Du mejlar in dina kvitton, fakturor, kontoutdrag och '
    + 'eventuella listor från till exempel PayPal, eller en egen Excel-fil om du '
    + 'brukar använda det. Vi sköter bokföringen och hör av oss om det är något '
    + 'vi behöver fråga om eller komplettera.',

  'När året är slut sätter vi ihop allt inför bokslut, momsdeklaration och '
    + 'inkomstdeklaration, ställer frågor om det behövs och lämnar in till Skatteverket.',

  'Tanken är helt enkelt att du ska behöva lägga så lite tid som möjligt på '
    + 'redovisningen själv – du skickar in underlagen, så tar vi hand om resten.',

  'Om du vill komma igång är nästa steg att svara på några korta frågor om ditt '
    + 'företag, välja om du vill ha ett månads- eller årsabonnemang och skapa konto. '
    + 'Sen är det bara att börja maila dina underlag.',

  `Du kommer igång här:<br>${link(START_URL)}`,

  `Om du vill kolla lite själv först så är hemsidan ${link(SITE_URL)} också full av information.`,

  'En sak till. Priset är fast så du behöver aldrig oroa dig för vad det kostar:).',

  'Hör gärna av dig om du undrar över något!',
];

export function leadWelcomeEmail(): { subject: string; html: string } {
  const html = PARAGRAPHS.map((p) => `<p>${p}</p>`).join('\n');

  return { subject: 'Tack — här är nästa steg', html };
}
