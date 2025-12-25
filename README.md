# Redovisningsbyrå - Hemsida

En modern, professionell webbplats för en redovisningsbyrå som specialiserar sig på enskilda firmor.

## Översikt

Denna webbplats är byggd med Next.js, React och TypeScript, och erbjuder två huvudtjänster:
- **NE-Bilaga** (1499 kr) - Kunden lämnar in själv
- **Komplett Tjänst** (3499 kr) - Vi sköter hela inlämningen

## Funktioner

### Huvudsidor
- **Startsida** (`/`) - Landningssida med paketval och ny/återkommande kund-toggle
- **Guider** (`/tutorial`) - Steg-för-steg instruktioner för båda paketen med bankspecifika videor
- **Om oss** (`/om-oss`) - Information om företaget och förenklad redovisning
- **Kontakt** (`/kontakt`) - Kontaktformulär och kontaktinformation

### Interaktiva Flöden

#### NE-Bilaga Flöde
1. Bankval - Välj mellan Swedbank, SEB, Nordea, Handelsbanken
2. Nedladdningsguide - Video för att ladda ner kontoutdrag
3. Uppladdning - Ladda upp kontoutdrag
4. Tidigare NE-bilaga - Valfri uppladdning av föregående års bilaga
5. Bekräftelse - Sammanfattning och nästa steg

#### Komplett Tjänst Flöde
1. Bankval
2. Nedladdningsguide
3. Uppladdning - Ladda upp kontoutdrag
4. Delegationsguide - Video för att ge behörighet via Skatteverket
5. Bekräftelse - Sammanfattning och nästa steg

## Teknisk Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 med TypeScript
- **Styling:** Tailwind CSS 4
- **Formulärhantering:** React hooks
- **Filuppladdning:** Drag & drop interface (frontend-only för tillfället)

## Banker som stöds

- Swedbank
- SEB
- Nordea
- Handelsbanken

Varje bank har sina egna instruktionsvideor för:
- Nedladdning av kontoutdrag
- Delegering av behörighet via Skatteverket

## Installation och Körning

### Utvecklingsmiljö

\`\`\`bash
# Installera beroenden
npm install

# Starta utvecklingsserver
npm run dev

# Öppna i webbläsare
http://localhost:3000
\`\`\`

### Produktionsbygge

\`\`\`bash
# Bygg för produktion
npm run build

# Starta produktionsserver
npm start
\`\`\`

## Projektstruktur

\`\`\`
redovisning-site/
├── src/
│   ├── app/                    # Next.js App Router sidor
│   │   ├── flow/              # Interaktiva flöden för båda paketen
│   │   │   └── [package]/     # Dynamiska routes per paket
│   │   ├── tutorial/          # Guidesida
│   │   ├── kontakt/           # Kontaktsida
│   │   ├── om-oss/            # Om oss-sida
│   │   ├── layout.tsx         # Huvudlayout
│   │   ├── page.tsx           # Startsida
│   │   └── globals.css        # Global CSS
│   ├── components/            # Återanvändbara komponenter
│   │   ├── Navigation.tsx     # Navigationsmeny
│   │   ├── Footer.tsx         # Sidfot
│   │   ├── FlowContainer.tsx  # Container för flow-sidor
│   │   ├── FlowProgress.tsx   # Progress bar
│   │   └── VideoPlayer.tsx    # Video player komponent
│   ├── data/                  # Statisk data
│   │   ├── banks.ts          # Bankinformation
│   │   └── packages.ts       # Paketinformation
│   └── types/                 # TypeScript type definitions
│       └── index.ts
├── public/                    # Statiska filer (lägg videos här)
├── tailwind.config.ts        # Tailwind konfiguration
├── tsconfig.json             # TypeScript konfiguration
└── package.json              # Projektberoenden
\`\`\`

## Nästa Steg (Backend Integration)

För att göra hemsidan fullt fungerande behöver du:

### 1. Video-filer
Lägg till instruktionsvideor i `public/videos/`:
- \`swedbank-download.mp4\`
- \`seb-download.mp4\`
- \`nordea-download.mp4\`
- \`handelsbanken-download.mp4\`
- \`swedbank-delegation.mp4\`
- \`seb-delegation.mp4\`
- \`nordea-delegation.mp4\`
- \`handelsbanken-delegation.mp4\`

### 2. Backend API
Implementera backend för:
- Filuppladdning och lagring
- E-postutskick (bekräftelser, färdiga NE-bilagor)
- Kontaktformulär
- Databas för att spara beställningar

### 3. Betalningsintegration
Integrera betalningslösning (t.ex. Stripe, Klarna)

### 4. Användarkonton (valfritt)
- Inloggningssystem
- Dashboard för att se tidigare beställningar

## Design

Hemsidan använder en pålitlig och professionell design:
- **Färgschema:** Blå (primary) och grå (trust) toner för att signalera pålitlighet
- **Typografi:** System fonts för snabb laddning och läsbarhet
- **Responsiv:** Fungerar på desktop, tablet och mobil
- **Tillgänglighet:** Semantisk HTML och ARIA-labels

## Anpassning

### Ändra priser
Redigera `src/data/packages.ts`

### Lägg till/ta bort banker
Redigera `src/data/banks.ts`

### Ändra färger
Redigera `tailwind.config.ts` under `theme.extend.colors`

### Ändra företagsinformation
- Navigation: `src/components/Navigation.tsx`
- Footer: `src/components/Footer.tsx`
- Om oss: `src/app/om-oss/page.tsx`
- Kontakt: `src/app/kontakt/page.tsx`

## Licens

Privat projekt - Alla rättigheter förbehållna
