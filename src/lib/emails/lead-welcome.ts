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
 * stycken. Av samma skäl är ämnesraden skriven som en människa skriver den:
 * ingen tankstreckskonstruktion, inget säljspråk, bara vad mejlet innehåller.
 *
 * Undantaget är signaturen sist. Den är formgiven, och det är meningen: ett
 * skrivet mejl slutar med en signatur, det är frånvaron av en som ser konstig
 * ut. Gmail lägger inte på sin egen här, eftersom mejlet går via
 * `GmailApp.sendEmail` och inte via compose-fönstret. Signaturen bär redan
 * hälsningsfrasen och namnet, så brödtexten ska inte sluta med en egen.
 *
 * Uppmaningen är att svara på mejlet, inte att klicka på en länk. Svaret går
 * till mail-AI:n som ställer kvalificeringsfrågorna, så brödtexten innehåller
 * medvetet inga länkar alls — uppladdningssidan nämns i ord, inte som länk.
 * De två i signaturen är numret och domänen.
 */

import { SIGNATURE_HTML } from './signature';

const PARAGRAPHS = [
  'Hej,',

  'Kul att du är intresserad av EnklaBokslut.',

  'Jag tänker att jag beskriver lite kort hur EnklaBokslut funkar och om du '
    + 'tycker det låter intressant så kan vi gå in mer på detaljer senare.',

  'Vi får ofta frågan hur vi kan hålla ett så lågt pris och om vi verkligen gör '
    + 'samma sak som traditionella byråer. Det handlar om att vi har fokuserat '
    + 'på just enskilda mindre firmor utan anställda som oftast har relativt få '
    + 'transaktioner och byggt hela vårt system kring det. Vi följer samma regler '
    + 'och gör samma sak men inte på samma sätt.',

  'Tjänsten fungerar så att ni skickar in alla underlag (kvitton, fakturor, '
    + 'kontoutdrag eller annat) via mail eller direkt på vår uppladdningssida. '
    + 'Om vi har frågor på det ni laddat upp så hör vi av oss. När vi sätter ihop '
    + 'bokslutet kan det hända att vi har någon mer fråga men bara kring '
    + 'verksamheten, aldrig om bokföring.',

  'Jag vill att ni ska känna er trygga med att er del i arbetet är att ladda upp '
    + 'underlagen så sköter vi resten. Vi har koll på reglerna så det behöver ni '
    + 'inte ha.',

  'När året är slut gör vi klart bokslutet, momsdeklarationen och '
    + 'inkomstdeklarationen och lämnar in det som ska lämnas in till Skatteverket. '
    + 'Alla delar ingår i priset (299 per månad eller 3999 per år) och vi har inga '
    + '"tillval" som kostar extra.',

  'Har du någon annan fundering?',
];

export function leadWelcomeEmail(): { subject: string; html: string } {
  const html = PARAGRAPHS.map((p) => `<p>${p}</p>`).join('\n') + '\n' + SIGNATURE_HTML;

  return { subject: 'Lite kort om hur EnklaBokslut funkar', html };
}
