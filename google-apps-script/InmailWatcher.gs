// ─── Konfiguration ────────────────────────────────────────────────────────────
// Logga in på script.google.com med ekonomi@enklabokslut.se
// Sätt dessa i: Project Settings → Script Properties:
// NEXT_URL      = https://app.enklabokslut.se
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
  // Obs: 'has:attachment' borttaget — vi hanterar nu även vanliga textmejl
  const threads = GmailApp.search('is:unread -from:me', 0, 20);

  for (const thread of threads) {
    const messages = thread.getMessages();
    const lastMsg = messages[messages.length - 1];

    if (!lastMsg.isUnread()) continue;

    const senderEmail = extractEmail(lastMsg.getFrom());
    const threadId = thread.getId();
    const messageId = lastMsg.getId();
    const subject = lastMsg.getSubject() || '';
    const emailBody = lastMsg.getPlainBody() || '';
    const attachments = getAttachments(lastMsg);
    const isReply = messages.length > 1;

    if (isReply) {
      handleReply(config, thread, senderEmail, threadId, messageId, subject, emailBody, attachments);
    } else {
      handleNewMail(config, thread, senderEmail, threadId, messageId, subject, emailBody, attachments);
    }

    lastMsg.markRead();
  }
}

// ─── Nytt mail ────────────────────────────────────────────────────────────────

function handleNewMail(config, thread, senderEmail, threadId, messageId, subject, emailBody, attachments) {
  const payload = {
    senderEmail: senderEmail,
    gmailThreadId: threadId,
    messageId: messageId,
    subject: subject,
    emailBody: emailBody,
    attachments: attachments,
  };

  const response = callApi(config, '/api/inmail', payload);
  console.log('handleNewMail response:', JSON.stringify(response));

  if (!response) return;

  // Spara AI-svaret som utkast i rätt tråd
  if (response.replyBody) {
    const lastMsg = thread.getMessages()[thread.getMessages().length - 1];
    lastMsg.createDraftReply(response.replyBody);
  }
}

// ─── Svar i befintlig tråd ────────────────────────────────────────────────────

function handleReply(config, thread, senderEmail, threadId, messageId, subject, emailBody, attachments) {
  const messages = thread.getMessages();
  const history = messages.map(function(m) {
    return 'From: ' + m.getFrom() + '\nDate: ' + m.getDate() + '\n\n' + m.getPlainBody();
  }).join('\n\n---\n\n');

  const payload = {
    senderEmail: senderEmail,
    gmailThreadId: threadId,
    messageId: messageId,
    subject: subject,
    emailBody: emailBody,
    emailHistory: history,
    attachments: attachments,
  };

  const response = callApi(config, '/api/inmail/reply', payload);
  console.log('handleReply response:', JSON.stringify(response));

  if (response && response.replyBody) {
    const lastMsg = thread.getMessages()[thread.getMessages().length - 1];
    lastMsg.createDraftReply(response.replyBody);
  }
}

// ─── Web App trigger (för testning via terminal) ──────────────────────────────

function doGet(e) {
  const secret = e.parameter.secret;
  if (secret !== PropertiesService.getScriptProperties().getProperty('INMAIL_SECRET')) {
    return ContentService.createTextOutput('Unauthorized');
  }
  checkInbox();
  return ContentService.createTextOutput('OK');
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
    console.log('callApi ' + path + ' → ' + code + ': ' + text.substring(0, 200));

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
