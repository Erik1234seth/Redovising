/**
 * Påminnelsen till leads som fick välkomstmejlet men aldrig hörde av sig.
 *
 * Samma form som `lead-welcome.ts` och av samma skäl: inga färger, inga ramar,
 * inga länkar i brödtexten. Mejlet går från Eriks Gmail och ska se ut som ett
 * skrivet mejl, för det är den sortens mejl man svarar på. Svaret landar då i
 * tråden som mail-AI:n bevakar och kvalificeringen kan börja där.
 *
 * Medvetet kort, och medvetet utan pris och tjänstebeskrivning. Allt det stod i
 * välkomstmejlet och finns kvar i inkorgen. Upprepar påminnelsen det blir den
 * ett andra säljutskick, och då läser mottagaren den som ett massmejl. En
 * påminnelse ska låta som en människa som undrar hur det gick — inget annat.
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

  'Jag hörde av mig för ett par veckor sedan om bokföringen för din firma, men '
    + 'har inte hört något sedan dess. Jag vet hur det är — sådant här hamnar '
    + 'lätt längst ner i högen.',

  'Är det fortfarande aktuellt? Svara bara på det här mejlet så tar vi det '
    + 'därifrån. Har du en fråga i stället är det lika bra att ställa den här.',

  'Och är det inte aktuellt är det helt okej. Säg bara till, så hör jag inte av '
    + 'mig igen.',
];

export function leadReminderEmail(): { subject: string; html: string } {
  const html = PARAGRAPHS.map((p) => `<p>${p}</p>`).join('\n') + '\n' + SIGNATURE_HTML;

  return { subject: 'Är det fortfarande aktuellt?', html };
}
