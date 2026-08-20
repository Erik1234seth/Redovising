// ─── Konfiguration ────────────────────────────────────────────────────────────
// Läggs till som en EGEN FIL i samma Apps Script-projekt som checkInbox.
// Rör inte den befintliga koden — projektet får ha en doGet och en doPost, och
// den gamla filen äger doGet medan den här äger doPost.
//
// Sätt i: Project Settings → Script Properties:
// GMAIL_SCRIPT_SECRET = (samma hemliga nyckel som i .env och Vercel)
//
// Publicera sedan om projektet så att doPost kommer med:
// Distribuera → Hantera distributioner → pennan → Version: Ny version → Distribuera
// Samma URL som förut fortsätter gälla, nu med både doGet och doPost.
// Den URL:en läggs i GMAIL_SCRIPT_URL i .env.local och i Vercel.

const SENDER_NAME = 'Erik på Enkla Bokslut';
const REPLY_TO = 'erik@enklabokslut.se';

function getSendConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    secret: props.getProperty('GMAIL_SCRIPT_SECRET'),
  };
}

// ─── Utskick på begäran från enklabokslut.se ──────────────────────────────────
// Webbappen måste publiceras med "Alla" som åtkomst, annars svarar Google med
// en inloggningssida istället. Skyddet är hemligheten i anropets kropp —
// headers går inte att kräva på en publicerad Apps Script-webbapp.

function doPost(e) {
  try {
    const config = getSendConfig();

    if (!config.secret) {
      return json({ ok: false, error: 'GMAIL_SCRIPT_SECRET saknas i Script Properties' });
    }

    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'Tom förfrågan' });
    }

    const payload = JSON.parse(e.postData.contents);

    if (payload.secret !== config.secret) {
      console.error('doPost: fel hemlighet');
      return json({ ok: false, error: 'Unauthorized' });
    }

    if (!payload.to || !payload.subject || !payload.html) {
      return json({ ok: false, error: 'to, subject och html krävs' });
    }

    GmailApp.sendEmail(payload.to, payload.subject, stripHtml(payload.html), {
      htmlBody: payload.html,
      name: SENDER_NAME,
      replyTo: REPLY_TO,
    });

    console.log('doPost: mejl skickat till ' + payload.to);

    return json({ ok: true, threadId: findSentThreadId(payload.to) });
  } catch (err) {
    console.error('doPost error:', err.message);
    return json({ ok: false, error: String(err) });
  }
}

// ─── Hjälpfunktioner ──────────────────────────────────────────────────────────

// GmailApp.sendEmail returnerar ingenting, så tråden får letas upp i efterhand.
// Best effort: id:t används bara för att kunna koppla ihop svaret med utskicket
// i adminpanelen, och utskicket har redan gått när vi kommer hit.
function findSentThreadId(to) {
  try {
    const sent = GmailApp.search('in:sent to:' + to, 0, 1);
    return sent.length > 0 ? sent[0].getId() : '';
  } catch (err) {
    console.error('findSentThreadId error:', err.message);
    return '';
  }
}

// Textversion för mejlklienter som inte visar HTML.
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
    .replace(/&#10003;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Kör en gång från redigeraren för att godkänna Gmail-behörigheten innan du
// publicerar. Mejlar dig själv.
function testaUtskick() {
  GmailApp.sendEmail(REPLY_TO, 'Test från Apps Script', 'Fungerar.', {
    htmlBody: '<p>Fungerar.</p>',
    name: SENDER_NAME,
    replyTo: REPLY_TO,
  });
  console.log('testaUtskick: skickat till ' + REPLY_TO);
}
