// ─── Konfiguration ────────────────────────────────────────────────────────────
// Logga in på script.google.com med ekonomi@enklabokslut.se
// Sätt dessa i: Projekt → Inställningar → Skriptegenskaper
// NEXT_URL  = https://app.enklabokslut.se
// INMAIL_SECRET = (samma hemliga nyckel som i .env)

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    nextUrl: props.getProperty('NEXT_URL'),
    secret: props.getProperty('INMAIL_SECRET'),
  };
}

// ─── Huvud-trigger: körs var 5:e minut ────────────────────────────────────────

function checkInbox() {
  const config = getConfig();
  const threads = GmailApp.search('is:unread has:attachment -from:me', 0, 20);

  for (const thread of threads) {
    const messages = thread.getMessages();
    const lastMsg = messages[messages.length - 1];

    if (!lastMsg.isUnread()) continue;

    const senderEmail = extractEmail(lastMsg.getFrom());
    const threadId = thread.getId();
    const messageId = lastMsg.getId();
    const attachments = getAttachments(lastMsg);

    if (!attachments.length) {
      lastMsg.markRead();
      continue;
    }

    // Är det ett svar på en tidigare tråd?
    const isReply = messages.length > 1;

    if (isReply) {
      handleReply(config, thread, lastMsg, senderEmail, threadId, messageId);
    } else {
      handleNewMail(config, lastMsg, senderEmail, threadId, messageId, attachments);
    }

    lastMsg.markRead();
  }
}

// ─── Nytt mail med bilaga ──────────────────────────────────────────────────────

function handleNewMail(config, thread, lastMsg, senderEmail, threadId, messageId, attachments) {
  const payload = {
    senderEmail: senderEmail,
    gmailThreadId: threadId,
    messageId: messageId,
    attachments: attachments,
  };

  const response = callApi(config, '/api/inmail', payload);

  if (!response) return;

  if (response.action === 'no_user') {
    // Ingen användare — skicka felmail
    GmailApp.sendEmail(
      senderEmail,
      'Vi kunde inte hitta ditt konto — Enkla Bokslut',
      'Hej!\n\nVi kunde inte hitta något konto kopplat till den här e-postadressen.\n\n' +
      'Kontrollera att du mailar från samma adress som du registrerade dig med på Enkla Bokslut, ' +
      'eller skapa ett konto på app.enklabokslut.se\n\n// Enkla Bokslut'
    );
    return;
  }

  if (response.action === 'ok' && response.replyBody) {
    // Svara i samma tråd
    thread.reply(response.replyBody);
  }
}

// ─── Svar i befintlig tråd ────────────────────────────────────────────────────

function handleReply(config, thread, lastMsg, senderEmail, threadId, messageId) {
  // Bygg mailhistorik som kontext till AI
  const messages = thread.getMessages();
  const history = messages.map(function(m) {
    return 'Från: ' + m.getFrom() + '\nDatum: ' + m.getDate() + '\n\n' + m.getPlainBody();
  }).join('\n\n---\n\n');

  const payload = {
    senderEmail: senderEmail,
    gmailThreadId: threadId,
    messageId: messageId,
    emailHistory: history,
  };

  const response = callApi(config, '/api/inmail/reply', payload);

  if (response && response.action === 'ok' && response.replyBody) {
    thread.reply(response.replyBody);
  }
}

// ─── Hjälpfunktioner ──────────────────────────────────────────────────────────

function callApi(config, path, payload) {
  try {
    const res = UrlFetchApp.fetch(config.nextUrl + path, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-inmail-secret': config.secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    if (code !== 200) {
      console.error('API-fel ' + code + ': ' + res.getContentText());
      return null;
    }

    return JSON.parse(res.getContentText());
  } catch (e) {
    console.error('Nätverksfel:', e.message);
    return null;
  }
}

function extractEmail(from) {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1].toLowerCase() : from.toLowerCase().trim();
}

function getAttachments(message) {
  const result = [];
  const attachments = message.getAttachments();
  for (const att of attachments) {
    const mimeType = att.getContentType();
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) continue;
    result.push({
      name: att.getName(),
      mimeType: mimeType,
      base64: Utilities.base64Encode(att.getBytes()),
    });
  }
  return result;
}
