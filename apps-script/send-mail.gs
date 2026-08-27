/**
 * Skickar mejl från Eriks Gmail på begäran av enklabokslut.se.
 *
 * Klistras in i SAMMA Apps Script-projekt som redan driver mail-AI:n, så att
 * utskick och inkommande svar hamnar i samma konto. Lägg till som en egen fil
 * — rör inte den befintliga koden.
 *
 * Publicera sedan: Distribuera → Ny distribution → Webbapp
 *   Kör som:            Jag (erik@enklabokslut.se)
 *   Vem har åtkomst:    Alla
 * Kopiera webbapp-URL:en till GMAIL_SCRIPT_URL i Vercel.
 *
 * "Alla" låter otäckt men är enda sättet att nå den utan Google-inloggning.
 * Skyddet är hemligheten i anropets kropp — utan rätt SECRET händer ingenting.
 */

// Måste vara exakt samma sträng som GMAIL_SCRIPT_SECRET i .env.local och i
// Vercel. Byt ut den HÄR I APPS SCRIPT-REDIGERAREN, inte i den här filen —
// filen ligger i git och hemligheten ska inte med dit.
const SECRET = 'SATT_I_APPS_SCRIPT_REDIGERAREN';

const SENDER_NAME = 'Erik på Enkla Bokslut';
const REPLY_TO = 'erik@enklabokslut.se';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'Tom förfrågan' });
    }

    const payload = JSON.parse(e.postData.contents);

    if (payload.secret !== SECRET) {
      return json({ ok: false, error: 'Fel hemlighet' });
    }

    if (!payload.to || !payload.subject || !payload.html) {
      return json({ ok: false, error: 'to, subject och html krävs' });
    }

    GmailApp.sendEmail(payload.to, payload.subject, stripHtml(payload.html), {
      htmlBody: payload.html,
      name: SENDER_NAME,
      replyTo: REPLY_TO,
    });

    // Trådens id gör att svaret går att koppla ihop med utskicket. Gmail ger
    // oss inget id direkt från sendEmail, så vi letar upp den nyss skickade.
    var threadId = '';
    try {
      const sent = GmailApp.search('to:' + payload.to + ' in:sent', 0, 1);
      if (sent.length > 0) threadId = sent[0].getId();
    } catch (searchError) {
      // Utskicket gick ändå — id:t är en bonus, inte ett krav
    }

    return json({ ok: true, threadId: threadId });
  } catch (error) {
    return json({ ok: false, error: String(error) });
  }
}

/** Textversion för mejlklienter som inte visar HTML. */
function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|tr|li|h1|h2|h3)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&middot;/g, '·')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Kör den här en gång från redigeraren för att godkänna behörigheterna, innan
 * du publicerar. Den mejlar dig själv.
 */
function testaUtskick() {
  GmailApp.sendEmail(REPLY_TO, 'Test från Apps Script', 'Fungerar.', {
    htmlBody: '<p>Fungerar.</p>',
    name: SENDER_NAME,
    replyTo: REPLY_TO,
  });
}
