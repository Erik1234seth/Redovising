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
 * Skyddet är hemligheten i anropets kropp — utan rätt hemlighet händer ingenting.
 *
 * ─── Varför `ref` och `lookup` ────────────────────────────────────────────────
 * Google svarar inte direkt på en POST. Scriptet kör klart, och sedan skickas
 * anroparen vidare till en engångsadress på script.googleusercontent.com där
 * svaret ligger. Den adressen går att läsa EN gång, och ibland svarar den 404.
 * Då har mejlet redan gått iväg, men servern vet inte om det — och loggade det
 * som misslyckat.
 *
 * Därför skickar servern med ett eget id (`ref`) och scriptet sparar utfallet
 * under det i CacheService. Tappas svaret frågar servern `action: 'lookup'`
 * och får samma svar en gång till. Ingenting skickas om, så det kan aldrig bli
 * dubbletter.
 */

const SENDER_NAME = 'Erik på Enkla Bokslut';
const REPLY_TO = 'erik@enklabokslut.se';

/** Hur länge utfallet sparas. CacheService tillåter max 6 timmar. */
const RESULT_TTL_SECONDS = 6 * 60 * 60;

/** Hur länge en lookup väntar på ett utskick som fortfarande pågår. */
const LOOKUP_WAIT_MS = 15000;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'Tom förfrågan' });
    }

    const secret = PropertiesService.getScriptProperties().getProperty('GMAIL_SCRIPT_SECRET');
    if (!secret) {
      return json({ ok: false, error: 'GMAIL_SCRIPT_SECRET saknas i Script Properties' });
    }

    const payload = JSON.parse(e.postData.contents);

    if (payload.secret !== secret) {
      return json({ ok: false, error: 'Fel hemlighet' });
    }

    if (payload.action === 'lookup') {
      return json(lookupSendResult(payload.ref));
    }

    // Systemstatus postar med bara hemligheten och förväntar sig exakt det här
    // felet som bevis på att webbappen svarar. Ändra inte texten.
    if (!payload.to || !payload.subject || !payload.html) {
      return json({ ok: false, error: 'to, subject och html krävs' });
    }

    const result = sendMailForRequest(payload);
    rememberSendResult(payload.ref, result);
    return json(result);
  } catch (error) {
    return json({ ok: false, error: String(error) });
  }
}

// Namnen är långa med flit: alla filer i projektet delar globalt scope, och
// en annan fil med en funktion som heter send eller lookup hade skrivit över.
function sendMailForRequest(payload) {
  try {
    GmailApp.sendEmail(payload.to, payload.subject, stripHtml(payload.html), {
      htmlBody: payload.html,
      name: SENDER_NAME,
      replyTo: REPLY_TO,
    });
  } catch (error) {
    return { ok: false, error: String(error) };
  }

  // Trådens id gör att svaret går att koppla ihop med utskicket. Gmail ger
  // oss inget id direkt från sendEmail, så vi letar upp den nyss skickade.
  var threadId = '';
  try {
    const sent = GmailApp.search('to:' + payload.to + ' in:sent', 0, 1);
    if (sent.length > 0) threadId = sent[0].getId();
  } catch (searchError) {
    // Utskicket gick ändå — id:t är en bonus, inte ett krav
  }

  return { ok: true, threadId: threadId };
}

function rememberSendResult(ref, result) {
  if (!ref) return;
  try {
    CacheService.getScriptCache().put('send:' + ref, JSON.stringify(result), RESULT_TTL_SECONDS);
  } catch (cacheError) {
    // Utan cache fungerar utskicket som förr, bara utan möjlighet att fråga igen
  }
}

/**
 * Svarar med utfallet för ett tidigare utskick. Väntar en stund om det inte
 * finns än — servern kan ha gett upp medan utskicket fortfarande pågick.
 * `supported: true` talar om för servern att den här versionen kan svara alls.
 */
function lookupSendResult(ref) {
  if (!ref) return { ok: false, supported: true, found: false, error: 'ref krävs' };

  const cache = CacheService.getScriptCache();
  const deadline = Date.now() + LOOKUP_WAIT_MS;

  while (true) {
    const stored = cache.get('send:' + ref);
    if (stored) {
      const result = JSON.parse(stored);
      return { ok: true, supported: true, found: true, result: result };
    }
    if (Date.now() > deadline) break;
    Utilities.sleep(1000);
  }

  return { ok: true, supported: true, found: false };
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
