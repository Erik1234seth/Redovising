// ─── Frågemejlet: ett mejl per kund och dygn om det som saknas ───────────────
// Kl 18 varje dag ber den servern (/api/inmail/fragemejl) samla alla
// transaktioner vi har frågor om och skriva ett mejl per kund. Mejlen blir
// utkast i adminpanelens inkorg — inget skickas förrän någon trycker Skicka.
//
// Ligger i samma Apps Script-projekt som check-inbox.gs och återanvänder
// getConfig() och callApi() därifrån. Äger varken doGet eller doPost.
//
// Kör setUpFragemejl() EN gång från redigeraren.

function skrivFragemejl() {
  callApi(getConfig(), '/api/inmail/fragemejl', {});
}

function setUpFragemejl() {
  var removed = removeFragemejlTriggers();
  ScriptApp.newTrigger('skrivFragemejl').timeBased().atHour(18).everyDays(1).inTimezone('Europe/Stockholm').create();
  console.log('Frågemejlet uppsatt: varje dag kl 18.' + (removed ? ' Tog bort ' + removed + ' tidigare trigger(s).' : ''));
}

function removeFragemejlTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'skrivFragemejl') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  return removed;
}
