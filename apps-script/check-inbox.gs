// ─── Konfiguration ────────────────────────────────────────────────────────────
// Logga in på script.google.com med erik@enklabokslut.se
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

    // Systemutskick och studsar hoppas över helt, innan bilagorna läses in.
    // Markeras som lästa så att de inte ligger kvar och äter av de 20 trådar
    // sökningen hämtar.
    if (isNoReplyAddress(senderEmail)) {
      console.log('Hoppar över no-reply-avsändare: ' + senderEmail);
      lastMsg.markRead();
      continue;
    }

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

// ─── Signatur ─────────────────────────────────────────────────────────────────
// Gmails automatiska signatur klistras bara in av webbklientens compose-vy, när
// du själv klickar Svara. Ett utkast som skapas här via createDraftReply går
// aldrig den vägen, så det får ingen signatur alls. Därför hängs den på här.
//
// Utkastet får både en text- och en HTML-version, så att mejlet ser rätt ut i
// alla klienter. Modellen skriver fortfarande ren text; den escapas och
// radbrytningarna blir <br>, annars äter HTML:en formateringen.
//
// HTML:en är en nerbantad variant av email-templates/signatur-erik-seth.html:
// samma uppgifter och samma färger, men utan logotyp, utan varumärkesbanner och
// utan "Läs mer"-knapp. Inga bilder och inga spårlänkar, för det är sådant som
// drar upp spampoängen. De två länkarna går till egna numret och egna domänen.
//
// Skriv signaturen ingen annanstans. Prompterna (src/lib/inmail/reply-rules.ts)
// förbjuder modellen att skriva egen signatur, och replyBody-strängarna i
// src/lib/inmail/handlers/ ska inte heller ha någon. Annars står den två gånger.
const FONT_STACK = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

const SIGNATURE_TEXT =
  '\n\nMed vänliga hälsningar,\n' +
  'Erik Seth\n' +
  'Ekonomiavdelningen\n' +
  'Enkla Bokslut\n' +
  '072-519 16 16\n' +
  'www.enklabokslut.se';

const SIGNATURE_HTML =
  '<div style="font-family:' + FONT_STACK + '; font-size:14px; color:#374151; margin-top:22px;">' +
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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Textversionen av utkastet: modellens svar plus signaturen som ren text. */
function withSignature(replyBody) {
  return String(replyBody).replace(/\s+$/, '') + SIGNATURE_TEXT;
}

/** HTML-versionen av samma utkast. */
function withSignatureHtml(replyBody) {
  const body = escapeHtml(String(replyBody).replace(/\s+$/, '')).replace(/\n/g, '<br>');
  return '<div style="font-family:' + FONT_STACK + '; font-size:14px; line-height:1.6; color:#374151;">' +
    body + '</div>' + SIGNATURE_HTML;
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
    lastMsg.createDraftReply(withSignature(response.replyBody), { htmlBody: withSignatureHtml(response.replyBody) });
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
    lastMsg.createDraftReply(withSignature(response.replyBody), { htmlBody: withSignatureHtml(response.replyBody) });
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

// ─── Avsändare vi aldrig svarar ───────────────────────────────────────────────
// Våra egna systemutskick (välkomstmejl, bokningsbekräftelser, fakturor) går
// från noreply@enklabokslut.se via Resend och landar i samma inkorg. Utan det
// här filtret la AI:n ett svarsutkast till en adress som ingen läser. Samma sak
// gäller studsar och andra maskinavsändare.
//
// Listan finns också på serversidan i src/lib/inmail/no-reply.ts, som en spärr
// om skriptet inte distribuerats om. Ändrar du här, ändra där också.
const NO_REPLY_LOCAL_PARTS = [
  'noreply', 'no-reply', 'no_reply',
  'donotreply', 'do-not-reply', 'do_not_reply',
  'mailer-daemon', 'mailerdaemon', 'postmaster',
  'bounce', 'bounces',
  'notification', 'notifications',
];

function isNoReplyAddress(email) {
  const at = String(email).lastIndexOf('@');
  if (at < 1) return false;
  const localPart = String(email).slice(0, at).toLowerCase().trim().split('+')[0];
  return NO_REPLY_LOCAL_PARTS.indexOf(localPart) !== -1;
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
