# AI-testmiljö

Fristående sandlåda för att köra bokförings-AI:n mot riktiga underlag — utan
att gå via appen och utan att något sparas i databasen.

## Två sätt att köra

**I webbläsaren** (medan `npm run dev` är igång):

    http://localhost:3000/ai-test

Sidan har två flikar:

- **Underlag (AI)** — dra in filer, välj kund, välj typ/modell, redigera
  prompten direkt i rutan och kör.
- **SIE4-fil** — dra in en SIE4-fil så listas varje verifikationsrad som en
  egen transaktion. Se nedan.

Sidan och API-rutterna (`/api/ai-test/*`) svarar bara i dev — i produktion ger
de 404, eftersom analysrutten tar emot en fri systemprompt.

**Från terminalen:**

1. Lägg dina filer i `ai-test/underlag/`
2. Kör `npm run ai-test`
3. Svaren skrivs ut i terminalen och sparas som JSON i `ai-test/resultat/`

Båda vägarna kör samma kod i `analyze.mjs`.

## Vad som analyseras hur

Typen gissas på filändelsen:

| Filer | Analys | Motsvarar i appen |
|---|---|---|
| `.pdf` `.jpg` `.png` `.webp` `.heic` | kvitto/faktura | `/api/bokforing/analyze-receipt` |
| `.csv` `.xlsx` `.xls` `.txt` | transaktionslista | `/api/bokforing/analyze-transactions` |

PDF:er hanteras som i appen: texten läses ut först, och bara om PDF:en är
skannad (nästan ingen text) renderas första sidan till bild och skickas till
vision-modellen.

## SIE4-fliken

SIE är ett strikt textformat, så det tolkas rakt av i `sie.mjs` — ingen AI, inga
API-kostnader, inga gissningar. Fliken visar filens huvud (företag, org.nr,
räkenskapsår, program), en summering, och varje `#TRANS`-rad som en egen
transaktion med kontonamn från `#KONTO`. Du kan söka i listan och ladda ner den
som CSV.

Detaljer som hanteras:

- **Teckenkodning** — SIE-standarden föreskriver CP437 (`#FORMAT PC8`), men
  moderna program exporterar ibland UTF-8. Filen avkodas efter vilket som
  stämmer, och vilken det blev visas i huvudet.
- **`#BTRANS` / `#RTRANS`** — historik för borttagna och ändrade rader. De räknas
  inte som transaktioner, bara `#TRANS`.
- **Objektlistor** (`{1 "100"}`) tolkas till dimension/objekt och visas i listan.
  Rader utan objektlista fungerar också.
- **Obalanserade verifikationer** flaggas — summan per verifikation ska bli noll.

`exempel-sie4.se` är en påhittad testfil (CP437, tre verifikationer varav en
medvetet skev) om du vill se hur fliken beter sig utan att ta fram en riktig fil.

### Arkivet

Tryck **Spara i databasen** så hamnar filen i tabellen `sie_files`, och den dyker
upp i listan högst upp i fliken. Klicka på en rad för att öppna den igen — hela
tolkningen ligger sparad, så inget behöver laddas upp på nytt. Varje fil kan få
en anteckning, och tas bort med krysset.

Laddar du upp samma fil två gånger sparas ingen dubblett: filerna checksummas
(sha256), och den befintliga raden öppnas istället.

**Koppla till kund.** En sparad fil kan kopplas till en kund (`profiles`) —
tryck *Koppla till kund*, sök och klicka. Kopplingen går att byta och ta bort när
som helst, och arkivlistan har en kundkolumn plus ett filter så du kan se allt
som hör till en viss kund (eller allt som saknar kund).

Kopplingen är helt intern. Kunden ser varken filen eller dess transaktioner:
`sie_files` har RLS utan policies och läses bara av dev-rutten med service
role-nyckeln, och inget ur SIE-filen skrivs någonsin till
`bokforing_transaktioner` — tabellen som kundens egen app läser. Fältet
`kund_id` är bara en etikett för din egen sortering.

Sparas per fil: filnamn, storlek, teckenkodning, företag, org.nr, program,
SIE-typ, räkenskapsår, antal verifikationer och transaktioner, summor — plus
hela tolkningen som JSON och råfilen i klartext. Råfilen finns kvar just för att
en sparad fil ska kunna tolkas om när `sie.mjs` förbättras.

Tabellen har RLS påslaget utan policies, så varken anon- eller inloggade nycklar
kommer åt den. Endast serverrutten, som kör med service role-nyckeln och bara
svarar i dev, läser och skriver.

## Flaggor

```bash
npm run ai-test -- --fil kvitto2          # bara filer vars namn innehåller "kvitto2"
npm run ai-test -- --typ transaktioner    # tvinga analystyp istället för att gissa
npm run ai-test -- --haendelse kund-betalat  # kvitton: försäljning istället för inköp
npm run ai-test -- --haendelse auto       # kvitton: låt AI:n avgöra riktningen per fil
npm run ai-test -- --modell gpt-4o        # kör en annan modell
npm run ai-test -- --basdokument          # skicka med utdrag ur regelverket
npm run ai-test -- --tyst                 # hoppa över den råa JSON-utskriften
```

## Kvitton och fakturor → transaktioner → kontering

Underlag-fliken går i två steg.

**Steg 1 — tolka.** Släpp in kvitton och fakturor: `pdf`, `jpg`, `png`, `webp`,
`heic`, flera samtidigt. En pdf med textlager läses som text; är den skannad
renderas första sidan till bild och skickas som bild. Tryck **Tolka underlagen**.
Redan tolkade filer hoppas över, så du kan släppa in fler i högen och köra igen
utan att betala för de gamla en gång till.

**Steg 2 — kontera.** Varje tolkat underlag blir en rad under **Tolkade
underlag**: datum, vad som köptes, belopp, moms och riktning. Raderna är
förmarkerade och går att rätta — riktningen är en rullgardin, och rader du inte
vill ha kan tas bort. Tryck **Kontera markerade underlag** så konteras allihop i
ett anrop med tvåpassanalysen.

Stegen är medvetet skilda åt: först ser du vad tolkningen av papperet gav, sedan
väljs kontot. Blir konteringen fel går det att se om felet uppstod redan i
avläsningen eller först i kontovalet.

Moms och händelsetyp följer med till konteringen, eftersom tolkningen redan tagit
fram dem — de blir egna kolumner i underlaget istället för något modellen får
gissa om.

Ingenting sparas i databasen; det här är fortfarande bara en testmiljö.

### Inköp eller försäljning

En uppladdad hög blandar leverantörsfakturor och egna kundfakturor, så frågan går
inte att besvara en gång för hela högen. Standardläget är därför **Auto**: AI:n
avgör per underlag, på vem som är utfärdare och vem som är mottagare.

Är en kund vald i sidopanelen prövas svaret dessutom mot kundens egna namn i kod
(`riktningFranAvsandare` i `analyze.mjs`). Står företagets eget namn som
utfärdare är det en försäljning, oavsett vad modellen svarade — namnet på
papperet är ett hårdare besked än en gissning. Utan vald kund finns inget att
jämföra mot, och då står modellens svar kvar.

Det spelar roll i praktiken: utan företagsnamnet klassade modellen en kundfaktura
som Liljedahls Trädgårdar själva ställt ut som ett *inköp*, för den hade ingen
aning om vem "vi" är. Med namnet blev det rätt.

Riktningen går alltid att rätta i tabellen efteråt.

## Tvåpass med kontoregler

Bocka i **Tvåpass med kontoregler** i sidopanelen, så konteras de markerade
underlagen så här:

1. **Pass 1** — AI:n föreslår konton utan promptens lista på vanliga konton
   (`TRANSAKTIONER_PROMPT_FRI`). Poängen är att se vad modellen själv kan.
2. **Grinden** — koden i `kontoregler.mjs` slår upp de föreslagna kontona i
   K1-kontobeskrivningarna och prövar det som går att avgöra deterministiskt:
   att kontonumret är giltigt, att kontot inte är spärrat för automatisk
   kontering, och beloppsgränserna med rätt årsvärde.
3. **Pass 2** — rader där kontot har situationsberoende regler går tillbaka till
   modellen med exakt den kontoraden inklistrad (`GRANSKNING_PROMPT`).
4. **Grinden igen** — byter pass 2 konto prövas det nya också, så andra passet
   inte kan smita förbi koden.

Varje rad får ett omdöme: *godkänd*, *granska*, *ändrad*, *stopp* eller *inget
svar*. Flaggorna visas i resultatet med källa, så det syns om det var koden
eller modellen som reagerade.

**Regelfilen** är `public/K1_kontobeskrivningar*.xlsx` — nyaste filen används,
eller den `KONTOREGLER_FIL` pekar på. Arket *Gränsvärden* innehåller två
tabeller under varandra (parametrar, sedan regler med jämförelseoperator);
läsaren delar dem vid den andra rubrikraden.

**Underkonton ärver.** Regelfilen är K1-kontoplanen, som är avsiktligt grov,
medan riktiga bokföringar använder BAS underkonton. Saknas 5460 slås 5400 upp
istället, och att regeln är ärvd följer med i flaggan. På en riktig SIE-fil
(980 rader) går täckningen från 38 % till 99 % av raderna med den uppslagningen.

**Syskonkonton byts inte.** Flera konton är ofta lika gångbara: 1930 och 1932,
3011 och 3014, 5616 och 5618. Delar två konton tresiffrig BAS-grupp eller
K1-huvudkonto har de samma regler, och då finns det inget i regelverket som kan
motivera ett byte mellan dem. Vill granskningen ändå byta rullas bytet tillbaka
och raden flaggas för granskning med båda kontona synliga — du väljer. Utan den
spärren slog pass 2 ut korrekta 5616 Trängselskatt till förmån för 5618.

Samma skillnad används när träffsäkerhet mäts: *exakt konto* och *rätt
huvudkonto* redovisas separat, för att välja 3011 istället för 3014 inte är
samma sorts fel som att välja 4000.

**Kundförskott kräver stöd i underlaget.** Regeln för 3000 lyder "kundförskott
över 5 000 kronor för en prestation som inte har påbörjats" — två villkor, men
granskningen såg bara beloppsgränsen och gjorde om *varje* kundfaktura över
5 000 kr till en skuld på 2900. Citerar granskningen förskottsregeln utan att
underlaget nämner förskott, a conto, handpenning eller deposition rullas bytet
tillbaka och raden flaggas för granskning.

Att lägga in villkoret i `GRANSKNING_PROMPT` istället provades först och ändrade
ingenting — modellen upprepade samma motivering ordagrant. Därför sitter spärren
i kod.

**Varje rad har en motivering.** Pass 1 måste skriva vad i underlaget som avgjorde
kontovalet, och den visas som `[förslag]` i resultatet — även på rader som
godkänns direkt och aldrig går till pass 2. Gick raden vidare står pass 2:s
motivering under som `[granskning]`. Med båda synliga går det att se om ett fel
uppstod redan i avläsningen av underlaget eller först i kontovalet. Struntar
modellen i fältet skriver koden ut att det saknas, istället för att raden tyst
blir omotiverad.

**Gränsvärden räknas alltid i kod**, aldrig av modellen: prisbasbeloppet för
rätt år, halva prisbasbeloppet, 5 000-kronorsgränsen. Modellen får det färdiga
utfallet inklistrat och instruktionen att godta siffran.

**Radnr.** Varje rad numreras i CSV:n och modellen ska skicka tillbaka numret.
Utan det går svaren inte att para ihop med underlaget — modellen slår ibland
ihop eller hoppar över rader, och då förskjuts allting efteråt tyst. Rader utan
svar redovisas som *inget svar* istället för att försvinna.

**Temperatur 0** i tvåpassläget, så att två körningar på samma rader går att
jämföra. Med modellens standardtemperatur skiljer sig resultatet mellan
körningar tillräckligt mycket för att dränka effekten av en promptändring.

Kostnaden: en körning på nio rader landade på ~2 000 tokens i pass 1 och
~20 000 i granskningen, eftersom varje rad som granskas får hela kontoraden
inklistrad.

## Basdokument (regelverket)

Dokumenten i storage-bucketen **Basdokument** — K1-vägledningen, kontoplanen och
Skatteverkets material — indexeras till tabellen `ai_test_knowledge_chunks` och
söks fram per analys.

Två filer är undantagna i `HOPPA_OVER` och indexeras **inte**:

`K1_kontobeskrivningar*.xlsx` — kalkylarket läses redan exakt av
`kontoregler.mjs`, uppslaget på kontonummer, vilket är bättre än att söka i
CSV-rader kapade mitt i en cell. Så länge det låg i indexet tog det dessutom över
sökningen helt: alla sex träffarna på en konteringsfråga kom därifrån, som
obegripliga fragment.

`Ref-K1-Vagledningen.pdf` — samma vägledning som `K1-Vagledningen.pdf`, fast
upplagan från **2013-12-05** i stället för **2025-03-24**. De två låg med 0,57 i
ordlikhet som median och tog tillsammans 14 % av indexet, så varje sökning lade
platser på att hämta samma text två gånger — ibland i den gamla lydelsen.
Behöver du den gamla upplagan igen: ta bort den ur regexen och indexera om.

Kör du om indexeringen rensas raderna för undantagna filer bort automatiskt.

```bash
npm run index-basdokument            # indexera allt i bucketen
npm run index-basdokument -- --lista # vad finns, och vad är indexerat?
npm run index-basdokument -- --fil kontoplan   # bara ett dokument
```

Indexeringen hanterar `.pdf` (text läses ut) och `.xlsx`/`.xls`/`.csv` (varje ark
blir text). Lägger du till ett dokument i bucketen räcker det att köra om — varje
källa rensas innan den skrivs om, så det blir inga dubbletter.

### Textstädningen

PDF-text kommer ut med en radbrytning vid varje *visuell* rad, inte vid varje
stycke. Utan efterbehandling blir varje chunk därför en samling halva meningar,
och `städa()` gör därför fyra saker innan texten chunkas:

- **Flödar ihop raderna** till stycken igen. Tom rad = styckebrytning; listpunkter
  och numrerade rubriker behåller sin egen rad.
- **Lagar avstavningar** över radbrytning: `inklu-\nsive` → `inklusive`.
- **Slänger sidnummer och innehållsförteckningsrader** som annars hamnar mitt
  inne i en mening.
- **Städar tecken**: `a` + kombinerande ring → `å` (NFC), punktledarglyfer som
  saknas i typsnittet, punktlistor i Symbol-typsnitt, mjuka bindestreck.

Chunkarna byggs sedan av **hela stycken**, och överlappet är också hela stycken.
Tidigare klipptes de sista 300 tecknen rakt av, vilket gjorde att nästan varje
chunk började mitt i ett ord.

Mätt på materialet: chunkar som började mitt i en mening gick från 540 av 599
till 10 av 376 PDF-chunkar, och radbrytningar mitt i en mening från 16 137 till
771.

### En sökning per rad, och bara vid konteringen

Sökningen görs i **konteringssteget**, en gång per rad — inte en gång för hela
högen, och inte alls vid tolkningen av underlaget.

**Varför inte vid tolkningen.** Kvittosteget svarar bara på vad som står på
papperet: vad, datum, belopp, moms, land, utfärdare. Kontovalet görs först
efteråt. Mätt på sex svårlästa underlag gav sökningen exakt samma 25 av 25 rätta
fält som utan — till 36 215 tokens i stället för 4 965. Den är därför avstängd i
`analyseraKvitto`.

**Varför per rad.** Förut skickades hela CSV:en som en enda sökfråga. Frågan blev
då genomsnittet av alla rader, och utdragen som kom tillbaka hörde inte hemma på
någon av dem — leasingregler hamnade på en maskinhyra och regeln om "naturligt
samband" på en EU-faktura. `sokReglerPerRad()` i `tvapass.mjs` ställer i stället
en fråga per rad, tre träffar var, och slår ihop dem utan dubbletter.

**Frågan är radens egen text.** `byggRadfraga()` skickar bara beskrivningen och
siffrorna — ingen inramande formulering. Raden är redan uttolkad av kvittosteget
("Hyra av minigrävare 3 dygn — Svensk Maskinuthyrning AB"), alltså precis den
destillerade beskrivning som en inramning skulle ha försökt skapa. Lägger man en
fråga ovanpå får alla rader samma inledning, och embeddingen dras mot den
gemensamma texten i stället för mot det som skiljer raderna åt. Mätt på sex
rader, andel som fick utdrag inom sitt eget ämne:

| Sökfråga | Träff på eget ämne |
|---|---|
| Rå radtext | **6/6** |
| Radtext + kort fråga | 5/6 |
| Fråga först, radtext sedan | 4/6 |

I gränssnittet styrs det med **Använd basdokument vid kontering** (på som
standard). Varje färdig analys visar **Utdragen ur basdokumenten som skickades
med**, med källa, chunk-nummer och likhet — så du kan se om sökningen faktiskt
hittade rätt, vilket är hela poängen med att kunna stänga av den och jämföra.

I CLI:t: `npm run ai-test -- --basdokument` (av som standard där).

Prompten säger åt modellen att instruktionerna gäller före utdragen, och att den
aldrig får hitta på regler som inte står i dem. Det hindrar den däremot inte från
att tillämpa en **hämtad** regel som underlaget inte ger stöd för — se
kundförskottsspärren i `tvapass.mjs`.

Mail-AI:ns eget index (`inmail_knowledge_chunks`) är orört — det är två skilda
tabeller med varsin sökfunktion.

## Kundkontext

Överst i sidopanelen väljer du kund. Kunderna är raderna i `profiles`, och det
som skickas med är i första hand `verksamhet` — fritexten kunden skrev i
onboardingen — plus de uppgifter som faktiskt påverkar konteringen: företag,
org.nr, momsreg.nr, ort, momsperiod, bokföringsmetod, säljer till/i och köper i.

Blocket läggs sist i systemprompten, efter reglerna. Tryck **Visa vad AI:n får**
för att se exakt vad som skickas, och varje färdig analys har kontexten sparad
under **Kundkontexten som skickades med** så du i efterhand kan se vad ett visst
svar byggde på.

Kontexten byggs på servern (`src/lib/ai-test/kundkontext.ts`) utifrån kund-id:t,
inte utifrån det webbläsaren skickar — så det som hamnar i prompten alltid
speglar vad som står i databasen.

Kunder utan verksamhetstext är bortfiltrerade som standard; bocka ur rutan för
att se alla. Väljer du ingen kund körs analysen precis som förut, utan kontext.

Kundlistan är dev-only av samma skäl som resten av sidan — den innehåller
kunduppgifter.

## Testa promptändringar

Prompterna ligger i `prompts.mjs` — kopior av dem i API-rutterna. Ändra där,
kör om, jämför resultatet. Filen läses om vid varje körning, så du behöver
inte starta om dev-servern. På webbsidan kan du också ändra prompten tillfälligt
i textrutan utan att röra filen. När du hittat en formulering som funkar bättre
flyttar du över den till rutten den kom från:

- `src/app/api/bokforing/analyze-receipt/route.ts`
- `src/app/api/bokforing/analyze-transactions/route.ts`

Kör samma fil med två modeller och jämför JSON-filerna i `resultat/`:

```bash
npm run ai-test -- --fil faktura --modell gpt-4o
npm run ai-test -- --fil faktura --modell gpt-5.5
```

## Sekretess

`underlag/` och `resultat/` är gitignorerade — riktiga kundunderlag ska aldrig
hamna i repot. Filerna skickas till OpenAI vid körning, precis som i appen.
