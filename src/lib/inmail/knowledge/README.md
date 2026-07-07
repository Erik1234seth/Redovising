# Kunskapsmapp för mail-AI:n

Lägg dokument här som mail-AI:n ska kunna svara utifrån. Det finns **två sorters**
filer med olika beteende:

## 1. Små `.md` / `.txt` — skickas ALLTID med

Korta fakta (priser, rutiner, FAQ, villkor). Allt innehåll i dessa filer läggs in
som kontext i **varje** mailsvar. Håll dem korta — allt kostar tokens per mail.

- Skapa en `.md`/`.txt`-fil här. Filnamnet blir rubrik, t.ex. `moms-faq.md`.
- Frivillig frontmatter `--- title: ... ---` styr rubriken.
- Starta om dev-servern (eller deploya) — innehållet cachas vid start.

## 2. Stora `.pdf` — indexeras och SÖKS (RAG)

Stora referensdokument (t.ex. hela K1-vägledningen på 82 sidor) skickas inte med
i sin helhet — det vore alldeles för dyrt. Istället indexeras de i Supabase, och
för varje mail hämtas bara de relevanta styckena.

- Släpp `.pdf`-filen här.
- Kör **`npm run index-knowledge`** för att indexera (måste köras om varje gång
  du lägger till/ändrar en PDF).
- Klart — mail-AI:n söker sedan automatiskt i dokumentet vid kundfrågor.

## Frivilligt: snyggare rubrik

Lägg frontmatter överst för att styra rubriken:

```md
---
title: Vanliga frågor om moms
---

Här kommer själva texten...
```

## Bra att veta

- `README.md` läses **inte** in (bara `.md`/`.txt` med faktiskt innehåll).
- Håll det kort och kärnfullt — allt kostar tokens i varje mail.
- Blir det väldigt mycket text bör vi bygga sökning (RAG) istället; säg till.
