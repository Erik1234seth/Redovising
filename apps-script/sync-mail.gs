// ─── Mejlarkivet: speglar konversationerna till adminpanelen ─────────────────
// Går igenom trådar i Gmail och skickar upp varje mejl, åt båda hållen, till
// /api/inmail/messages/import. Där hamnar de i mail_messages och syns under
// fliken Mejl på personsidan. Senare blir samma rader kontext när AI:n konterar.
//
// Ligger i samma Apps Script-projekt som check-inbox.gs och återanvänder
// getConfig(), callApi(), extractEmail() och isNoReplyAddress() därifrån.
// Äger varken doGet eller doPost.
//
// Två ingångar, av samma skäl som i export-sent.gs:
//
//   syncMailRecent()    Tidsstyrd trigger varje timme. Söker på DATUM och tar
//                       med två dygns marginal.
//   syncMailBackfill()  Körs för hand, om och om igen, tills den säger KLART.
//                       Söker på OFFSET och minns var den slutade i
//                       MAIL_SYNC_OFFSET.
//
// Att köra om är ofarligt: importen gör upsert på meddelandets id.

// Inte -in:drafts: den kan utesluta hela trådar där AI:n lagt ett svarsutkast.
// Utkasten sorteras bort per meddelande i collectMailMessages i stället.
var MAIL_SYNC_FILTER = '-in:spam -in:trash -category:promotions -category:social';
var MAIL_SYNC_RECENT_QUERY = 'newer_than:2d ' + MAIL_SYNC_FILTER;
var MAIL_SYNC_BACKFILL_QUERY = 'newer_than:2y ' + MAIL_SYNC_FILTER;
var MAIL_SYNC_THREADS_PER_RUN = 50;
var MAIL_SYNC_MAX_THREADS_RECENT = 200;
var MAIL_SYNC_BATCH_SIZE = 20;
// Kroppen kapas redan här så att en portion aldrig blir för stor att posta.
// Servern kapar också, men då har anropet redan gått.
var MAIL_SYNC_MAX_BODY = 50000;
var MAIL_SYNC_FALLBACK_OWNER = 'erik@enklabokslut.se';

// Adresserna som räknas som "vi": skriptets ägare och dess alias. Allt från
// dem är utgående, och mottagaren är kunden. Session.getActiveUser() är tom
// under en trigger, därför getEffectiveUser().
function getMailSyncOwners() {
  var owners = [MAIL_SYNC_FALLBACK_OWNER];
  try {
    var effective = Session.getEffectiveUser().getEmail();
    if (effective) owners.push(effective.toLowerCase());
  } catch (err) {
    console.warn('getMailSyncOwners: getEffectiveUser gav fel: ' + err.message);
  }
  try {
    var aliases = GmailApp.getAliases();
    for (var i = 0; i < aliases.length; i++) owners.push(aliases[i].toLowerCase());
  } catch (err) {
    console.warn('getMailSyncOwners: getAliases gav fel: ' + err.message);
  }
  return owners;
}

// ─── Tidsstyrt jobb ───────────────────────────────────────────────────────────

function syncMailRecent() {
  var config = getConfig();
  var owners = getMailSyncOwners();
  var offset = 0;
  var totals = { imported: 0, skipped: 0, failed: 0 };

  while (offset < MAIL_SYNC_MAX_THREADS_RECENT) {
    var threads = GmailApp.search(MAIL_SYNC_RECENT_QUERY, offset, MAIL_SYNC_THREADS_PER_RUN);
    if (threads.length === 0) break;

    addMailSyncTotals(totals, flushMailMessages(config, collectMailMessages(threads, owners)));
    offset += threads.length;

    if (threads.length < MAIL_SYNC_THREADS_PER_RUN) break;
  }

  console.log(
    'syncMailRecent: ' + offset + ' trådar. Sparade ' + totals.imported +
    ', hoppade över ' + totals.skipped + ', misslyckades ' + totals.failed + '.'
  );
}

// ─── Engångsimport av historiken (körs för hand) ──────────────────────────────
// 50 trådar per körning, eftersom Apps Script bryter efter 6 minuter. Kör den
// om och om igen tills den säger KLART. resetMailSync() börjar om.

function syncMailBackfill() {
  var config = getConfig();
  var owners = getMailSyncOwners();
  var props = PropertiesService.getScriptProperties();
  var offset = Number(props.getProperty('MAIL_SYNC_OFFSET') || 0);

  var threads = GmailApp.search(MAIL_SYNC_BACKFILL_QUERY, offset, MAIL_SYNC_THREADS_PER_RUN);
  if (threads.length === 0) {
    console.log('KLART. Inga fler trådar. Totalt genomgånget: ' + offset);
    return;
  }

  var res = flushMailMessages(config, collectMailMessages(threads, owners));

  // Gick en portion inte fram står offseten kvar, så nästa körning tar om den
  if (res.failed > 0) {
    console.log('Uppladdningen misslyckades för ' + res.failed + ' mejl. Kör syncMailBackfill() igen.');
    return;
  }

  var next = offset + threads.length;
  props.setProperty('MAIL_SYNC_OFFSET', String(next));
  console.log(
    'syncMailBackfill: trådar ' + offset + '-' + next + '. Sparade ' + res.imported +
    ', hoppade över ' + res.skipped + '. Kör syncMailBackfill() igen för nästa portion.'
  );
}

function resetMailSync() {
  PropertiesService.getScriptProperties().deleteProperty('MAIL_SYNC_OFFSET');
  console.log('Nollställt. Nästa syncMailBackfill() börjar om från första tråden.');
}

// ─── Trigger-uppsättning ──────────────────────────────────────────────────────
// Kör EN gång från redigeraren. Tar bort en eventuell tidigare trigger först.

function setUpMailSync() {
  var removed = removeMailSyncTriggers();
  ScriptApp.newTrigger('syncMailRecent').timeBased().everyHours(1).create();
  console.log('Mejlsynk uppsatt, körs varje timme.' + (removed ? ' Tog bort ' + removed + ' tidigare trigger(s).' : ''));
}

function removeMailSync() {
  console.log('Tog bort ' + removeMailSyncTriggers() + ' trigger(s) för syncMailRecent.');
}

function removeMailSyncTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncMailRecent') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  return removed;
}

// ─── Hjälpfunktioner ──────────────────────────────────────────────────────────

// Gör om trådarnas mejl till rader. Kunden är avsändaren på inkommande mejl
// och första mottagaren som inte är vi på utgående. Mejl mellan våra egna
// adresser och från no-reply-avsändare tas inte med.
function collectMailMessages(threads, owners) {
  var out = [];

  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();

    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (m.isDraft()) continue;

      var from = extractEmail(m.getFrom());
      var to = splitMailAddresses(m.getTo()).concat(splitMailAddresses(m.getCc()));
      var outgoing = owners.indexOf(from) !== -1;

      var customer = outgoing
        ? to.filter(function (a) { return owners.indexOf(a) === -1 && !isNoReplyAddress(a); })[0]
        : from;
      if (!customer || isNoReplyAddress(customer)) continue;

      var names = [];
      try {
        var atts = m.getAttachments({ includeInlineImages: false });
        for (var a = 0; a < atts.length; a++) names.push(atts[a].getName());
      } catch (err) {
        console.warn('Kunde inte läsa bilagorna i ' + m.getId() + ': ' + err.message);
      }

      out.push({
        messageId: m.getId(),
        gmailThreadId: threads[t].getId(),
        direction: outgoing ? 'out' : 'in',
        from: from,
        to: to,
        customerEmail: customer,
        subject: m.getSubject() || '',
        body: (m.getPlainBody() || '').substring(0, MAIL_SYNC_MAX_BODY),
        attachmentNames: names,
        sentAt: m.getDate().toISOString(),
      });
    }
  }

  return out;
}

// "Anna <a@b.se>, c@d.se" → ['a@b.se', 'c@d.se']
function splitMailAddresses(header) {
  if (!header) return [];
  var found = String(header).match(/[^\s<>,;"']+@[^\s<>,;"']+/g) || [];
  return found.map(function (a) { return a.toLowerCase(); });
}

function flushMailMessages(config, messages) {
  var res = { imported: 0, skipped: 0, failed: 0 };

  for (var i = 0; i < messages.length; i += MAIL_SYNC_BATCH_SIZE) {
    var batch = messages.slice(i, i + MAIL_SYNC_BATCH_SIZE);
    var answer = callApi(config, '/api/inmail/messages/import', { messages: batch });
    if (!answer) {
      res.failed += batch.length;
      continue;
    }
    res.imported += answer.imported || 0;
    res.skipped += answer.skipped || 0;
  }

  return res;
}

function addMailSyncTotals(totals, res) {
  totals.imported += res.imported;
  totals.skipped += res.skipped;
  totals.failed += res.failed;
}
