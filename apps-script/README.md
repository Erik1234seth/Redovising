# Apps Script

Två filer i **samma** Apps Script-projekt på script.google.com, inloggat som
erik@enklabokslut.se. Projektet äger både Gmail-inkorgen och utskicken.

| Fil | Riktning | Vad den gör |
| --- | --- | --- |
| `check-inbox.gs` | Gmail → oss | Tidsstyrd trigger läser olästa mejl och postar till `/api/inmail` respektive `/api/inmail/reply`. AI-svaret sparas som utkast i tråden. Äger `doGet`. |
| `send-mail.gs` | oss → Gmail | Webbapp som tar emot `doPost` från `handleNewLead` och skickar välkomstmejlet till nya leads. Äger `doPost`. |

Ett Apps Script-projekt får ha **en** `doGet` och **en** `doPost`, så de två
filerna krockar inte — men lägg inte till fler.

## Script Properties

Inga hemligheter står i koden. Sätts under Project Settings → Script Properties:

| Nyckel | Värde |
| --- | --- |
| `NEXT_URL` | `https://app.enklabokslut.se` |
| `INMAIL_SECRET` | samma som i `.env.local` och Vercel |
| `GMAIL_SCRIPT_SECRET` | samma som i `.env.local` och Vercel |

## Efter en ändring

Distribuera → Hantera distributioner → pennan → Version: **Ny version** →
Distribuera. Samma URL fortsätter gälla. Redigerad kod som inte distribuerats om
påverkar bara triggern, inte webbappen.
