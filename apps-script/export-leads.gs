// ─── Lead-historiken: hämtar välkomstmejlen Zapier skickade ───────────────────
// Under en period skickade Zapier välkomstmejlet till varje nytt lead direkt
// från den här Gmailen, helt utanför vår kod. De leadsen finns i
// contact_requests men har ingenting i email_log, så påminnelsejobbet tror att
// vi aldrig hört av oss — och de som svarade Erik i Gmail syns inte som
// svarande någonstans. Utan den här importen hade de kunnat få en påminnelse om
// ett samtal de redan haft.
//
// Skriptet går igenom Skickat, plockar ut vem mejlet gick till och om det kom
// något svar i tråden, och skickar upp det till /api/inmail/leads/import. Där
// skrivs det om till vanliga email_log- och email_threads-rader, alltså exakt
// samma form som om vår egen kod hade skickat mejlen. Ingenting i
// påminnelsejobbet behöver ändras.
//
// Ligger i samma projekt som check-inbox.gs, send-mail.gs och export-sent.gs,
// och återanvänder getConfig(), callApi() och extractEmail() därifrån. Filen
// äger varken doGet eller doPost, så den krockar inte med de andra.
//
// ─── Så här kör du ────────────────────────────────────────────────────────────
//
//   1. listLeadSubjects()     Skriver ut vilka ämnesrader som finns i Skickat
//                             under perioden, med antal och datum. Skickar
//                             ingenting någonstans — bara en titt i loggen.
//                             Leta upp raden Zapier använde.
//
//   2. Sätt LEAD_SUBJECT nedan till den ämnesraden.
//
//   3. exportLeadsDryRun()    Samma genomgång som importen, men servern sparar
//                             ingenting. Loggen säger hur många som skulle
//                             läsas in och hur många som svarat.
//
//   4. exportLeadsBackfill()  Skarpt. Tar 50 trådar per körning och kommer ihåg
//                             var den slutade, så kör den om och om igen tills
//                             den säger KLART. Apps Script bryter en körning
//                             efter 6 minuter, därav portionerna.
//
// Vill du börja om: resetLeadExport(). Att köra om är ofarligt — importen
// stoppar dubbletter på Gmails message_id.

// Ämnesraden på mejlet Zapier skickade. Fylls i efter steg 1 ovan.
// Tomt värde = skriptet vägrar köra, hellre det än att importera fel mejl.
var LEAD_SUBJECT = '';

// Perioden att leta i. Zapier-mejlen slutade när vår egen kod tog över
// utskicken; marginalen bakåt kostar ingenting eftersom ämnesraden ändå styr.
var LEAD_SEARCH_AFTER = '2026/01/01';
var LEAD_SEARCH_BEFORE = '2026/09/01';

var LEAD_THREADS_PER_RUN = 50;
var LEAD_BATCH_SIZE = 50;

/** Ägarens adress, alltså "vi". Samma resonemang som i export-sent.gs. */
function getLeadOwnerEmail() {
  try {
    var effective = Session.getEffectiveUser().getEmail();
    if (effective) return effective.toLowerCase();
  } catch (err) {
    console.warn('getLeadOwnerEmail: getEffectiveUser gav fel: ' + err.message);
  }
  return 'erik@enklabokslut.se';
}

function leadQuery() {
  if (!LEAD_SUBJECT) {
    throw new Error('LEAD_SUBJECT är tom. Kör listLeadSubjects() först och fyll i ämnesraden.');
  }
  return 'in:sent subject:"' + LEAD_SUBJECT + '"'
    + ' after:' + LEAD_SEARCH_AFTER
    + ' before:' + LEAD_SEARCH_BEFORE;
}

// ─── Steg 1: vilka ämnesrader finns? ──────────────────────────────────────────
// Skickar ingenting. Går igenom Skickat under perioden och räknar ämnesrader,
// så att du kan se vilken Zapier använde utan att gissa. Mejl till samma person
// räknas en gång per tråd.

function listLeadSubjects() {
  var counts = {};
  var firstSeen = {};
  var lastSeen = {};
  var offset = 0;
  var scanned = 0;

  while (scanned < 1000) {
    var threads = GmailApp.search(
      'in:sent after:' + LEAD_SEARCH_AFTER + ' before:' + LEAD_SEARCH_BEFORE,
      offset,
      LEAD_THREADS_PER_RUN
    );
    if (threads.length === 0) break;

    for (var t = 0; t < threads.length; t++) {
      var subject = threads[t].getFirstMessageSubject() || '(utan ämne)';
      var date = threads[t].getLastMessageDate();

      counts[subject] = (counts[subject] || 0) + 1;
      if (!firstSeen[subject] || date < firstSeen[subject]) firstSeen[subject] = date;
      if (!lastSeen[subject] || date > lastSeen[subject]) lastSeen[subject] = date;
    }

    scanned += threads.length;
    offset += threads.length;
    if (threads.length < LEAD_THREADS_PER_RUN) break;
  }

  var rows = [];
  for (var subject in counts) rows.push([subject, counts[subject]]);
  rows.sort(function (a, b) { return b[1] - a[1]; });

  console.log('Gick igenom ' + scanned + ' trådar i Skickat ' + LEAD_SEARCH_AFTER + '–' + LEAD_SEARCH_BEFORE + '.');
  console.log('De vanligaste ämnesraderna, flest först:');
  for (var i = 0; i < Math.min(rows.length, 30); i++) {
    console.log(
      '  ' + rows[i][1] + ' st  ' +
      Utilities.formatDate(firstSeen[rows[i][0]], 'Europe/Stockholm', 'yyyy-MM-dd') + ' – ' +
      Utilities.formatDate(lastSeen[rows[i][0]], 'Europe/Stockholm', 'yyyy-MM-dd') + '  ' +
      rows[i][0]
    );
  }
  console.log('Sätt LEAD_SUBJECT till den rad som är välkomstmejlet, och kör exportLeadsDryRun().');
}

// ─── Steg 3 och 4: genomgången ────────────────────────────────────────────────

function exportLeadsDryRun() {
  runLeadExport(true);
}

function exportLeadsBackfill() {
  runLeadExport(false);
}

function runLeadExport(dryRun) {
  var ownerEmail = getLeadOwnerEmail();
  var config = getConfig();
  var props = PropertiesService.getScriptProperties();

  // Torrkörningen har en egen offset, så att den inte flyttar fram den skarpa.
  var key = dryRun ? 'LEAD_OFFSET_DRY' : 'LEAD_OFFSET';
  var offset = Number(props.getProperty(key) || 0);

  var threads = GmailApp.search(leadQuery(), offset, LEAD_THREADS_PER_RUN);

  if (threads.length === 0) {
    console.log('KLART. Inga fler trådar. Totalt genomgånget: ' + offset);
    return;
  }

  var mails = collectLeadMails(threads, ownerEmail);
  var res = flushLeadMails(config, mails, dryRun);

  var newOffset = offset + threads.length;
  props.setProperty(key, String(newOffset));

  console.log(
    (dryRun ? 'TORRKÖRNING ' : '') +
    'trådar ' + offset + '-' + newOffset + ': ' +
    mails.length + ' utskick hittade, ' +
    res.imported + ' nya, ' + res.replies + ' hade svarat, ' +
    res.skipped + ' redan kända. ' +
    'Kör ' + (dryRun ? 'exportLeadsDryRun' : 'exportLeadsBackfill') + '() igen för nästa portion.'
  );
}

function resetLeadExport() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('LEAD_OFFSET');
  props.deleteProperty('LEAD_OFFSET_DRY');
  console.log('Nollställt. Nästa körning börjar om från första tråden.');
}

// ─── Hjälpfunktioner ──────────────────────────────────────────────────────────

// En studs är inget svar. Kommer mejlet tillbaka från mailer-daemon har adressen
// inte ens tagit emot utskicket, och räknades det som ett svar hade personen
// märkts som prospect i panelen — en påhittad konversation med en död adress.
function isMachineSender(from) {
  var local = from.split('@')[0];
  return (
    local === 'mailer-daemon' ||
    local === 'postmaster' ||
    local.indexOf('noreply') === 0 ||
    local.indexOf('no-reply') === 0
  );
}

// Plockar ut ett utskick per tråd: vem det gick till, när, och om mottagaren
// svarade. Att titta på hela tråden och inte bara utskicket är hela poängen —
// ett svar är det som avgör om personen ska hoppas över i påminnelsejobbet.
function collectLeadMails(threads, ownerEmail) {
  var mails = [];

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var messages = thread.getMessages();

    var outgoing = null;
    var replied = false;

    for (var i = 0; i < messages.length; i++) {
      var from = extractEmail(messages[i].getFrom());

      if (from === ownerEmail) {
        // Första utskicket i tråden är välkomstmejlet. Skickade Erik fler i
        // samma tråd är det uppföljningar, och de ändrar inget här.
        if (!outgoing) outgoing = messages[i];
      } else if (!isMachineSender(from)) {
        replied = true;
      }
    }

    if (!outgoing) continue;

    // Mottagaren, inte avsändaren. Zapier-mejlet gick till en adress åt gången,
    // men To kan innehålla namn och vinkelparenteser — extractEmail rensar det.
    var to = extractEmail(outgoing.getTo());
    if (!to || to.indexOf('@') < 0) continue;
    if (to === ownerEmail) continue;

    mails.push({
      messageId: outgoing.getId(),
      gmailThreadId: thread.getId(),
      email: to,
      subject: outgoing.getSubject() || '',
      sentAt: outgoing.getDate().toISOString(),
      replied: replied,
    });
  }

  return mails;
}

function flushLeadMails(config, mails, dryRun) {
  var imported = 0;
  var replies = 0;
  var skipped = 0;

  for (var i = 0; i < mails.length; i += LEAD_BATCH_SIZE) {
    var batch = mails.slice(i, i + LEAD_BATCH_SIZE);
    var res = callApi(config, '/api/inmail/leads/import', { mails: batch, dryRun: dryRun });

    if (!res) {
      skipped += batch.length;
      continue;
    }

    imported += res.imported || 0;
    replies += res.replies || 0;
    skipped += res.skipped || 0;
  }

  return { imported: imported, replies: replies, skipped: skipped };
}
