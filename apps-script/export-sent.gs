// ─── Mailbanken: hämtar dina skickade svar ────────────────────────────────────
// Går igenom Skickat, parar ihop kundens mejl med ditt svar och skickar upp
// paren till /api/inmail/examples/import. AI:n söker sedan i dem för att härma
// din ton. Utkast räknas inte — bara mejl du faktiskt skickat, alltså sådant du
// stått bakom.
//
// Ligger i samma Apps Script-projekt som check-inbox.gs och send-mail.gs, och
// återanvänder getConfig(), callApi() och extractEmail() därifrån. Filen äger
// varken doGet eller doPost, så den krockar inte med de andra två.
//
// TVÅ funktioner, för de har olika jobb:
//
//   exportSentDaily()     Körs av en tidsstyrd trigger varje natt. Söker på
//                         DATUM (senaste dygnen), inte offset.
//   exportSentBackfill()  Körs för hand, om och om igen, för att beta av
//                         historiken en gång. Söker på OFFSET och kommer ihåg
//                         var den slutade i EXPORT_OFFSET.
//
// Varför inte samma funktion till båda: offset i en Gmail-sökning är instabil
// över tid. Varje nytt skickat mejl knuffar ner allt annat i träfflistan, så en
// offset som pekade på en viss tråd igår pekar på en annan idag. Det gör offset
// oanvändbart för ett återkommande jobb, men helt rätt för en engångsgenomgång.
//
// Att köra om är ofarligt: importen gör upsert på message_id, så samma svar kan
// skickas upp hur många gånger som helst utan att bli dubbletter. Därför tar
// dagsjobbet med extra marginal bakåt i tiden istället för att försöka pricka
// exakt sedan förra körningen.

var EXPORT_DAILY_QUERY = 'in:sent newer_than:2d';
var EXPORT_BACKFILL_QUERY = 'in:sent newer_than:2y';
var EXPORT_THREADS_PER_RUN = 50;
var EXPORT_MAX_THREADS_DAILY = 300;
var EXPORT_BATCH_SIZE = 20;

// Adressen som räknas som "du" när ett par plockas ut. Session.getActiveUser()
// användes förut, men den returnerar tom sträng när koden körs från en tidsstyrd
// trigger istället för från redigeraren. Blir den tom matchar ingen avsändare,
// allt hoppas över, och loggen skriver "0 exempel" som om Skickat vore tomt —
// ett fel som inte ser ut som ett fel. getEffectiveUser() är ägaren av skriptet
// och funkar även under trigger; konstanten finns som sista utväg.
var EXPORT_FALLBACK_EMAIL = 'erik@enklabokslut.se';

function getExportOwnerEmail() {
  try {
    var effective = Session.getEffectiveUser().getEmail();
    if (effective) return effective.toLowerCase();
  } catch (err) {
    console.warn('getExportOwnerEmail: getEffectiveUser gav fel: ' + err.message);
  }
  return EXPORT_FALLBACK_EMAIL.toLowerCase();
}

// ─── Dagligt jobb (tidsstyrd trigger) ─────────────────────────────────────────

function exportSentDaily() {
  var ownerEmail = getExportOwnerEmail();
  var config = getConfig();

  var examples = [];
  var offset = 0;
  var seenThreads = 0;

  // Bläddrar inom den här körningen. Offseten sparas inte mellan körningar —
  // nästa natt börjar om från noll med en färsk datumsökning.
  while (seenThreads < EXPORT_MAX_THREADS_DAILY) {
    var threads = GmailApp.search(EXPORT_DAILY_QUERY, offset, EXPORT_THREADS_PER_RUN);
    if (threads.length === 0) break;

    collectPairs(threads, ownerEmail, examples);
    seenThreads += threads.length;
    offset += threads.length;

    if (threads.length < EXPORT_THREADS_PER_RUN) break;
  }

  var res = flushExamples(config, examples);

  console.log(
    'exportSentDaily: gick igenom ' + seenThreads + ' trådar. ' +
    'Sparade ' + res.imported + ' exempel, hoppade över ' + res.skipped + '.'
  );
}

// ─── Engångsimport av historiken (körs för hand) ──────────────────────────────
// Tar 50 trådar per körning och sparar var den slutade, så kör den om och om
// igen tills den säger KLART. Apps Script bryter en körning efter 6 minuter,
// därför portionerna. Vill du börja om: kör resetExport() först.

function exportSentBackfill() {
  var ownerEmail = getExportOwnerEmail();
  var config = getConfig();
  var props = PropertiesService.getScriptProperties();
  var offset = Number(props.getProperty('EXPORT_OFFSET') || 0);

  var threads = GmailApp.search(EXPORT_BACKFILL_QUERY, offset, EXPORT_THREADS_PER_RUN);

  if (threads.length === 0) {
    console.log('KLART. Inga fler trådar. Totalt genomgånget: ' + offset);
    return;
  }

  var examples = [];
  collectPairs(threads, ownerEmail, examples);
  var res = flushExamples(config, examples);

  var newOffset = offset + threads.length;
  props.setProperty('EXPORT_OFFSET', String(newOffset));

  console.log(
    'exportSentBackfill: trådar ' + offset + '-' + newOffset + '. ' +
    'Sparade ' + res.imported + ' exempel, hoppade över ' + res.skipped + '. ' +
    'Kör exportSentBackfill() igen för nästa portion.'
  );
}

function resetExport() {
  PropertiesService.getScriptProperties().deleteProperty('EXPORT_OFFSET');
  console.log('Nollställt. Nästa exportSentBackfill() börjar om från första tråden.');
}

// ─── Trigger-uppsättning ──────────────────────────────────────────────────────
// Kör EN gång från redigeraren. Tar bort en eventuell tidigare trigger för
// samma funktion först, så att köra den två gånger inte ger två nattliga jobb.

function setUpDailyExport() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;

  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'exportSentDaily') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }

  ScriptApp.newTrigger('exportSentDaily')
    .timeBased()
    .everyDays(1)
    .atHour(4)
    .create();

  console.log(
    'Daglig export uppsatt, kör runt kl 04. ' +
    (removed > 0 ? 'Tog bort ' + removed + ' tidigare trigger(s).' : '')
  );
}

function removeDailyExport() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;

  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'exportSentDaily') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }

  console.log('Tog bort ' + removed + ' trigger(s) för exportSentDaily.');
}

// ─── Gemensamma hjälpfunktioner ───────────────────────────────────────────────

// Plockar ut paren "kunden skrev → du svarade" ur en lista trådar och lägger
// dem i examples. Ett svar från dig som följer på ett annat mejl från dig är
// inget par, och automatmejl (noreply@) är ingen kund som ställt en fråga.
function collectPairs(threads, ownerEmail, examples) {
  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();

    for (var i = 1; i < messages.length; i++) {
      var reply = messages[i];
      var prev = messages[i - 1];

      var replyFrom = extractEmail(reply.getFrom());
      var prevFrom = extractEmail(prev.getFrom());

      if (replyFrom !== ownerEmail) continue;
      if (prevFrom === ownerEmail) continue;
      if (prevFrom.indexOf('noreply@') === 0) continue;

      examples.push({
        messageId: reply.getId(),
        gmailThreadId: threads[t].getId(),
        subject: reply.getSubject() || '',
        question: prev.getPlainBody() || '',
        answer: reply.getPlainBody() || '',
        sentAt: reply.getDate().toISOString(),
      });
    }
  }
}

// Skickar upp paren i portioner. Importen embeddar varje fråga, så portionerna
// håller nere både anropstiden och storleken på varje request.
function flushExamples(config, examples) {
  var imported = 0;
  var skipped = 0;

  for (var i = 0; i < examples.length; i += EXPORT_BATCH_SIZE) {
    var batch = examples.slice(i, i + EXPORT_BATCH_SIZE);
    var res = callApi(config, '/api/inmail/examples/import', { examples: batch });

    if (!res) {
      skipped += batch.length;
      continue;
    }

    imported += res.imported || 0;
    skipped += res.skipped || 0;
  }

  return { imported: imported, skipped: skipped };
}
