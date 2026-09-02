/**
 * Avsändare som aldrig ska få ett AI-utkast.
 *
 * Våra egna systemutskick (välkomstmejl, bokningsbekräftelser, fakturor) går
 * från noreply@enklabokslut.se via Resend, och kopiorna landar i samma inkorg
 * som Apps Script bevakar. Utan det här filtret klassade AI:n dem som vanliga
 * mejl och la ett svarsutkast till en adress som ingen läser.
 *
 * Samma sak gäller studsar och andra maskinavsändare: mailer-daemon, postmaster
 * och bounce-adresser. Ett svar dit är i bästa fall bortkastat, i värsta fall en
 * mejlslinga.
 *
 * Matchningen görs på lokaldelen (före @), så den fungerar oavsett domän. En
 * plus-tagg (noreply+kvitto@) räknas till lokaldelen och skalas av först.
 */
const NO_REPLY_LOCAL_PARTS = [
  'noreply',
  'no-reply',
  'no_reply',
  'donotreply',
  'do-not-reply',
  'do_not_reply',
  'mailer-daemon',
  'mailerdaemon',
  'postmaster',
  'bounce',
  'bounces',
  'notification',
  'notifications',
];

export function isNoReplyAddress(email: string | null | undefined): boolean {
  if (!email) return false;

  const at = email.lastIndexOf('@');
  if (at < 1) return false;

  const localPart = email.slice(0, at).toLowerCase().trim().split('+')[0];
  return NO_REPLY_LOCAL_PARTS.includes(localPart);
}
