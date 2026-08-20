/**
 * Prompterna som testmiljön kör med.
 *
 * Detta är kopior av prompterna i de riktiga API-rutterna:
 *   kvitto        -> src/app/api/bokforing/analyze-receipt/route.ts
 *   transaktioner -> src/app/api/bokforing/analyze-transactions/route.ts
 *
 * Meningen är att du ska kunna ändra HÄR, köra om, och se skillnaden — utan
 * att röra produktionskoden. När du hittat en formulering som funkar bättre
 * flyttar du över den till rutten.
 */

export const MODELLER = {
  kvitto: 'gpt-5.5',
  transaktioner: 'gpt-4o',
};

export const KVITTO_PROMPT = `Du är expert på svensk bokföring och kvittoanalys. Analysera kvittot/fakturan och returnera JSON med exakt dessa fält:
{
  "vad": "kort beskrivning av vad som köptes/såldes",
  "datum": "YYYY-MM-DD eller null",
  "belopp": number (totalt inkl moms),
  "moms": number (momsbelopp, 0 om ej synligt),
  "land": "Sverige" eller "EU" eller "Utanför EU",
  "avsandare": "namn på utfärdaren",
  "betalningssatt": "Kontant" eller "Till företagskonto" eller "Till privatkonto" eller null
}`;

/**
 * Samma som KVITTO_PROMPT, men modellen avgör själv om underlaget är ett inköp
 * eller en försäljning.
 *
 * Behövs när man laddar upp en blandad hög: leverantörsfakturor och egna
 * kundfakturor kommer om vartannat, och då går frågan inte att besvara en gång
 * för hela högen. Riktningen syns dessutom på papperet — står vårt eget namn
 * som utfärdare är det vi som sålt.
 */
export const KVITTO_PROMPT_AUTO = `Du är expert på svensk bokföring och kvittoanalys. Analysera kvittot/fakturan och returnera JSON med exakt dessa fält:
{
  "vad": "kort beskrivning av vad som köptes/såldes",
  "datum": "YYYY-MM-DD eller null",
  "belopp": number (totalt inkl moms),
  "moms": number (momsbelopp, 0 om ej synligt),
  "land": "Sverige" eller "EU" eller "Utanför EU",
  "avsandare": "namn på utfärdaren",
  "haendelse_typ": "kopt-nagot" eller "kund-betalat",
  "betalningssatt": "Kontant" eller "Till företagskonto" eller "Till privatkonto" eller null
}

Om händelsetypen:
- "kopt-nagot" = vi har köpt något. Underlaget är utfärdat av en leverantör och ställt till oss.
- "kund-betalat" = vi har sålt något. Underlaget är utfärdat av oss och ställt till en kund.
- Avgör på vem som är utfärdare och vem som är mottagare, inte på vad som köpts. Ett butikskvitto är alltid "kopt-nagot".
- Står företagets eget namn (se OM KUNDEN nedan, om det finns med) som utfärdare är det alltid "kund-betalat" — då är det vi som skickat fakturan.
- Går det inte att avgöra: välj "kopt-nagot", för det är det vanliga.`;

export const TRANSAKTIONER_PROMPT = `Du är expert på svensk bokföring. Analysera denna transaktionslista och returnera ett JSON-objekt med nyckeln "transactions" som innehåller en array. Varje transaktion ska ha exakt dessa fält:
{
  "datum": "YYYY-MM-DD",
  "beskrivning": "kort beskrivning av transaktionen",
  "belopp": number (positivt tal, totalt inkl moms),
  "moms": number (momsbelopp, 0 om okänt eller saknas),
  "haendelse_typ": "kund-betalat" eller "kopt-nagot",
  "debit_konto": "kontonummer",
  "debit_namn": "kontonamn",
  "kredit_konto": "kontonummer",
  "kredit_namn": "kontonamn"
}

Regler:
- haendelse_typ "kund-betalat" = inkomst/försäljning (pengar IN till företaget)
- haendelse_typ "kopt-nagot" = utgift/inköp (pengar UT från företaget)
- Använd svenska BAS-konton. Vanliga: 1930 Företagskonto, 3001 Försäljning tjänster, 3002 Försäljning varor, 4000 Inköp varor, 5000 Lokalkostnader, 5400 Förbrukningsinventarier, 6000 Övriga rörelsekostnader
- För försäljning: debit 1930 / kredit 3001 eller 3002
- För inköp: debit relevant kostnadskonto / kredit 1930
- Om avgifter (t.ex. Zettle-provision): inkludera i beloppet och använd konto 6570 Bankkostnader för avgiften
- Skippa rader som är rubriker, summor eller tomma
- Returnera BARA JSON, ingen annan text`;

/**
 * Första passet i tvåpassläget: samma JSON som ovan, men UTAN listan på sju
 * vanliga konton. Poängen är att se vilket konto modellen själv landar på när
 * prompten inte styr den — förslaget prövas ändå mot regelverket efteråt.
 */
export const TRANSAKTIONER_PROMPT_FRI = `Du är expert på svensk bokföring enligt K1 (förenklat årsbokslut, enskild näringsidkare). Analysera denna transaktionslista och returnera ett JSON-objekt med nyckeln "transactions" som innehåller en array. Varje transaktion ska ha exakt dessa fält:
{
  "datum": "YYYY-MM-DD",
  "beskrivning": "kort beskrivning av transaktionen",
  "belopp": number (positivt tal, totalt inkl moms),
  "moms": number (momsbelopp, 0 om okänt eller saknas),
  "haendelse_typ": "kund-betalat" eller "kopt-nagot",
  "debit_konto": "kontonummer",
  "debit_namn": "kontonamn",
  "kredit_konto": "kontonummer",
  "kredit_namn": "kontonamn",
  "radnr": number (värdet ur kolumnen Radnr för raden svaret gäller),
  "sakerhet": "hog" eller "medel" eller "lag",
  "motivering": "en mening om varför just dessa konton — nämn vad i radens text eller belopp som avgjorde"
}

Regler:
- haendelse_typ "kund-betalat" = inkomst/försäljning (pengar IN till företaget)
- haendelse_typ "kopt-nagot" = utgift/inköp (pengar UT från företaget)
- Välj det konto i BAS-kontoplanen för K1 som passar affärshändelsen bäst. Begränsa dig INTE till de vanligaste kontona — är ett mer specifikt konto rätt, använd det.
- Är underlaget för tunt för att avgöra kontot, välj det du tror mest på och sätt sakerhet till "lag"
- Motivering är obligatorisk på varje rad, även när valet är självklart. Skriv vad i underlaget du gick på, inte en allmän beskrivning av kontot.
- Returnera exakt en post per inrad, och sätt alltid radnr till radens eget nummer. Slå inte ihop rader.
- Är en rad en rubrik, summa eller tom: ta ändå med den, med sakerhet "lag" och motivering som säger att raden inte är en affärshändelse.
- Returnera BARA JSON, ingen annan text`;

/**
 * Andra passet: modellen får kontobeskrivningens egna regler inklistrade och
 * prövar sitt eget förslag mot dem. Gränsvärden är redan uträknade i kod.
 */
export const GRANSKNING_PROMPT = `Du granskar ett konteringsförslag mot kontoplanens egna regler. Du får förslaget, underlaget och de exakta reglerna för de föreslagna kontona.

Returnera JSON med exakt dessa fält:
{
  "ok": true eller false,
  "brutna_regler": ["den exakta regeltexten som talar emot förslaget"],
  "granskning_kravs": true eller false,
  "debit_konto": "kontonummer efter din granskning",
  "debit_namn": "kontonamn",
  "kredit_konto": "kontonummer efter din granskning",
  "kredit_namn": "kontonamn",
  "motivering": "kort motivering på svenska"
}

Regler för granskningen:
- Utgå BARA från reglerna du får inklistrade. Hitta inte på regler som inte står där.
- Regelverket täcker ett urval av K1-konton, inte hela BAS-kontoplanen. Står det att ett konto saknar beskrivning betyder det bara att vi inte har någon regel för det — det är ALDRIG ett skäl att byta konto. Behåll kontot och sätt granskning_kravs=true.
- Byt bara konto när en inklistrad regel uttryckligen talar emot det valda kontot.
- Träffar någon punkt under "Använd INTE när" → ok=false, och byt till det konto texten hänvisar till.
- Träffar någon punkt under "Kräver manuell granskning när" → granskning_kravs=true. Behåll kontot; en människa avgör.
- Gränsprövningarna är uträknade i kod med rätt årsvärde. Godta siffrorna som de står, räkna inte om dem.
- Går det inte att avgöra på underlaget: granskning_kravs=true, ändra inte kontot.
- Är förslaget riktigt: ok=true och samma konton tillbaka.
- Returnera BARA JSON, ingen annan text`;

/** Användarmeddelandet för kvitton, beror på om det är inköp eller försäljning. */
export function kvittoUserMessage(haendelse) {
  if (haendelse === 'auto') {
    return 'Analysera detta underlag. Avgör själv om det är ett inköp vi gjort eller en försäljning vi gjort.';
  }
  return haendelse === 'kund-betalat'
    ? 'Analysera denna faktura/betalningsbekräftelse för en försäljning vi gjort.'
    : 'Analysera detta kvitto/faktura för ett inköp vi gjort.';
}
