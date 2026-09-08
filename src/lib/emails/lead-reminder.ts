/**
 * Påminnelsen till leads som fick välkomstmejlet men aldrig hörde av sig.
 *
 * Samma form som `lead-welcome.ts` och av samma skäl: inga färger, inga ramar,
 * inga länkar i brödtexten. Mejlet går från Eriks Gmail och ska se ut som ett
 * skrivet mejl, för det är den sortens mejl man svarar på. Svaret landar då i
 * tråden som mail-AI:n bevakar och kvalificeringen kan börja där.
 *
 * Innehållet upprepar erbjudandet i kort form. Den som inte läste det första
 * mejlet ska inte behöva leta upp det, och den som läste det behöver inte
 * påminnas om varje detalj.
 *
 * Sista stycket är viktigast: en påminnelse till någon som inte svarat måste
 * innehålla ett tydligt sätt att säga nej. Det är enda anständiga sättet att
 * höra av sig en andra gång, och det gör att den som inte är intresserad
 * svarar i stället för att markera oss som skräppost.
 *
 * Det går bara en påminnelse per person, någonsin — se cron-jobbet i
 * `src/app/api/cron/lead-reminders/route.ts` för spärrarna.
 */

import { SIGNATURE_HTML } from './signature';

/** Märkningen i email_log, som också är spärren mot ett andra utskick. */
export const REMINDER_EMAIL_KIND = 'lead_paminnelse';

const PARAGRAPHS = [
  'Hej,',

  'Jag hörde av mig för ett par veckor sedan, efter att du fyllt i vårt '
    + 'formulär om bokföring för enskild firma. Jag vet inte om mejlet '
    + 'försvann i inkorgen eller om det bara inte var rätt läge, så jag gör ett '
    + 'försök till.',

  'Kort om vad vi gör: vi sköter löpande bokföring, momsredovisning, bokslut '
    + 'och deklaration för mindre enskilda firmor. Du mejlar in kvitton, '
    + 'fakturor och kontoutdrag, så gör vi resten och hör av oss om det är '
    + 'något vi behöver fråga om.',

  'Priset är 299 kr per månad exklusive moms, eller 3 999 kr exklusive moms om '
    + 'du betalar för hela året. Börjar du mitt under året tar vi hand om '
    + 'bokföringen för hela året, och då betalar du också för de månader som '
    + 'redan har gått.',

  'Är det fortfarande aktuellt? Svara bara ja på det här mejlet så skickar jag '
    + 'några enkla frågor för att se om det passar din verksamhet. Undrar du '
    + 'över något är det lika bra att svara här med din fråga.',

  'Och är det inte aktuellt är det helt okej — säg bara till, så hör jag inte '
    + 'av mig igen.',
];

export function leadReminderEmail(): { subject: string; html: string } {
  const html = PARAGRAPHS.map((p) => `<p>${p}</p>`).join('\n') + '\n' + SIGNATURE_HTML;

  return { subject: 'Är bokföringen fortfarande aktuell?', html };
}
