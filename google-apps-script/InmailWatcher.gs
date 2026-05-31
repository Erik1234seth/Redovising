// ─── Konfiguration ────────────────────────────────────────────────────────────
// Logga in på script.google.com med ekonomi@enklabokslut.se
// Sätt dessa i: Project Settings → Script Properties:
// NEXT_URL  = https://app.enklabokslut.se
// INMAIL_SECRET = (samma hemliga nyckel som i .env)

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    nextUrl: props.getProperty('NEXT_URL'),
    secret: props.getProperty('INMAIL_SECRET'),
  };
}

// ─── Huvud-trigger ────────────────────────────────────────────────────────────

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

    const isReply = messages.length > 1;

    if (isReply) {
      handleReply(config, thread, senderEmail, threadId, messageId);
    } else {
      handleNewMail(config, thread, senderEmail, threadId, messageId, attachments);
    }

    lastMsg.markRead();
  }
}

// ─── Nytt mail med bilaga ──────────────────────────────────────────────────────

function handleNewMail(config, thread, senderEmail, threadId, messageId, attachments) {
  // Skicka omedelbar bekräftelse
  thread.reply(
    'Hej!\n\n' +
    'Vi har tagit emot ditt mail och återkommer så snabbt vi kan.\n\n' +
    'Mvh,\nEnkla Bokslut'
  );

  const payload = {
    senderEmail: senderEmail,
    gmailThreadId: threadId,
    messageId: messageId,
    attachments: attachments,
  };

  const response = callApi(config, '/api/inmail', payload);
  console.log('handleNewMail response:', JSON.stringify(response));

  if (!response) return;

  if (response.action === 'no_user') {
    thread.reply(
      'Hej!\n\nVi kunde inte hitta något konto kopplat till den här e-postadressen.\n\n' +
      'Kontrollera att du mailar från samma adress som du registrerade dig med på Enkla Bokslut, ' +
      'eller skapa ett konto på app.enklabokslut.se\n\n// Enkla Bokslut'
    );
    return;
  }

  if (response.action === 'ok' && response.replyBody) {
    thread.reply(response.replyBody);
  }
}

// ─── Svar i befintlig tråd ────────────────────────────────────────────────────

function handleReply(config, thread, senderEmail, threadId, messageId) {
  const messages = thread.getMessages();
  const history = messages.map(function(m) {
    return 'From: ' + m.getFrom() + '\nDate: ' + m.getDate() + '\n\n' + m.getPlainBody();
  }).join('\n\n---\n\n');

  const payload = {
    senderEmail: senderEmail,
    gmailThreadId: threadId,
    messageId: messageId,
    emailHistory: history,
  };

  const response = callApi(config, '/api/inmail/reply', payload);
  console.log('handleReply response:', JSON.stringify(response));

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
    const text = res.getContentText();
    console.log('callApi ' + path + ' → ' + code + ': ' + text);

    if (code !== 200) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error('callApi error:', e.message);
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
