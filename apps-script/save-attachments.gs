// ─── Bilagor sparas som underlag, före allt annat ─────────────────────────────
// Varje fil i ett inkommande mejl sparas i bucketen bokforing-underlag och
// kopplas till avsändarens adress. Alla filtyper, ingen tolkning — det görs i
// ett separat steg senare.
//
// Filerna laddas upp direkt till lagringen med en engångslänk från servern, så
// de passerar aldrig Vercel (max 4,5 MB per anrop):
//   1. POST /api/inmail/underlag  { action: 'prepare', ... }  → signedUrl
//   2. PUT  signedUrl  (filens bytes)
//   3. POST /api/inmail/underlag  { action: 'confirm', ... }
//
// Går något snett lämnar checkInbox mejlet oläst och tar om det vid nästa
// körning. Servern stoppar dubbletter, så en omkörning sparar bara det som
// saknas. Efter UNDERLAG_MAX_ATTEMPTS försök ges det upp, så att ett trasigt
// mejl inte blockerar inkorgen för evigt.
//
// Ligger i samma projekt som check-inbox.gs och återanvänder getConfig(),
// callApi() och extractEmail() därifrån. Äger varken doGet eller doPost.

var UNDERLAG_MAX_ATTEMPTS = 5;

/**
 * Bilagorna i ett meddelande. Inbäddade bilder (logotyper i signaturer) räknas
 * inte — de är inga filer någon skickat oss.
 */
function getMailFiles(message) {
  return message.getAttachments({ includeInlineImages: false });
}

/** Det mail-AI:n får veta om bilagorna: namn och typ, inte innehållet. */
function getAttachmentInfo(message) {
  return getMailFiles(message).map(function (att, i) {
    return {
      name: att.getName() || ('bilaga-' + (i + 1)),
      mimeType: att.getContentType() || 'application/octet-stream',
      size: att.getSize(),
    };
  });
}

/**
 * Sparar bilagorna i alla olästa meddelanden i tråden som inte är från oss.
 * Returnerar true när allt är sparat (eller försöken är slut), false när
 * mejlet ska lämnas oläst och tas om.
 */
function saveThreadAttachments(config, messages) {
  var owner = Session.getEffectiveUser().getEmail().toLowerCase();
  var ok = true;

  for (var m = 0; m < messages.length; m++) {
    var message = messages[m];
    if (!message.isUnread()) continue;
    var sender = extractEmail(message.getFrom());
    if (sender === owner) continue;
    if (!saveMessageAttachments(config, message, sender)) ok = false;
  }

  return ok;
}

function saveMessageAttachments(config, message, senderEmail) {
  var files = getMailFiles(message);
  if (!files.length) return true;

  var messageId = message.getId();
  var failed = 0;

  for (var i = 0; i < files.length; i++) {
    var att = files[i];
    var info = {
      senderEmail: senderEmail,
      messageId: messageId,
      fileName: att.getName() || ('bilaga-' + (i + 1)),
      mimeType: att.getContentType() || 'application/octet-stream',
      size: att.getSize(),
    };

    var prepared = callApi(config, '/api/inmail/underlag', Object.assign({ action: 'prepare' }, info));
    if (!prepared) { failed++; continue; }
    if (prepared.status === 'exists') continue;

    var put = UrlFetchApp.fetch(prepared.signedUrl, {
      method: 'put',
      contentType: info.mimeType,
      payload: att.getBytes(),
      muteHttpExceptions: true,
    });
    if (put.getResponseCode() >= 300) {
      console.error('Uppladdning av ' + info.fileName + ' misslyckades: ' + put.getResponseCode() + ' ' + put.getContentText().substring(0, 200));
      failed++;
      continue;
    }

    var confirmed = callApi(config, '/api/inmail/underlag', Object.assign({ action: 'confirm', path: prepared.path }, info));
    if (!confirmed) failed++;
  }

  if (!failed) return true;

  var cache = CacheService.getScriptCache();
  var key = 'underlag-attempts:' + messageId;
  var attempts = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(attempts), 6 * 60 * 60);

  if (attempts >= UNDERLAG_MAX_ATTEMPTS) {
    console.error('Ger upp efter ' + attempts + ' försök: ' + failed + ' bilagor från ' + senderEmail + ' kunde inte sparas (meddelande ' + messageId + ')');
    return true;
  }

  console.warn(failed + ' bilagor från ' + senderEmail + ' kunde inte sparas — försök ' + attempts + ' av ' + UNDERLAG_MAX_ATTEMPTS);
  return false;
}
