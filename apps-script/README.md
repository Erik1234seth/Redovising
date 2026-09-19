# Apps Script

Filerna ligger i **samma** Apps Script-projekt på script.google.com, inloggat som
erik@enklabokslut.se. Projektet äger både Gmail-inkorgen och utskicken.

| Fil | Riktning | Vad den gör |
| --- | --- | --- |
| `check-inbox.gs` | Gmail → oss | Tidsstyrd trigger läser olästa mejl och postar till `/api/inmail` respektive `/api/inmail/reply`. AI-svaret sparas som utkast i tråden. Äger `doGet`. |
| `send-mail.gs` | oss → Gmail | Webbapp som tar emot `doPost` från `handleNewLead` och skickar välkomstmejlet till nya leads. Äger `doPost`. |
| `save-attachments.gs` | Gmail → oss | Anropas från `checkInbox` innan mail-AI:n. Laddar upp varje bilaga direkt till lagringen (via `/api/inmail/underlag`) och sparar den som underlag på avsändarens adress. Alla filtyper, ingen tolkning. Varken `doGet` eller `doPost`. |
| `sync-mail.gs` | Gmail → oss | Tidsstyrd trigger varje timme speglar alla konversationer, åt båda hållen, till `/api/inmail/messages/import` (tabellen `mail_messages`). Syns under fliken Mejl på personsidan. Varken `doGet` eller `doPost`. |
| `export-sent.gs` | Gmail → oss | Tidsstyrd trigger skickar nattligen upp dina skickade svar till `/api/inmail/examples/import`, så AI:n kan härma din ton. Varken `doGet` eller `doPost`. |

Ett Apps Script-projekt får ha **en** `doGet` och **en** `doPost`. `check-inbox`
äger den ena och `send-mail` den andra, så lägg inte till fler av dem.
`export-sent.gs` har ingen av delarna och krockar därför inte — den återanvänder
`getConfig()`, `callApi()` och `extractEmail()` ur `check-inbox.gs`, eftersom
filerna i ett Apps Script-projekt delar globalt scope.

## Mailbanken

`export-sent.gs` har två ingångar med olika sökstrategi:

- **`exportSentDaily()`** — trigger-målet. Söker på datum (`in:sent newer_than:2d`)
  och tar med marginal bakåt. Importen gör upsert på `message_id`, så överlappet
  ger inga dubbletter.
- **`exportSentBackfill()`** — engångsimport av historiken, körs för hand om och
  om igen tills den säger KLART. Söker på offset och minns var den slutade i
  `EXPORT_OFFSET`. `resetExport()` nollställer.

Offset används medvetet *inte* i dagsjobbet: varje nytt skickat mejl knuffar ner
träfflistan, så en sparad offset pekar på fel tråd nästa dag.

**Sätt igång:** kör `setUpDailyExport()` en gång från redigeraren. Den tar bort
en eventuell tidigare trigger för samma funktion först, så den går att köra om.
`removeDailyExport()` stänger av.

## Mejlarkivet

`sync-mail.gs` fungerar som mailbanken:

- **`syncMailRecent()`** — trigger-målet. Söker `newer_than:2d` varje timme.
  Importen gör upsert på meddelandets id, så överlappet ger inga dubbletter.
- **`syncMailBackfill()`** — engångsimport av två års historik. Kör för hand
  om och om igen tills den säger KLART. Minns var den slutade i
  `MAIL_SYNC_OFFSET`; `resetMailSync()` börjar om.

Kunden är avsändaren på inkommande mejl och första mottagaren som inte är vi
på utgående. Skräppost, papperskorgen, Kampanjer, Socialt, utkast och
no-reply-adresser tas inte med.

**Sätt igång:** kör `setUpMailSync()` en gång, sedan `syncMailBackfill()` tills
den säger KLART. `removeMailSync()` stänger av.

## Script Properties

Inga hemligheter står i koden. Sätts under Project Settings → Script Properties:

| Nyckel | Värde |
| --- | --- |
| `NEXT_URL` | `https://app.enklabokslut.se` |
| `INMAIL_SECRET` | samma som i `.env.local` och Vercel |
| `GMAIL_SCRIPT_SECRET` | samma som i `.env.local` och Vercel |

## Tappade svar i send-mail.gs

Google lämnar scriptets svar på en engångsadress som ibland svarar 404, trots
att mejlet redan gått iväg. Servern skickar därför med ett `ref`, scriptet
sparar utfallet i CacheService (6 h), och servern frågar `action: 'lookup'`
när svaret tappats. Inget skickas om. Kör webbappen en äldre version utan
lookup loggas utskicket som "okänt om mejlet gick iväg".

## Efter en ändring

Distribuera → Hantera distributioner → pennan → Version: **Ny version** →
Distribuera. Samma URL fortsätter gälla. Redigerad kod som inte distribuerats om
påverkar bara triggern, inte webbappen.
