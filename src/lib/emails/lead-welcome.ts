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
 * Därav också: inga <style>, inga inline-stilar, inga tabeller i själva texten.
 * Bara stycken. Gmail renderar då i mottagarens vanliga brödtext, precis som
 * ett skrivet mejl. `stripHtml` i Apps Script gör textversionen av samma
 * stycken.
 *
 * Undantaget är signaturen sist. Den är formgiven, och det är meningen: ett
 * skrivet mejl slutar med en signatur, det är frånvaron av en som ser konstig
 * ut. Gmail lägger inte på sin egen här, eftersom mejlet går via
 * `GmailApp.sendEmail` och inte via compose-fönstret.
 *
 * Uppmaningen är att svara på mejlet, inte att klicka på en länk. Svaret går
 * till mail-AI:n som ställer kvalificeringsfrågorna, så brödtexten innehåller
 * medvetet inga länkar alls. De två i signaturen är numret och domänen.
 */

import { SIGNATURE_HTML } from './signature';

const PARAGRAPHS = [
  'Hej,',

  'Du fyllde nyligen i vårt formulär för att få veta mer om EnklaBokslut.',

  'Vi hjälper mindre enskilda firmor med löpande bokföring, momsredovisning, '
    + 'bokslut och deklaration. Tanken är att det ska vara så enkelt som möjligt '
    + 'för dig. Du mejlar in dina kvitton, fakturor, kontoutdrag och andra '
    + 'underlag, så sköter vi bokföringen och hör av oss om det är något vi '
    + 'behöver fråga om.',

  'Priset är 299 kr per månad exklusive moms. Om du börjar under året betalar '
    + 'du också för de månader som redan har gått, eftersom vi då tar hand om '
    + 'bokföringen för hela året. Om du hellre vill betala årsvis går det också '
    + 'bra. Då är priset 3 999 kr exklusive moms för året.',

  'Vi tar in ett begränsat antal kunder så om du funderar på att komma igång är '
    + 'det bra om du hör av dig snabbt. Det gör också att vi kan få in underlagen '
    + 'och komma igång i lugn och ro, istället för att allt behöver göras nära '
    + 'bokslut och deklaration. Det är bättre för både dig och oss!',

  'När året är slut gör vi klart bokslutet, momsdeklarationen och '
    + 'inkomstdeklarationen och lämnar in det som ska lämnas in till Skatteverket.',

  'Låter det intressant? Svara bara ja på mejlet så skickar jag några enkla '
    + 'frågor för att se om det passar din verksamhet. Om du undrar över något '
    + 'är det bara att svara på mejlet med din fråga.',
];

export function leadWelcomeEmail(): { subject: string; html: string } {
  const html = PARAGRAPHS.map((p) => `<p>${p}</p>`).join('\n') + '\n' + SIGNATURE_HTML;

  return { subject: 'Du fyllde i vårt formulär – här är lite mer info', html };
}
