/**
 * Mejlsignaturen, för mejl som skickas härifrån.
 *
 * Gmail lägger bara in sin automatiska signatur när ett mejl skrivs i
 * webbklientens compose-fönster. Allt vi skickar via Apps Script -
 * `GmailApp.sendEmail` för utskick, `createDraftReply` för AI-svaren - går
 * förbi den vägen och får ingen signatur alls. Därför bär vi den själva.
 *
 * Den här är en nerbantad variant av email-templates/signatur-erik-seth.html:
 * samma uppgifter, färger och typsnittsstack, men utan logotyp, utan
 * varumärkesbanner och utan "Läs mer"-knapp. Inga bilder och inga spårlänkar,
 * för det är sådant som drar upp spampoängen.
 *
 * Textversionen behöver inte skrivas här. `stripHtml` i apps-script/send-mail.gs
 * gör den ur den här HTML:en när mejlet skickas.
 *
 * OBS: AI-utkasten har en egen kopia av samma markup, i SIGNATURE_HTML i
 * apps-script/check-inbox.gs. Två kopior är oundvikligt - den koden kör i Apps
 * Script och kan inte importera härifrån - men ändrar du signaturen ska båda
 * ändras, annars ser våra utskick och våra svar olika ut.
 */
const FONT_STACK = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

export const SIGNATURE_HTML =
  `<div style="font-family:${FONT_STACK}; font-size:14px; color:#374151; margin-top:22px;">` +
    '<p style="margin:0 0 14px 0; font-style:italic; font-size:14px; color:#173b57;">Med vänliga hälsningar,</p>' +
    '<table cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td style="border-left:3px solid #E95C63; padding-left:18px;">' +
        '<p style="margin:0; font-size:16px; font-weight:600; color:#173b57; letter-spacing:-0.2px;">Erik Seth</p>' +
        '<p style="margin:1px 0 5px 0; font-size:13px; font-weight:400; color:#173b57;">Ekonomiavdelningen</p>' +
        '<p style="margin:0; font-size:13px; line-height:1.5; color:#173b57;">' +
          'Enkla Bokslut<br>' +
          '<a href="tel:+46725191616" style="color:#173b57; text-decoration:none;">072-519 16 16</a><br>' +
          '<a href="https://www.enklabokslut.se" style="color:#173b57; text-decoration:none;">www.enklabokslut.se</a>' +
        '</p>' +
      '</td>' +
    '</tr></table>' +
  '</div>';
