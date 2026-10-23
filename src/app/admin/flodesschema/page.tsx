'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { FlodesKund, FlodesUnderlag } from '@/lib/admin-types';
import { regelNamn } from '@/lib/transaktioner/kundregler';

/**
 * Flödesschemat: hela processen från att kunden skickar underlag till
 * inlämningskvittot, ritat i simbanor (Kund / System / Manuellt) och faser.
 *
 * Bygger på BPMN-skissen EnklaBokslut20261017.pdf. Än så länge bara för att
 * visualisera — `finns` beskriver vad i systemet som redan gör steget, så att
 * varje steg kan kopplas till riktig funktion senare.
 *
 * Hela schemat syns från början. Scrolla för att zooma kring muspekaren och
 * dra för att flytta. Slingorna tillbaka till "Ta emot underlag" ritas som
 * hopp (A) i stället för långa pilar tvärs över schemat.
 */

type Typ = 'ai' | 'system' | 'mejl-in' | 'mejl-ut' | 'regel' | 'manuell' | 'kund' | 'start' | 'slut' | 'val' | 'hopp' | 'vanta';

interface Steg {
  id: string;
  namn: string;
  typ: Typ;
  rad: number;
  kol: number;
  /** Lodrät förskjutning inom raden */
  dy?: number;
  /** För hopp ut: vilket hopp in det fortsätter vid */
  hopp?: string;
  /** Texten bredvid ett hopp ut, om det inte går till Ta emot */
  etikett?: string;
  /** Namnet ovanför i stället för till höger, när en pil kommer in från höger */
  textOvan?: boolean;
  beskrivning?: string;
  finns?: string;
  /** Färdigbyggt. Går att ändra på sidan — det sparade går före. */
  klar?: boolean;
  /** Sparad status från sidan. */
  status?: Status;
}

type Status = 'klar' | 'delvis' | 'inte';
const STATUS: Record<Status, { namn: string; klass: string }> = {
  klar: { namn: 'Klar', klass: 'text-emerald-700' },
  delvis: { namn: 'Finns delvis', klass: 'text-amber-700' },
  inte: { namn: 'Inte byggt', klass: 'text-slate-400' },
};
/** Sparad status först, annars det koden säger: klar, något finns, eller inget. */
const stegStatus = (s: Steg): Status => s.status ?? (s.klar ? 'klar' : s.finns ? 'delvis' : 'inte');

interface Pil {
  fran: string;
  till: string;
  text?: string;
  /** vh: först lodrätt, sedan vågrätt. hv: först vågrätt, sedan lodrätt. */
  form?: 'vh' | 'hv';
  /** Streckad — ett mejl mellan oss och kunden */
  mejl?: boolean;
}

// Rad 0 = kund, 1–2 = bank, 3–6 = system (5 är huvudspåret), 7 = manuellt
const RADER = [124, 66, 84, 78, 78, 92, 78, 96];
const BANOR = [
  { namn: 'Kund', fran: 0, till: 0, farg: '#fff5f5' },
  { namn: 'Bank', fran: 1, till: 2, farg: '#f0fdf4' },
  { namn: 'System', fran: 3, till: 6, farg: '#f8fafc' },
  { namn: 'Manuellt', fran: 7, till: 7, farg: '#fffbeb' },
];
const FASER = [
  { namn: '1 · Ta emot & sortera', fran: 0, till: 3 },
  { namn: '2 · Löpande bokföring', fran: 4, till: 11 },
  { namn: '3 · Moms', fran: 12, till: 12 },
  { namn: '4 · Årsbokslut', fran: 13, till: 15 },
  { namn: '5 · Kontroll & inlämning', fran: 16, till: 18 },
];

const STEG: Steg[] = [
  { id: 'hopp-in', namn: 'A', typ: 'hopp', rad: 5, kol: 0, beskrivning: 'Här kommer allt tillbaka när kunden svarar med mer underlag.' },
  { id: 'kund-skickar', namn: 'Skickar underlag', typ: 'start', rad: 0, kol: 1, beskrivning: 'Kunden mejlar eller laddar upp kvitton, fakturor, kontoutdrag eller annat underlag.', finns: 'Mejl till oss och uppladdning på kundsidan' },
  { id: 'manuell-skickar', namn: 'Skicka in/hämta underlag', typ: 'start', rad: 7, kol: 1, beskrivning: 'Vi lägger själva in underlag eller hämtar det från kunden.', finns: 'Uppladdning i adminpanelen' },
  { id: 'ta-emot', klar: true, namn: 'Ta emot underlag', typ: 'mejl-in', rad: 5, kol: 1, beskrivning: 'Allt som kommer in samlas på kunden, oavsett kanal.', finns: 'Inkorgen och underlagslistan på personkortet' },
  { id: 'definiera', klar: true, namn: 'Definiera underlaget', typ: 'ai', rad: 5, kol: 2, beskrivning: 'AI:n läser underlaget och avgör vad det är, vilket år det hör till och om det gäller transaktioner, verifikationer eller övrigt. Året styr inte vägen — det hanteras i huvudboken.', finns: 'Körs automatiskt när underlaget kommer in. Går att köra om när man följer ett underlag här.' },
  { id: 'val-typ', namn: 'Vilken sort?', typ: 'val', rad: 5, kol: 3 },
  { id: 'separat-mapp', namn: 'Spara i separat mapp', typ: 'slut', rad: 6, kol: 3, beskrivning: 'Underlag som inte tillhör räkenskapsåret, eller inte är bokföringsunderlag, sparas undan utan att bokföras.', finns: 'Fliken Övriga filer' },

  { id: 'plocka-verif', klar: true, namn: 'Plocka ut verifikationer', typ: 'ai', rad: 3, kol: 4, beskrivning: 'Redan konterad historik läses in som verifikationer med sina konton. SIE-filer tolkas med kod. Verifikationslistor, grundböcker och huvudböcker som PDF, Excel, CSV eller TSV läses av AI:n, som kör kod mot filen i stället för att skriva av den. Bara verifikationer som går jämnt ut läggs in, och de som redan finns hos kunden (samma serie, nummer och datum) läggs inte in igen.', finns: 'SIE läses in av sig själv när filen kommer in. Allt annat körs när man följer ett underlag här, eller med Läs av med AI på personkortet.' },
  { id: 'integration', namn: 'Integration', typ: 'start', rad: 4, kol: 4, beskrivning: 'Ordrar och utbetalningar som hämtas direkt från kassasystem och webbshop, utan något underlag att läsa av. Banken har en egen bana.', finns: 'Zettle, Shopify, WooCommerce' },
  { id: 'plocka-trans', klar: true, namn: 'Plocka ut transaktioner', typ: 'ai', rad: 5, kol: 4, beskrivning: 'AI:n plockar ut varje transaktion: datum, belopp, motpart, moms, VAT-nummer och beskrivning — och allt annat som kan vara relevant, som fakturanummer, momsrader per sats, betalsätt och kvittots artiklar. Dessutom en ordagrann avskrift av allt som står.', finns: 'Körs av sig själv när ett underlag kommer med mejl. Går att köra (om) när man följer ett underlag här.' },
  { id: 'komplettera', klar: true, namn: 'Komplettera med kundhistorik', typ: 'ai', rad: 5, kol: 5, beskrivning: 'Varje transaktion kompletteras med hur kunden bokfört liknande saker tidigare, hur andra kunder bokfört liknande, kundens verksamhetsbeskrivning och det mejlen säger om just den. Koden letar fram liknande verifikationer, AI:n väljer ut de som verkligen liknar och läser mejlen. Allt följer med till konteringen.', finns: 'Kundens verifikationer (SIE och bokförda), andra kunders verifikationer, Kundkontext och mejlarkivet. Körs när man följer ett underlag här.' },
  { id: 'val-dublett', klar: true, namn: 'Dublettcheck', typ: 'val', rad: 5, kol: 6, beskrivning: 'Finns samma affär redan i ett tidigare underlag hos kunden? Samma kvitto inskickat två gånger, eller samma köp på olika papper (order och kvitto, faktura och betalkvitto). Koden letar fram transaktioner med riktning, belopp och datum i närheten, och AI:n jämför beskrivning, motpart, datum, belopp och nummer. Säkra dubbletter går till Radera, tveksamma flaggas och stoppas i konteringen.', finns: 'Underlagens transaktioner mot kundens tidigare underlag. Bankrader har en egen koll mot kvitton.' },
  { id: 'radera', namn: 'Radera', typ: 'slut', rad: 4, kol: 6, beskrivning: 'Dubbletter bokförs inte. De markeras i stället för att raderas, så att det går att ångra.', finns: 'Säkra dubbletter från dublettkollen, och bankrader som troligen redan bokförts' },
  { id: 'val-tillrackligt', klar: true, namn: 'Tillräckligt?', typ: 'val', rad: 5, kol: 7, beskrivning: 'AI:n avgör om det vi samlat — underlaget, kompletteringen med historik och mejl, och kundkontexten — räcker för att bokföra varje transaktion: datum, belopp, moms och vad den gäller. Pekar transaktionen på något som kräver mer ska det också finnas, t.ex. köparens VAT-nummer vid försäljning inom EU, omvänd byggmoms, deltagare vid representation eller personnummer vid ROT/RUT. Rimliga antaganden görs hellre än onödiga frågor.', finns: 'Kontrollen per transaktion. Körs när man följer ett underlag här. Mejlflödet har en egen kontroll per fil.' },
  { id: 'skriv-mejl', klar: true, namn: 'Skriv mail', typ: 'ai', rad: 4, kol: 7, beskrivning: 'Saknas något skriver AI:n till kunden och frågar efter just det. Frågorna samlas per kund: kl 18 varje dag skrivs ett mejl per kund om alla transaktioner vi har frågor om och inte frågat om än. Mejlet blir ett utkast i inkorgen — svar i tråden om allt kom i samma mejl, annars ett nytt mejl.', finns: 'Dygnsmejlet kl 18 (Apps Script: fragemejl.gs), eller direkt härifrån när man följer ett underlag. Underlagskontrollen i mejlflödet frågar tills underlaget är komplett.' },
  { id: 'kund-svarar-1', namn: 'Svara mail', typ: 'kund', rad: 0, kol: 7, beskrivning: 'Kunden svarar med det som saknades.' },
  { id: 'hopp-ut-1', namn: 'A', typ: 'hopp', rad: 0, kol: 8, hopp: 'hopp-in', beskrivning: 'Svaret tas emot som nytt underlag.' },

  // Bankkopplingen: bankrader sparas och väntar på ett underlag att matchas mot
  { id: 'bank-in', namn: 'Banktransaktion', typ: 'start', rad: 2, kol: 2, textOvan: true, beskrivning: 'En transaktion kommer in från kundens bank via bankkopplingen.', finns: 'Bankkoppling (Enable Banking)' },
  { id: 'bank-spara', klar: true, namn: 'Spara banktransaktion', typ: 'system', rad: 2, kol: 3, beskrivning: 'Bankraden sparas så att den kan matchas mot ett underlag som kommer in senare.', finns: 'Bankrader sparas som transaktioner' },
  { id: 'val-bank-match', namn: 'Matchar underlag?', typ: 'val', rad: 2, kol: 4, beskrivning: 'Finns ett underlag hos kunden som är samma köp — samma belopp, datum och motpart?' },
  { id: 'bank-matchad', namn: 'Kopplad till underlaget', typ: 'slut', rad: 1, kol: 5, textOvan: true, beskrivning: 'Bankraden och underlaget är samma köp och bokförs en gång, via underlaget.', finns: 'Bankrader markeras som troliga dubbletter av ett underlag' },
  { id: 'bank-vanta', namn: 'Vänta till momsperiodens slut', typ: 'vanta', rad: 2, kol: 5, beskrivning: 'Omatchade bankrader samlas. Kunder med månadsmoms: varje månad. Alla andra: varje kvartal.' },
  { id: 'val-bank-match-2', namn: 'Matchad nu?', typ: 'val', rad: 2, kol: 6, beskrivning: 'Har ett underlag kommit in under perioden som matchar bankraden?' },
  { id: 'bank-skriv-mejl', namn: 'Mail: underlag saknas', typ: 'ai', rad: 2, kol: 9, beskrivning: 'AI:n skriver ihop ett mejl med alla bankrader i perioden som saknar underlag och ber kunden skicka in dem.' },
  { id: 'kund-svarar-bank', namn: 'Skickar underlag', typ: 'kund', rad: 0, kol: 9, beskrivning: 'Kunden skickar in underlag till bankraderna.' },
  { id: 'hopp-ut-3', namn: 'A', typ: 'hopp', rad: 0, kol: 10, hopp: 'hopp-in', beskrivning: 'Underlaget tas emot och matchas mot bankraden.' },
  { id: 'val-bank-svar', namn: 'Svar före momsdeadline?', typ: 'val', rad: 2, kol: 10, beskrivning: 'Har kunden skickat underlaget innan perioden ska lämnas in?' },
  { id: 'bank-vantar-underlag', namn: 'Matchas när underlaget kommer', typ: 'slut', rad: 1, kol: 10 },
  { id: 'bank-till-bokslut', namn: 'Spara till årsbokslutet', typ: 'system', rad: 2, kol: 11, beskrivning: 'Bankrader utan underlag vid momsdeadline sparas och tas upp igen inför årsbokslutet.' },
  { id: 'hopp-ut-b', namn: 'B', typ: 'hopp', rad: 2, kol: 12, hopp: 'hopp-in-b', etikett: 'till Inför årsbokslut', beskrivning: 'Fortsätter vid Inför årsbokslut.' },
  { id: 'hopp-in-b', namn: 'B', typ: 'hopp', rad: 6, kol: 13, beskrivning: 'Bankrader utan underlag kommer in i bokslutet här.' },
  { id: 'konteras', klar: true, namn: 'Konteras', typ: 'ai', rad: 5, kol: 8, beskrivning: 'Två AI-modeller (GPT-5.5 och Claude Opus) konterar var för sig enligt K1, i två pass: först väljs konto, sedan prövas det mot kontots regler. Grönt när båda är säkra och överens om konto och moms. Kontot väljs bara ur byråns egen K1-dokumentation — kundhistoriken är en ledtråd om vad affären är, inte om kontot. Modellerna väljer också vilka kundspecifika regler som gäller transaktionen, t.ex. periodisk sammanställning vid försäljning till företag i andra EU-länder (3108/3308), och följer dem — transaktionen styr, inte kryssrutorna på kunden. Dubbletter och transaktioner som saknar uppgifter konteras inte.', finns: 'Fliken Kontering i personvyn. Reglerna finns i src/lib/transaktioner/kundregler.ts. Körs när man följer ett underlag här, utan att bokföra — det är nästa steg.' },
  { id: 'val-resultat', namn: 'Grönt?', typ: 'val', rad: 5, kol: 9 },
  { id: 'granska', namn: 'Granska', typ: 'manuell', rad: 7, kol: 9, beskrivning: 'Det AI:n inte är överens om eller osäker på granskar vi själva.', finns: 'Rätta kontering i fliken Kontering' },
  { id: 'skapa-verif', klar: true, namn: 'Skapa verifikationer / lägg in i databas', typ: 'system', rad: 5, kol: 10, beskrivning: 'Varje godkänd transaktion blir en verifikation i databasen: kostnads- eller intäktskontot, momsen och betalkontot (1930 företagskonto, 2013/2017 privat) enligt Kundkontext. Gröna bokförs med kontot båda modellerna valt, signerade AI. Granskade bokförs på kontot man väljer, signerade Erik.', finns: 'Verifikationer i serie AI, kopplade till transaktionen och underlaget. Bokförs när man följer ett underlag här eller i fliken Kontering.' },
  { id: 'huvudbok', klar: true, namn: 'Uppdatera verifikationslista / huvudbok', typ: 'system', rad: 5, kol: 11, beskrivning: 'Verifikationerna hamnar i huvudboken på det räkenskapsår deras datum hör till — ett underlag från förra året läggs in på förra året av sig självt.', finns: 'Fliken Huvudbok i personvyn: per konto med ingående balans, rader och utgående balans, per räkenskapsår. Går att ladda ner som Excel.' },

  { id: 'bb-rr', klar: true, namn: 'Uppdatera BB, RR, momsrapport', typ: 'system', rad: 5, kol: 12, beskrivning: 'Balansräkning, resultaträkning och momsrapport räknas ur huvudboken varje gång de öppnas, så en ny verifikation syns direkt. Per räkenskapsår, kvartal eller månad. Resultaträkningen visar perioden och året hittills, balansräkningen ingående balans, förändring och utgående balans, och kontrollerar att den går ihop. Momsrapporten räknas som momsfilen.', finns: 'Fliken Rapporter i personvyn. Går att ladda ner som Excel.' },
  { id: 'momsfil', namn: 'Skapa momsfil / periodisk sammanställning', typ: 'system', rad: 6, kol: 12, finns: 'Momsfil (eSKD)' },
  { id: 'lamna-moms', namn: 'Lämna in moms', typ: 'manuell', rad: 7, kol: 12, finns: 'Sidan Inlämning' },

  { id: 'infor-bokslut', namn: 'Inför årsbokslut', typ: 'regel', rad: 5, kol: 13, beskrivning: 'När året är slut och bokföringen är ikapp startar bokslutet.', finns: 'Fliken Bokslut (checklista)' },
  { id: 'mejl-bekrafta', namn: 'Mail: bekräfta underlag, inventarier, periodisering', typ: 'mejl-ut', rad: 4, kol: 13, beskrivning: 'Kunden får bekräfta att allt är med och svara på frågor om inventarier och periodiseringar.' },
  { id: 'kund-svarar-2', namn: 'Svara mail', typ: 'kund', rad: 0, kol: 13 },
  { id: 'val-svar', namn: 'Kundens svar', typ: 'val', rad: 0, kol: 14 },
  { id: 'hopp-ut-2', namn: 'A', typ: 'hopp', rad: 0, kol: 14, dy: -52, hopp: 'hopp-in', beskrivning: 'Kunden skickar fler transaktioner, som tas emot som nytt underlag.' },
  { id: 'justeringar', namn: 'Bokslutsjusteringar', typ: 'ai', rad: 3, kol: 15, beskrivning: 'AI:n bokar periodiseringar, avskrivningar och andra justeringar utifrån kundens svar.' },
  { id: 'sammanstall', namn: 'Sammanställ bokslut inkl. NE, moms', typ: 'system', rad: 5, kol: 15, finns: 'NE (SRU) och årsbokslut-PDF' },

  { id: 'rimlighet-ai', namn: 'Rimlighetskontroll', typ: 'ai', rad: 5, kol: 16, beskrivning: 'AI:n jämför mot tidigare år och letar efter konstiga belopp innan vi tittar.' },
  { id: 'rimlighet-manuell', namn: 'Rimlighetskontroll', typ: 'manuell', rad: 7, kol: 16, beskrivning: 'Vi går själva igenom bokslutet en sista gång.' },
  { id: 'lamna-in', namn: 'Lämna in', typ: 'manuell', rad: 7, kol: 17, finns: 'Sidan Inlämning' },
  { id: 'kvitto', namn: 'Mail med inlämningskvitto', typ: 'mejl-ut', rad: 5, kol: 17 },
  { id: 'klart', namn: 'Klart', typ: 'slut', rad: 5, kol: 18 },
];

const PILAR: Pil[] = [
  { fran: 'kund-skickar', till: 'ta-emot' },
  { fran: 'manuell-skickar', till: 'ta-emot' },
  { fran: 'hopp-in', till: 'ta-emot' },
  { fran: 'ta-emot', till: 'definiera' },
  { fran: 'definiera', till: 'val-typ' },
  { fran: 'val-typ', till: 'plocka-trans', text: 'Transaktioner' },
  { fran: 'val-typ', till: 'plocka-verif', text: 'Konterad historik' },
  { fran: 'val-typ', till: 'separat-mapp', text: 'Övrigt' },

  { fran: 'integration', till: 'plocka-trans' },
  { fran: 'plocka-trans', till: 'komplettera' },
  { fran: 'komplettera', till: 'val-dublett' },
  { fran: 'val-dublett', till: 'radera', text: 'Dublett' },
  { fran: 'val-dublett', till: 'val-tillrackligt', text: 'Ej dublett' },
  { fran: 'val-tillrackligt', till: 'skriv-mejl', text: 'Ej tillräckligt' },
  { fran: 'skriv-mejl', till: 'kund-svarar-1', mejl: true },
  { fran: 'kund-svarar-1', till: 'hopp-ut-1' },
  { fran: 'val-tillrackligt', till: 'konteras', text: 'Tillräckligt' },
  { fran: 'konteras', till: 'val-resultat' },
  { fran: 'val-resultat', till: 'skapa-verif', text: 'Grönt' },
  { fran: 'val-resultat', till: 'granska', text: 'Manuell granskning' },
  { fran: 'granska', till: 'skapa-verif', form: 'hv' },
  { fran: 'skapa-verif', till: 'huvudbok' },
  { fran: 'plocka-verif', till: 'huvudbok', form: 'hv' },

  { fran: 'bank-in', till: 'bank-spara' },
  { fran: 'bank-spara', till: 'val-bank-match' },
  { fran: 'val-bank-match', till: 'bank-matchad', text: 'Ja' },
  { fran: 'val-bank-match', till: 'bank-vanta', text: 'Nej' },
  { fran: 'bank-vanta', till: 'val-bank-match-2' },
  { fran: 'val-bank-match-2', till: 'bank-matchad', text: 'Ja' },
  { fran: 'val-bank-match-2', till: 'bank-skriv-mejl', text: 'Nej' },
  { fran: 'bank-skriv-mejl', till: 'kund-svarar-bank', mejl: true },
  { fran: 'kund-svarar-bank', till: 'hopp-ut-3' },
  { fran: 'bank-skriv-mejl', till: 'val-bank-svar' },
  { fran: 'val-bank-svar', till: 'bank-vantar-underlag', text: 'Ja' },
  { fran: 'val-bank-svar', till: 'bank-till-bokslut', text: 'Nej' },
  { fran: 'bank-till-bokslut', till: 'hopp-ut-b' },
  { fran: 'hopp-in-b', till: 'infor-bokslut' },

  { fran: 'huvudbok', till: 'bb-rr' },
  { fran: 'bb-rr', till: 'momsfil' },
  { fran: 'momsfil', till: 'lamna-moms' },
  { fran: 'bb-rr', till: 'infor-bokslut' },

  { fran: 'infor-bokslut', till: 'mejl-bekrafta' },
  { fran: 'mejl-bekrafta', till: 'kund-svarar-2', mejl: true },
  { fran: 'kund-svarar-2', till: 'val-svar' },
  { fran: 'val-svar', till: 'hopp-ut-2', text: 'Fler transaktioner' },
  { fran: 'val-svar', till: 'justeringar', form: 'hv', text: 'Justeringar' },
  { fran: 'val-svar', till: 'sammanstall', text: 'Allt är inne' },
  { fran: 'justeringar', till: 'sammanstall' },

  { fran: 'sammanstall', till: 'rimlighet-ai' },
  { fran: 'rimlighet-ai', till: 'rimlighet-manuell' },
  { fran: 'rimlighet-manuell', till: 'lamna-in' },
  { fran: 'lamna-in', till: 'kvitto' },
  { fran: 'kvitto', till: 'klart' },
];

const TYPER: Record<Typ, { namn: string; fyll: string; kant: string; text: string }> = {
  ai: { namn: 'AI-steg', fyll: '#f5f3ff', kant: '#7c3aed', text: '#4c1d95' },
  system: { namn: 'Automatiskt', fyll: '#eff6ff', kant: '#173b57', text: '#173b57' },
  'mejl-in': { namn: 'Tar emot', fyll: '#eff6ff', kant: '#173b57', text: '#173b57' },
  'mejl-ut': { namn: 'Mejl till kund', fyll: '#eff6ff', kant: '#173b57', text: '#173b57' },
  regel: { namn: 'Regel', fyll: '#eff6ff', kant: '#173b57', text: '#173b57' },
  manuell: { namn: 'Manuellt', fyll: '#fffbeb', kant: '#d97706', text: '#78350f' },
  kund: { namn: 'Kunden', fyll: '#fff1f2', kant: '#E95C63', text: '#881337' },
  start: { namn: 'Start', fyll: '#ffffff', kant: '#173b57', text: '#334155' },
  slut: { namn: 'Slut', fyll: '#ffffff', kant: '#173b57', text: '#334155' },
  val: { namn: 'Val', fyll: '#ffffff', kant: '#64748b', text: '#334155' },
  hopp: { namn: 'Hopp', fyll: '#ffffff', kant: '#E95C63', text: '#E95C63' },
  vanta: { namn: 'Väntar', fyll: '#f0fdf4', kant: '#15803d', text: '#14532d' },
};

const VANSTER = 34;
// Första kolumnen har bara ett hopp och sista bara slutet, de är smalare
const KOL_B = Array.from({ length: 19 }, (_, k) => (k === 0 ? 56 : k === 18 ? 76 : 122));
const KOL_X = KOL_B.reduce<number[]>((acc, b, i) => [...acc, i === 0 ? VANSTER : acc[i - 1] + KOL_B[i - 1]], []);
const TOPP = 40;
const BREDD = KOL_X[KOL_X.length - 1] + KOL_B[KOL_B.length - 1] + 6;
const RAD_Y = RADER.reduce<number[]>((acc, _h, i) => [...acc, i === 0 ? TOPP : acc[i - 1] + RADER[i - 1]], []);
const HOJD = RAD_Y[RAD_Y.length - 1] + RADER[RADER.length - 1] + 6;
const HELA = { x: 0, y: 0, b: BREDD, h: HOJD };

const storlek = (t: Typ) =>
  t === 'val' ? { b: 40, h: 40 } : t === 'start' || t === 'slut' ? { b: 34, h: 34 } : t === 'hopp' ? { b: 24, h: 24 } : { b: 106, h: 56 };

function plats(s: Steg) {
  const { b, h } = storlek(s.typ);
  const cx = KOL_X[s.kol] + KOL_B[s.kol] / 2;
  const cy = RAD_Y[s.rad] + RADER[s.rad] / 2 + (s.rad === 0 ? 18 : 0) + (s.dy ?? 0);
  return { cx, cy, v: cx - b / 2, h: cx + b / 2, o: cy - h / 2, u: cy + h / 2 };
}
type Plats = ReturnType<typeof plats>;

/** Texten på en lodrät linje står mitt på, men på väg nedåt under valets namn. */
const textY = (y1: number, y2: number) => (y2 > y1 ? Math.max((y1 + y2) / 2 + 3, y1 + 30) : (y1 + y2) / 2 + 3);

/** Vägen för en pil och var dess text ska stå. */
function vag(p: Pil, a: Plats, b: Plats) {
  if (Math.abs(a.cy - b.cy) < 1) {
    const [x1, x2] = b.cx > a.cx ? [a.h, b.v] : [a.v, b.h];
    return { d: `M${x1},${a.cy} H${x2}`, tx: (x1 + x2) / 2, ty: a.cy - 6, mitt: true };
  }
  if (Math.abs(a.cx - b.cx) < 1) {
    const upp = b.cy < a.cy;
    const y1 = upp ? a.o : a.u;
    const y2 = upp ? b.u : b.o;
    return { d: `M${a.cx},${y1} V${y2}`, tx: a.cx + 6, ty: textY(y1, y2), mitt: false };
  }
  if (p.form === 'hv') {
    const y2 = b.cy > a.cy ? b.o : b.u;
    return { d: `M${a.h},${a.cy} H${b.cx} V${y2}`, tx: (a.h + b.cx) / 2, ty: a.cy - 6, mitt: true };
  }
  const y1 = b.cy < a.cy ? a.o : a.u;
  // Målet kan ligga till vänster, då går pilen in från höger
  return { d: `M${a.cx},${y1} V${b.cy} H${b.cx > a.cx ? b.v : b.h}`, tx: a.cx + 6, ty: textY(y1, b.cy), mitt: false };
}

/** Delar namnet på rader om högst ~15 tecken. */
function rader(namn: string, max = 15) {
  const ut: string[] = [];
  for (const ord of namn.split(' ')) {
    const sista = ut[ut.length - 1];
    if (sista && (sista + ' ' + ord).length <= max) ut[ut.length - 1] = sista + ' ' + ord;
    else ut.push(ord);
  }
  return ut;
}

function Ikon({ typ, x, y }: { typ: Typ; x: number; y: number }) {
  const f = TYPER[typ].kant;
  if (typ === 'ai') {
    return (
      <g transform={`translate(${x},${y})`} fill={f}>
        <circle cx="6" cy="4" r="3" />
        <path d="M0,13 C0,8 12,8 12,13 Z" />
      </g>
    );
  }
  if (typ === 'system') {
    return (
      <g transform={`translate(${x + 6},${y + 6})`} stroke={f} fill="none" strokeWidth="1.6">
        <circle r="3" />
        {[0, 45, 90, 135].map((v) => <line key={v} x1="0" y1="-6" x2="0" y2="6" transform={`rotate(${v})`} />)}
      </g>
    );
  }
  if (typ === 'mejl-in' || typ === 'mejl-ut' || typ === 'kund') {
    return (
      <g transform={`translate(${x},${y + 1})`}>
        <rect width="13" height="9" rx="1" fill={typ === 'mejl-ut' ? f : 'none'} stroke={f} strokeWidth="1.3" />
        <path d="M0,0 L6.5,5 L13,0" fill="none" stroke={typ === 'mejl-ut' ? '#fff' : f} strokeWidth="1.3" />
      </g>
    );
  }
  if (typ === 'vanta') {
    return (
      <g transform={`translate(${x + 6},${y + 6})`} stroke={f} fill="none" strokeWidth="1.4" strokeLinecap="round">
        <circle r="6" />
        <path d="M0,-3.5 V0 L2.5,2" />
      </g>
    );
  }
  if (typ === 'regel') {
    return (
      <g transform={`translate(${x},${y})`} stroke={f} fill="none" strokeWidth="1.2">
        <rect width="13" height="11" />
        <line x1="0" y1="4" x2="13" y2="4" />
        <line x1="4" y1="4" x2="4" y2="11" />
      </g>
    );
  }
  if (typ === 'manuell') {
    return (
      <g transform={`translate(${x},${y})`} stroke={f} fill="none" strokeWidth="1.4" strokeLinecap="round">
        <path d="M2,12 V6 M5,12 V2 M8,12 V3 M11,12 V5 M2,12 H11" />
      </g>
    );
  }
  return null;
}

type Vy = typeof HELA;
type Texter = { beskrivning: string; finns: string; status: Status | null };

/** klar = gjort, har = här står underlaget nu, fel = gick fel, oppen = passerat men steget finns inte eller kördes inte */
type Lage = 'klar' | 'har' | 'fel' | 'oppen';
interface Spar { steg: Record<string, { lage: Lage; text: string }>; pilar: Set<string> }

const LAGE: Record<Lage, { farg: string; tecken: string; namn: string }> = {
  klar: { farg: '#16a34a', tecken: '✓', namn: 'Klart' },
  har: { farg: '#f59e0b', tecken: '•', namn: 'Här nu' },
  fel: { farg: '#dc2626', tecken: '!', namn: 'Fel' },
  oppen: { farg: '#94a3b8', tecken: '–', namn: 'Inte kontrollerat' },
};

const pilNyckel = (fran: string, till: string) => `${fran}>${till}`;
const kort = (d: string) => new Date(d).toLocaleDateString('sv-SE');

/**
 * Var i flödet ett underlag har gått, utifrån det som faktiskt finns sparat.
 *
 * Stegen efter rapporterna gäller hela perioden och inte ett enskilt
 * underlag, så spåret slutar där.
 */
function foljUnderlag(u: FlodesUnderlag): Spar {
  const steg: Spar['steg'] = {};
  const pilar = new Set<string>();
  const satt = (id: string, lage: Lage, text: string) => { steg[id] = { lage, text }; };
  const ga = (fran: string, till: string) => pilar.add(pilNyckel(fran, till));
  // Rapporterna räknas ur huvudboken när de öppnas — är verifikationerna där är de med
  const rapporter = () => {
    ga('huvudbok', 'bb-rr');
    satt('bb-rr', 'klar', 'Med i balans- och resultaträkningen och momsrapporten');
  };

  const start = u.source === 'admin' ? 'manuell-skickar' : 'kund-skickar';
  satt(start, 'klar', u.source === 'mejl' ? 'Kom som bilaga i ett mejl' : u.source === 'app' ? 'Uppladdat i appen' : 'Uppladdat av oss');
  ga(start, 'ta-emot');
  satt('ta-emot', 'klar', `Mottaget ${kort(u.at)}`);
  ga('ta-emot', 'definiera');

  const d = u.definition;
  if (d) {
    satt('definiera', 'klar', `${d.dokumenttyp}${d.ar ? `, ${d.ar}` : ', år framgår inte'}${d.beskrivning ? ` — ${d.beskrivning}` : ''}`);
  } else if (u.definitionFel) {
    satt('definiera', 'fel', u.definitionFel);
    return { steg, pilar };
  } else if (u.sortering) {
    // Sorterat innan definieringen fanns, av avläsningen eller för hand
    satt('definiera', 'oppen', `Inte definierat av AI:n, men sorterat som ${u.sortering === 'ovrigt' ? 'övrig fil' : 'underlag'}`);
  } else {
    satt('definiera', 'har', 'Inte definierat än');
    return { steg, pilar };
  }
  ga('definiera', 'val-typ');

  const kategori = vagFor(u);

  if (kategori === 'ovrigt') {
    satt('val-typ', 'klar', 'Övrigt');
    ga('val-typ', 'separat-mapp');
    satt('separat-mapp', u.sortering === 'ovrigt' ? 'klar' : 'har', u.sortering === 'ovrigt' ? 'Ligger under Övriga filer' : 'Ska flyttas till Övriga filer');
    return { steg, pilar };
  }

  if (kategori === 'verifikationer') {
    satt('val-typ', 'klar', 'Redan konterad historik');
    ga('val-typ', 'plocka-verif');
    if (!u.sie && u.utlasning?.fel) { satt('plocka-verif', 'fel', u.utlasning.fel); return { steg, pilar }; }
    if (!u.sie) { satt('plocka-verif', 'har', 'Verifikationerna har inte lästs in än'); return { steg, pilar }; }
    if (u.sie.fel) { satt('plocka-verif', 'fel', u.sie.fel); return { steg, pilar }; }
    satt('plocka-verif', 'klar', `${u.sie.antal} verifikationer inlagda${u.sie.dubbletter ? `, ${u.sie.dubbletter} fanns redan hos kunden` : ''}`);
    ga('plocka-verif', 'huvudbok');
    satt('huvudbok', 'klar', `${u.verifikationer} verifikationer i huvudboken`);
    rapporter();
    return { steg, pilar };
  }

  satt('val-typ', 'klar', 'Transaktioner');
  ga('val-typ', 'plocka-trans');
  if (!u.utlasning) { satt('plocka-trans', 'har', 'AI-avläsningen har inte körts'); return { steg, pilar }; }
  if (u.utlasning.fel) { satt('plocka-trans', 'fel', u.utlasning.fel); return { steg, pilar }; }
  satt('plocka-trans', 'klar', `${u.utlasning.antal} transaktioner utlästa ${kort(u.utlasning.at)}`);
  ga('plocka-trans', 'komplettera');
  const harKonterats = u.transaktioner.some((t) => t.kontering !== 'ingen');
  if (u.komplettering?.fel) {
    satt('komplettera', 'fel', u.komplettering.fel);
    if (!harKonterats) return { steg, pilar };
  } else if (!u.komplettering) {
    // Äldre underlag konterades innan steget fanns — då fortsätter spåret
    if (!harKonterats) { satt('komplettera', 'har', 'Inte kompletterat än'); return { steg, pilar }; }
    satt('komplettera', 'oppen', 'Konterades utan komplettering');
  } else {
    const medHistorik = u.transaktioner.filter((t) => t.komplettering && (t.komplettering.kundensHistorik.length || t.komplettering.andraKunder.length)).length;
    const medMejl = u.transaktioner.filter((t) => t.komplettering?.mejl).length;
    satt('komplettera', 'klar', `${medHistorik} av ${u.transaktioner.length} med historik, ${medMejl} med mejl ${kort(u.komplettering.at)}`);
  }
  ga('komplettera', 'val-dublett');
  const dubletter = u.transaktioner.filter((t) => t.dublettkoll?.status === 'dublett').length;
  const tveksamma = u.transaktioner.filter((t) => t.dublettkoll?.status === 'tveksam').length;
  if (u.dublettkoll?.fel) {
    satt('val-dublett', 'fel', u.dublettkoll.fel);
    if (!harKonterats) return { steg, pilar };
  } else if (!u.dublettkoll) {
    if (!harKonterats) { satt('val-dublett', 'har', 'Inte kollat än'); return { steg, pilar }; }
    satt('val-dublett', 'oppen', 'Konterades utan dublettkoll');
  } else {
    const delar = [`${dubletter} dubletter`, `${tveksamma} tveksamma`, `${u.transaktioner.length - dubletter - tveksamma} unika`];
    satt('val-dublett', tveksamma ? 'oppen' : 'klar', `${delar.join(', ')} ${kort(u.dublettkoll.at)}`);
    if (dubletter) {
      ga('val-dublett', 'radera');
      satt('radera', 'klar', `${dubletter} ${dubletter === 1 ? 'transaktion markerad' : 'transaktioner markerade'} som dubblett och bokförs inte`);
    }
    // Är allt dubletter tar vägen slut här
    if (dubletter === u.transaktioner.length) return { steg, pilar };
  }
  ga('val-dublett', 'val-tillrackligt');

  const T = u.transaktioner;
  const konterade = T.filter((t) => t.kontering !== 'ingen');

  const saknar = T.filter((t) => t.tillrackligt?.status === 'saknar');
  if (u.tillrackligt?.fel) {
    satt('val-tillrackligt', 'fel', u.tillrackligt.fel);
    if (konterade.length === 0) return { steg, pilar };
  } else if (u.tillrackligt && saknar.length) {
    const vad = [...new Set(saknar.flatMap((t) => t.tillrackligt!.saknas.map((s) => s.vad)))].join(', ');
    satt('val-tillrackligt', 'klar', `Ej tillräckligt: ${saknar.length} av ${T.length} saknar ${vad}`);
    ga('val-tillrackligt', 'skriv-mejl');
    const utkast = u.mejl?.status === 'discarded' ? null : u.mejl;
    if (!utkast) satt('skriv-mejl', 'har', 'Frågas i dygnsmejlet kl 18');
    else if (utkast.status === 'sent') {
      satt('skriv-mejl', 'klar', `Skickat till ${utkast.till} ${kort(utkast.skickat ?? utkast.at)}`);
      ga('skriv-mejl', 'kund-svarar-1');
      satt('kund-svarar-1', 'har', 'Väntar på kundens svar');
    } else satt('skriv-mejl', 'har', `Utkast i inkorgen till ${utkast.till} — inte skickat än`);
    if (konterade.length === 0) return { steg, pilar };
  } else if (u.tillrackligt) {
    satt('val-tillrackligt', 'klar', `Tillräckligt — alla ${T.filter((t) => t.tillrackligt).length} har det som behövs ${kort(u.tillrackligt.at)}`);
  } else if (u.kontroll?.status === 'fel') {
    satt('val-tillrackligt', 'fel', 'Underlagskontrollen gick inte att köra');
  } else if (u.kontroll?.status === 'saknar') {
    const vad = u.kontroll.saknas.map((s) => s.vad).filter(Boolean).join(', ');
    satt('val-tillrackligt', 'klar', 'Ej tillräckligt');
    ga('val-tillrackligt', 'skriv-mejl');
    satt('skriv-mejl', 'klar', vad ? `Frågade efter: ${vad}` : 'Kunden har fått frågor');
    ga('skriv-mejl', 'kund-svarar-1');
    // Är inget konterat än står underlaget och väntar på svaret
    if (konterade.length === 0) { satt('kund-svarar-1', 'har', 'Väntar på kundens svar'); return { steg, pilar }; }
    satt('kund-svarar-1', 'klar', 'Kunden har svarat');
  } else if (u.kontroll) {
    satt('val-tillrackligt', 'klar', 'Underlaget är komplett enligt mejlkontrollen');
  } else {
    if (konterade.length === 0) { satt('val-tillrackligt', 'har', 'Inte kontrollerat än'); return { steg, pilar }; }
    satt('val-tillrackligt', 'oppen', 'Konterades utan kontroll');
  }

  ga('val-tillrackligt', 'konteras');
  if (T.length === 0) { satt('konteras', 'fel', 'Avläsningen gav inga transaktioner'); return { steg, pilar }; }
  // Dubbletter och de som saknar uppgifter konteras inte
  const attKontera = T.filter((t) => !t.dublettAv && t.tillrackligt?.status !== 'saknar');
  const konteradeNu = attKontera.filter((t) => t.kontering !== 'ingen' || t.bokford);
  if (attKontera.length === 0) { satt('konteras', 'oppen', 'Inget att kontera — resten väntar på uppgifter'); return { steg, pilar }; }
  if (konteradeNu.length === 0) { satt('konteras', 'har', `Ingen av ${attKontera.length} transaktioner konterad än`); return { steg, pilar }; }
  satt('konteras', konteradeNu.length < attKontera.length ? 'har' : 'klar', `${konteradeNu.length} av ${attKontera.length} konterade av båda modellerna`);
  ga('konteras', 'val-resultat');

  const gron = attKontera.filter((t) => t.kontering === 'gron');
  const granska = attKontera.filter((t) => t.kontering === 'granska');
  satt('val-resultat', 'klar', `${gron.length} gröna, ${granska.length} till granskning`);

  if (granska.length) {
    ga('val-resultat', 'granska');
    const kvar = granska.filter((t) => !t.bokford).length;
    satt('granska', kvar ? 'har' : 'klar', kvar ? `${kvar} väntar på granskning` : 'Alla granskade');
    if (kvar < granska.length) ga('granska', 'skapa-verif');
  }
  if (gron.length) ga('val-resultat', 'skapa-verif');

  const bokforda = T.filter((t) => t.bokford).length;
  if (bokforda === 0) {
    if (gron.length) satt('skapa-verif', 'har', `${gron.length} gröna men inte bokförda än`);
    return { steg, pilar };
  }
  const attBokfora = attKontera.filter((t) => t.kontering !== 'ingen' || t.bokford).length;
  satt('skapa-verif', bokforda < attBokfora ? 'har' : 'klar', `${bokforda} av ${attBokfora} verifikationer skapade`);
  ga('skapa-verif', 'huvudbok');
  // Verifikationen hamnar på det räkenskapsår dess datum hör till
  const ar = [...new Set(T.map((t) => t.verifikation?.datum?.slice(0, 4)).filter(Boolean))].sort();
  satt('huvudbok', 'klar', `${u.verifikationer} verifikationer i huvudboken${ar.length ? ` för ${ar.join(' och ')}` : ''}`);
  rapporter();
  return { steg, pilar };
}

export default function FlodesschemaPage() {
  const [vald, setVald] = useState<string | null>(null);
  const [vy, setVy] = useState<Vy>(HELA);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vy: Vy; ctm: DOMMatrix; flyttad: boolean } | null>(null);

  const platser = useMemo(() => Object.fromEntries(STEG.map((s) => [s.id, plats(s)])), []);
  const [texter, setTexter] = useState<Record<string, Texter>>({});
  const [anteckningar, setAnteckningar] = useState<Anteckning[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/flodesschema').then((r) => r.json()).then((d) => {
      if (d.texter) setTexter(d.texter);
      setAnteckningar(d.anteckningar ?? []);
    }).catch(() => setAnteckningar([]));
  }, []);

  // Sparade texter går före dem i koden. En tom sparad text betyder att den medvetet tömts.
  const steg = useMemo(() => Object.fromEntries(STEG.map((s) => {
    const t = texter[s.id];
    return [s.id, t ? { ...s, beskrivning: t.beskrivning || undefined, finns: t.finns || undefined, status: t.status ?? undefined } : s];
  })), [texter]);

  const spara = async (id: string, nya: Texter) => {
    const svar = await fetch('/api/admin/flodesschema', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...nya }),
    }).then((r) => r.json()).catch(() => ({ error: 'Kunde inte spara' }));
    if (svar.error) throw new Error(svar.error);
    setTexter((t) => ({ ...t, [id]: { beskrivning: nya.beskrivning.trim(), finns: nya.finns.trim(), status: nya.status } }));
  };
  const valt = vald ? steg[vald] : null;

  // Följ ett underlag: kunderna hämtas en gång, underlaget när det väljs
  const [kunder, setKunder] = useState<FlodesKund[] | null>(null);
  const [kundKey, setKundKey] = useState('');
  const [foljer, setFoljer] = useState<FlodesUnderlag | null>(null);
  const [laddar, setLaddar] = useState(false);
  const [sparFel, setSparFel] = useState('');

  useEffect(() => {
    fetch('/api/admin/flodesschema/underlag').then((r) => r.json()).then((d) => setKunder(d.kunder ?? [])).catch(() => setKunder([]));
  }, []);

  const valjUnderlag = (id: string) => {
    setSparFel('');
    if (!id) { setFoljer(null); return; }
    setLaddar(true);
    fetch(`/api/admin/flodesschema/underlag?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setSparFel(d.error) : setFoljer(d.underlag)))
      .catch(() => setSparFel('Kunde inte hämta underlaget'))
      .finally(() => setLaddar(false));
  };

  // Steget som körs på underlaget just nu — ett i taget
  const [kor, setKor] = useState<KorSteg | null>(null);
  // Vad som körs just nu, för knappen: "Konterar (3 kvar)"
  const [korText, setKorText] = useState('');
  const korSteg = async (stegId: KorSteg, val?: { transaktionId: string; konto: string; momssats: number }) => {
    if (!foljer) return;
    const id = foljer.id;
    setKor(stegId);
    setSparFel('');
    /** Ett steg på servern. Null när det gick fel — felet visas då. */
    const ett = async (steg: Exclude<KorSteg, 'alla'>, extra: Record<string, unknown> = {}) => {
      setKorText(STEG.find((s) => s.id === STEG_I_SCHEMAT[steg])?.namn ?? steg);
      const d = await fetch('/api/admin/flodesschema/underlag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, steg, ...extra }),
      }).then((r) => r.json()).catch(() => ({ error: 'Kunde inte nå servern' }));
      if (d.underlag) setFoljer(d.underlag);
      if (d.error) { setSparFel(d.error); return null; }
      return d as { kategori?: string; typ?: string; kvar?: number };
    };
    // Konteringen görs några transaktioner i taget, tills inga är kvar
    const kontera = async () => {
      const fran = new Date().toISOString();
      for (let varv = 0; varv < 100; varv++) {
        const d = await ett('konteras', { fran });
        if (!d) return false;
        if (!d.kvar) return true;
        setKorText(`Konteras — ${d.kvar} kvar`);
      }
      return true;
    };
    try {
      if (stegId === 'konteras') { await kontera(); return; }
      if (stegId !== 'alla') { await ett(stegId, val ? { val } : {}); return; }
      // Från början så långt flödet är byggt. Vägen tar slut för övriga
      // filer, efter inläsningen för verifikationer, och vid fel.
      const def = await ett('definiera');
      if (!def) return;
      if (def.kategori === 'verifikationer') { await ett('plocka-verif'); return; }
      if (def.kategori !== 'transaktioner') return;
      const ut = await ett('plocka-trans');
      if (!ut || ut.typ !== 'transaktioner') return;
      // Det som saknas frågas i dygnsmejlet kl 18; resten konteras ändå
      for (const steg of ['komplettera', 'dublett', 'tillrackligt'] as const) if (!(await ett(steg))) return;
      if (await kontera()) await ett('skapa-verif');
    } finally {
      setKor(null);
      setKorText('');
    }
  };

  const spar = useMemo(() => (foljer ? foljUnderlag(foljer) : null), [foljer]);
  const kund = kunder?.find((k) => k.key === kundKey) ?? null;

  const nara = useMemo(() => {
    if (!vald) return null;
    const ids = new Set([vald]);
    PILAR.forEach((p) => { if (p.fran === vald) ids.add(p.till); if (p.till === vald) ids.add(p.fran); });
    // Ett hopp hör ihop med sin motsvarighet
    STEG.forEach((s) => { if (s.hopp && (s.id === vald || s.hopp === vald)) { ids.add(s.id); ids.add(s.hopp); } });
    return ids;
  }, [vald]);

  const tonad = (id: string) => (spar ? !spar.steg[id] && vald !== id : nara ? !nara.has(id) : false);
  /** Hur en pil ska se ut: följd av underlaget, kopplad till valt steg, eller nedtonad. */
  const pilLage = (p: Pil) => {
    const aktiv = vald !== null && (p.fran === vald || p.till === vald);
    if (spar) return { gangen: spar.pilar.has(pilNyckel(p.fran, p.till)), aktiv: false, tona: !spar.pilar.has(pilNyckel(p.fran, p.till)) };
    return { gangen: false, aktiv, tona: vald !== null && !aktiv };
  };
  const antal = (t: Typ) => STEG.filter((s) => s.typ === t).length;
  const procent = Math.round((BREDD / vy.b) * 100);

  /** Skärmpunkt till punkt i schemat, med den skalning som gällde när `ctm` togs. */
  const iSchemat = (cx: number, cy: number, ctm: DOMMatrix) => new DOMPoint(cx, cy).matrixTransform(ctm.inverse());

  const zooma = useCallback((faktor: number, cx?: number, cy?: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const r = svg.getBoundingClientRect();
    const p = iSchemat(cx ?? r.left + r.width / 2, cy ?? r.top + r.height / 2, ctm);
    setVy((v) => {
      const b = Math.min(HELA.b, Math.max(HELA.b / 6, v.b / faktor));
      const f = v.b / b;
      return { x: p.x - (p.x - v.x) / f, y: p.y - (p.y - v.y) / f, b, h: v.h / f };
    });
  }, []);

  // Hjulet zoomar i stället för att scrolla sidan, så lyssnaren kan inte vara passiv
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const hjul = (e: WheelEvent) => { e.preventDefault(); zooma(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); };
    svg.addEventListener('wheel', hjul, { passive: false });
    return () => svg.removeEventListener('wheel', hjul);
  }, [zooma]);

  const ner = (e: React.PointerEvent) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (ctm) drag.current = { x: e.clientX, y: e.clientY, vy, ctm, flyttad: false };
  };
  const flytta = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.flyttad && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
    if (!d.flyttad) svgRef.current?.setPointerCapture(e.pointerId);
    d.flyttad = true;
    const a = iSchemat(d.x, d.y, d.ctm);
    const b = iSchemat(e.clientX, e.clientY, d.ctm);
    setVy({ ...d.vy, x: d.vy.x - (b.x - a.x), y: d.vy.y - (b.y - a.y) });
  };
  const upp = () => { setTimeout(() => { drag.current = null; }, 0); };
  const harDragit = () => drag.current?.flyttad ?? false;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        <h1 className="text-2xl font-bold text-slate-900">Flödesschema</h1>
        <p className="text-sm text-slate-500 mr-auto">
          {antal('ai')} AI-steg · {antal('system')} automatiska · {antal('manuell')} manuella · {Object.values(steg).filter((s) => !['val', 'start', 'slut', 'hopp'].includes(s.typ) && stegStatus(s) === 'klar').length} klara
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
        <span className="font-medium text-slate-700">Följ ett underlag:</span>
        <select
          value={kundKey}
          onChange={(e) => { setKundKey(e.target.value); setFoljer(null); setSparFel(''); }}
          disabled={!kunder}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 max-w-[260px]"
        >
          <option value="">{kunder ? 'Välj kund…' : 'Hämtar kunder…'}</option>
          {kunder?.map((k) => <option key={k.key} value={k.key}>{k.namn} ({k.underlag.length})</option>)}
        </select>
        {kund && (
          <select
            value={foljer?.id ?? ''}
            onChange={(e) => valjUnderlag(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 max-w-[360px]"
          >
            <option value="">Välj underlag…</option>
            {kund.underlag.map((u) => (
              <option key={u.id} value={u.id}>
                {kort(u.at)} · {u.fileName}{u.sortering === 'ovrigt' ? ' (övrig fil)' : ''}
              </option>
            ))}
          </select>
        )}
        {laddar && <span className="text-slate-400">Hämtar…</span>}
        {sparFel && <span className="text-red-600">{sparFel}</span>}
        {foljer && (
          <button onClick={() => { setFoljer(null); setKundKey(''); }} className="text-slate-500 hover:text-slate-800 underline">
            Sluta följa
          </button>
        )}
      </div>

      <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden h-[calc(100vh-190px)] min-h-[420px]">
        <svg
          ref={svgRef}
          viewBox={`${vy.x} ${vy.y} ${vy.b} ${vy.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full block select-none cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={ner}
          onPointerMove={flytta}
          onPointerUp={upp}
          onPointerCancel={upp}
          onClick={() => { if (!harDragit()) setVald(null); }}
        >
          <defs>
            <marker id="pil" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#64748b" />
            </marker>
            <marker id="pil-vald" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#173b57" />
            </marker>
            <marker id="pil-gangen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#16a34a" />
            </marker>
          </defs>

          {/* Simbanor */}
          {BANOR.map((bana) => {
            const y = RAD_Y[bana.fran];
            const h = RAD_Y[bana.till] + RADER[bana.till] - y;
            return (
              <g key={bana.namn}>
                <rect x={0} y={y} width={BREDD - 6} height={h} fill={bana.farg} stroke="#e2e8f0" />
                <rect x={0} y={y} width={26} height={h} fill="#f1f5f9" stroke="#e2e8f0" />
                <text transform={`translate(17,${y + h / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fontWeight="600" fill="#475569">{bana.namn}</text>
              </g>
            );
          })}

          {/* Faser */}
          {FASER.map((f, i) => {
            const x = KOL_X[f.fran];
            const b = KOL_X[f.till] + KOL_B[f.till] - x;
            return (
              <g key={f.namn}>
                {i % 2 === 1 && <rect x={x} y={TOPP} width={b} height={HOJD - TOPP - 6} fill="#173b57" opacity="0.03" />}
                <rect x={x + 3} y={6} width={b - 6} height={26} rx={6} fill={i % 2 ? '#173b57' : '#e2e8f0'} />
                <text x={x + b / 2} y={23} textAnchor="middle" fontSize="12" fontWeight="600" fill={i % 2 ? '#fff' : '#173b57'}>{f.namn}</text>
                {i > 0 && <line x1={x} y1={TOPP} x2={x} y2={HOJD - 6} stroke="#cbd5e1" strokeDasharray="3 4" />}
              </g>
            );
          })}

          {/* Pilar */}
          {PILAR.map((p, i) => {
            const v = vag(p, platser[p.fran], platser[p.till]);
            const { gangen, aktiv, tona } = pilLage(p);
            return (
              <g key={i} opacity={tona ? (spar ? 0.15 : 0.3) : 1}>
                <path
                  d={v.d}
                  fill="none"
                  stroke={gangen ? '#16a34a' : aktiv ? '#173b57' : '#94a3b8'}
                  strokeWidth={gangen ? 2.6 : aktiv ? 2 : 1.4}
                  strokeDasharray={p.mejl ? '5 4' : undefined}
                  markerEnd={`url(#${gangen ? 'pil-gangen' : aktiv ? 'pil-vald' : 'pil'})`}
                />
              </g>
            );
          })}

          {/* Steg */}
          {STEG.map((s) => {
            const pl = platser[s.id];
            const t = TYPER[s.typ];
            const arVald = vald === s.id;
            const klick = (e: React.MouseEvent) => { e.stopPropagation(); if (!harDragit()) setVald(arVald ? null : s.id); };
            const op = tonad(s.id) ? (spar ? 0.2 : 0.3) : 1;

            if (s.typ === 'hopp') {
              return (
                <g key={s.id} opacity={op} onClick={klick} className="cursor-pointer">
                  <circle cx={pl.cx} cy={pl.cy} r={12} fill="#fff" stroke={t.kant} strokeWidth={arVald ? 3 : 1.8} />
                  <text x={pl.cx} y={pl.cy + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={t.text}>{s.namn}</text>
                  {s.hopp && (
                    <text x={pl.h + 5} y={pl.cy + 3} fontSize="9.5" fill="#64748b" paintOrder="stroke" stroke="#fff" strokeWidth="3">{s.etikett ?? 'till Ta emot'}</text>
                  )}
                </g>
              );
            }
            if (s.typ === 'val') {
              return (
                <g key={s.id} opacity={op} onClick={klick} className="cursor-pointer">
                  <rect x={pl.cx - 14} y={pl.cy - 14} width={28} height={28} transform={`rotate(45 ${pl.cx} ${pl.cy})`} fill="#fff" stroke={arVald ? '#173b57' : t.kant} strokeWidth={arVald ? 2.5 : 1.5} />
                </g>
              );
            }
            if (s.typ === 'start' || s.typ === 'slut') {
              return (
                <g key={s.id} opacity={op} onClick={klick} className="cursor-pointer">
                  <circle cx={pl.cx} cy={pl.cy} r={17} fill="#fff" stroke={arVald ? '#E95C63' : t.kant} strokeWidth={s.typ === 'slut' ? 3.5 : 1.5} />
                  {s.typ === 'start' && <Ikon typ="mejl-in" x={pl.cx - 6.5} y={pl.cy - 5.5} />}
                  {s.textOvan
                    ? <text x={pl.cx} y={pl.o - 6} textAnchor="middle" fontSize="10" fill="#334155" paintOrder="stroke" stroke="#fff" strokeWidth="3">{s.namn}</text>
                    : rader(s.namn, 20).map((r, i) => (
                      <text key={i} x={pl.h + 6} y={pl.cy + 3 + (i - (rader(s.namn, 20).length - 1) / 2) * 12} fontSize="10" fill="#334155" paintOrder="stroke" stroke="#fff" strokeWidth="3">{r}</text>
                    ))}
                </g>
              );
            }

            const r = rader(s.namn);
            return (
              <g key={s.id} opacity={op} onClick={klick} className="cursor-pointer">
                <rect x={pl.v} y={pl.o} width={pl.h - pl.v} height={pl.u - pl.o} rx={9} fill={t.fyll} stroke={arVald ? '#E95C63' : t.kant} strokeWidth={arVald ? 2.5 : s.typ === 'ai' ? 1.8 : 1.2} />
                <Ikon typ={s.typ} x={pl.v + 6} y={pl.o + 5} />
                {s.typ === 'ai' && (
                  <text x={pl.h - 6} y={pl.o + 13} textAnchor="end" fontSize="8.5" fontWeight="700" fill="#7c3aed">AI</text>
                )}
                {r.map((rad, i) => (
                  <text key={i} x={pl.cx} y={pl.cy + 6 + (i - (r.length - 1) / 2) * 12} textAnchor="middle" fontSize="10.5" fill={t.text} fontWeight={500}>
                    {rad}
                  </text>
                ))}
              </g>
            );
          })}

          {/* Texter sist, så att de hamnar ovanpå linjer och rutor */}
          {STEG.filter((s) => s.typ === 'val').map((s) => (
            <text key={s.id} x={platser[s.id].cx} y={platser[s.id].u + 14} textAnchor="middle" fontSize="9.5" fill="#475569" fontStyle="italic" opacity={tonad(s.id) ? 0.3 : 1} paintOrder="stroke" stroke="#fff" strokeWidth="3" pointerEvents="none">
              {s.namn}
            </text>
          ))}
          {PILAR.map((p, i) => {
            if (!p.text) return null;
            const v = vag(p, platser[p.fran], platser[p.till]);
            const { gangen, aktiv, tona } = pilLage(p);
            return (
              <text key={i} x={v.tx} y={v.ty} textAnchor={v.mitt ? 'middle' : 'start'} fontSize="9.5" fill={gangen ? '#15803d' : aktiv ? '#173b57' : '#64748b'} fontWeight={gangen || aktiv ? 600 : 400} opacity={tona ? (spar ? 0.2 : 0.3) : 1} paintOrder="stroke" stroke="#fff" strokeWidth="3" pointerEvents="none">
                {p.text}
              </text>
            );
          })}

          {/* Märken för underlaget som följs: klart, här nu, fel */}
          {spar && Object.entries(spar.steg).map(([id, { lage }]) => {
            const s = steg[id];
            const pl = platser[id];
            const rund = s.typ === 'val' || s.typ === 'start' || s.typ === 'slut' || s.typ === 'hopp';
            // Rutor får märket mitt på överkanten, där varken ikonen eller AI-märket sitter
            const x = rund ? pl.cx + (pl.h - pl.cx) * 0.75 : pl.cx;
            const y = rund ? pl.cy - (pl.cy - pl.o) * 0.75 : pl.o;
            const l = LAGE[lage];
            return (
              <g key={id} pointerEvents="none">
                {lage === 'har' && (
                  <circle cx={x} cy={y} r={8} fill="none" stroke={l.farg} strokeWidth="2">
                    <animate attributeName="r" values="8;16" dur="1.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0" dur="1.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={x} cy={y} r={8} fill={l.farg} stroke="#fff" strokeWidth="1.5" />
                <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{l.tecken}</text>
              </g>
            );
          })}
        </svg>

        <div className="absolute bottom-3 left-3 flex items-center bg-white/95 border border-slate-200 rounded-lg shadow-sm text-sm overflow-hidden">
          <button onClick={() => zooma(1 / 1.3)} className="px-3 py-1.5 text-slate-700 hover:bg-slate-50" title="Zooma ut">−</button>
          <span className="px-2 text-xs text-slate-500 tabular-nums min-w-[44px] text-center">{procent}%</span>
          <button onClick={() => zooma(1.3)} className="px-3 py-1.5 text-slate-700 hover:bg-slate-50" title="Zooma in">+</button>
          <button onClick={() => setVy(HELA)} className="px-3 py-1.5 text-slate-700 hover:bg-slate-50 border-l border-slate-200">Visa allt</button>
        </div>
        <div className="absolute bottom-3 right-3 text-[11px] text-slate-400 pointer-events-none hidden sm:block">
          Scrolla för att zooma · dra för att flytta
        </div>

        {foljer && spar && <Sparpanel u={foljer} spar={spar} steg={steg} onVal={setVald} onKor={korSteg} kor={kor} korText={korText} />}
        {valt && <Detaljer key={valt.id} valt={valt} steg={steg} spar={spar?.steg[valt.id]} onVal={setVald} onSpara={spara} />}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 mt-6 items-start">
        {FASER.map((f) => {
          const iFasen = Object.values(steg).filter((s) => s.kol >= f.fran && s.kol <= f.till && !['val', 'start', 'slut', 'hopp'].includes(s.typ))
            .sort((a, b) => a.kol - b.kol || a.rad - b.rad);
          return (
            <section key={f.namn} className="bg-white border border-slate-200 rounded-xl">
              <h2 className="px-4 py-2.5 border-b border-slate-100 text-sm font-semibold text-slate-900">{f.namn}</h2>
              <ul className="divide-y divide-slate-100">
                {iFasen.map((s) => (
                  <li
                    key={s.id}
                    onClick={() => setVald(s.id)}
                    className={`px-4 py-2 cursor-pointer text-sm ${vald === s.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <TypMarke typ={s.typ} />
                      <span className={`ml-auto text-[11px] ${STATUS[stegStatus(s)].klass}`}>{STATUS[stegStatus(s)].namn}</span>
                    </div>
                    <div className="text-slate-800">{s.namn}</div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <Anteckningar lista={anteckningar} onAndrad={setAnteckningar} />
    </div>
  );
}

/**
 * Vägen underlaget går. Flyttad till Övriga filer gäller alltid, sedan det som
 * faktiskt lästes ut och sist vad Definiera sa — avläsningen kan komma fram
 * till något annat, och då är det den som gäller.
 */
function vagFor(u: FlodesUnderlag): 'ovrigt' | 'verifikationer' | 'transaktioner' {
  if (u.sortering === 'ovrigt') return 'ovrigt';
  if (u.sie) return 'verifikationer';
  if (u.utlasning && !u.utlasning.fel) return 'transaktioner';
  const k = u.definition?.kategori;
  return k === 'ovrigt' || k === 'verifikationer' ? k : 'transaktioner';
}

/** AI-stegen som går att köra på underlaget härifrån. */
type KorSteg = 'alla' | 'definiera' | 'plocka-trans' | 'plocka-verif' | 'komplettera' | 'dublett' | 'tillrackligt' | 'skriv-mejl' | 'konteras' | 'skapa-verif';

/** Var i schemat varje körbart steg står. */
const STEG_I_SCHEMAT: Record<Exclude<KorSteg, 'alla'>, string> = {
  definiera: 'definiera', 'plocka-trans': 'plocka-trans', 'plocka-verif': 'plocka-verif', komplettera: 'komplettera',
  dublett: 'val-dublett', tillrackligt: 'val-tillrackligt', 'skriv-mejl': 'skriv-mejl', konteras: 'konteras', 'skapa-verif': 'skapa-verif',
};

function Sparpanel({ u, spar, steg, onVal, onKor, kor, korText }: {
  u: FlodesUnderlag; spar: Spar; steg: Record<string, Steg>; onVal: (id: string) => void;
  onKor: (s: KorSteg, val?: { transaktionId: string; konto: string; momssats: number }) => void; kor: KorSteg | null; korText: string;
}) {
  const [oppenTrans, setOppenTrans] = useState<string | null>(null);
  const vag = vagFor(u);
  const ordning = STEG.filter((s) => spar.steg[s.id]).sort((a, b) => a.kol - b.kol || a.rad - b.rad);
  const belopp = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const KONTERING = {
    ingen: { text: 'Ej konterad', klass: 'bg-slate-100 text-slate-600' },
    gron: { text: 'Grön', klass: 'bg-emerald-50 text-emerald-700' },
    granska: { text: 'Granska', klass: 'bg-amber-50 text-amber-800' },
  };
  // Nedfälld syns bara en rad, så att schemat bakom går att se
  const [nere, setNere] = useState(false);
  const harNu = ordning.filter((s) => spar.steg[s.id].lage === 'har');

  if (nere) {
    return (
      <button
        onClick={() => setNere(false)}
        className="absolute top-3 left-3 max-w-80 flex items-center gap-2 bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-left hover:bg-slate-50"
        title="Visa sammanfattningen"
      >
        <span className="text-slate-400 text-xs">▸</span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900 truncate">{u.fileName}</span>
          {harNu.length > 0 && <span className="block text-xs text-amber-700 truncate">Här nu: {harNu.map((s) => steg[s.id].namn).join(', ')}</span>}
        </span>
      </button>
    );
  }

  return (
    <aside className="absolute top-3 left-3 w-80 max-h-[calc(100%-70px)] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-4">
      <div className="flex items-center mb-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-auto">Följer underlag</div>
        <button onClick={() => setNere(true)} className="text-xs text-slate-500 hover:text-slate-800" title="Fäll ner sammanfattningen">
          Fäll ner ▴
        </button>
      </div>
      <h2 className="text-base font-semibold text-slate-900 break-words mb-1">{u.fileName}</h2>
      <div className="flex gap-3 text-xs mb-3">
        <Link href={`/admin/underlag/${u.id}`} className="text-blue-700 hover:underline">Öppna underlaget</Link>
        {u.personKey && <Link href={`/admin/person/${encodeURIComponent(u.personKey)}`} className="text-blue-700 hover:underline">Kundens sida</Link>}
      </div>

      <button
        onClick={() => onKor('alla')}
        disabled={kor !== null}
        className="w-full mb-1 px-3 py-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
      >
        {kor === 'alla' ? `${korText || 'Kör flödet'}…` : 'Skicka in i flödet'}
      </button>
      <p className="text-[11px] text-slate-500 mb-3">
        {kor === 'alla' ? 'Ett steg i taget. Konteringen tar ungefär en minut per transaktion.' : 'Börjar från första steget och kör varje steg efter så långt flödet är byggt.'}
      </p>

      <div className="mb-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Definiera underlaget</div>
        {u.definition ? (
          <dl className="text-xs text-slate-700 grid grid-cols-[70px_1fr] gap-x-2 gap-y-0.5 mb-2">
            <dt className="text-slate-500">Vad</dt><dd>{u.definition.dokumenttyp}</dd>
            <dt className="text-slate-500">År</dt><dd>{u.definition.ar ?? 'Framgår inte'}</dd>
            <dt className="text-slate-500">Väg</dt>
            <dd>{u.definition.kategori === 'ovrigt' ? 'Övrigt' : u.definition.kategori === 'verifikationer' ? 'Verifikationer' : 'Transaktioner'}</dd>
            {u.definition.motivering && <><dt className="text-slate-500">Varför</dt><dd>{u.definition.motivering}</dd></>}
          </dl>
        ) : (
          <p className="text-xs text-slate-600 mb-2">{u.definitionFel ? `Gick inte: ${u.definitionFel}` : 'Inte definierat än.'}</p>
        )}
        <button
          onClick={() => onKor('definiera')}
          disabled={kor !== null}
          className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
        >
          {kor === 'definiera' ? 'AI:n läser…' : u.definition ? 'Definiera igen' : 'Definiera med AI'}
        </button>
      </div>

      {vag === 'verifikationer' && (
        <div className="mb-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Plocka ut verifikationer</div>
          <p className="text-xs text-slate-700 mb-2">
            {u.sie
              ? u.sie.fel
                ? `Gick inte: ${u.sie.fel}`
                : `${u.sie.antal} verifikationer inlagda${u.sie.dubbletter ? `, ${u.sie.dubbletter} fanns redan hos kunden` : ''}. Körs den igen ersätts de.`
              : u.utlasning?.fel ? `Gick inte: ${u.utlasning.fel}` : 'Inte inläst än.'}
          </p>
          <button
            onClick={() => onKor('plocka-verif')}
            disabled={kor !== null}
            className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
          >
            {kor === 'plocka-verif' ? 'Läser in…' : u.sie ? 'Läs in igen' : 'Läs in verifikationer'}
          </button>
        </div>
      )}

      {vag === 'transaktioner' && (
        <div className="mb-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Plocka ut transaktioner</div>
          <p className="text-xs text-slate-700 mb-2">
            {u.utlasning
              ? u.utlasning.fel ? `Gick inte: ${u.utlasning.fel}` : `${u.utlasning.antal} transaktioner utlästa ${new Date(u.utlasning.at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}. Körs den igen ersätts de.`
              : 'Inte utläst än.'}
          </p>
          <button
            onClick={() => onKor('plocka-trans')}
            disabled={kor !== null}
            className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
          >
            {kor === 'plocka-trans' ? 'AI:n läser…' : u.utlasning ? 'Plocka ut igen' : 'Plocka ut med AI'}
          </button>
        </div>
      )}

      {vag === 'transaktioner' && u.transaktioner.length > 0 && (
        <div className="mb-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Komplettera med kundhistorik</div>
          <p className="text-xs text-slate-700 mb-2">
            {u.komplettering
              ? u.komplettering.fel ? `Gick inte: ${u.komplettering.fel}` : `Kompletterat ${new Date(u.komplettering.at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}. Klicka på en transaktion för att se historiken.`
              : 'Inte kompletterat än.'}
          </p>
          <button
            onClick={() => onKor('komplettera')}
            disabled={kor !== null}
            className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
          >
            {kor === 'komplettera' ? 'AI:n letar…' : u.komplettering ? 'Komplettera igen' : 'Komplettera med AI'}
          </button>
        </div>
      )}

      {vag === 'transaktioner' && u.transaktioner.length > 0 && (
        <div className="mb-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Dublettcheck</div>
          <p className="text-xs text-slate-700 mb-2">
            {u.dublettkoll
              ? u.dublettkoll.fel ? `Gick inte: ${u.dublettkoll.fel}` : (() => {
                const d = u.transaktioner.filter((t) => t.dublettkoll?.status === 'dublett').length;
                const tv = u.transaktioner.filter((t) => t.dublettkoll?.status === 'tveksam').length;
                return `${d} dubletter, ${tv} tveksamma. Kollat ${new Date(u.dublettkoll.at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}.`;
              })()
              : 'Inte kollat än.'}
          </p>
          <button
            onClick={() => onKor('dublett')}
            disabled={kor !== null}
            className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
          >
            {kor === 'dublett' ? 'AI:n jämför…' : u.dublettkoll ? 'Kolla igen' : 'Leta dubbletter'}
          </button>
        </div>
      )}

      {vag === 'transaktioner' && u.transaktioner.length > 0 && (
        <div className="mb-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Tillräckligt?</div>
          <p className="text-xs text-slate-700 mb-2">
            {u.tillrackligt
              ? u.tillrackligt.fel ? `Gick inte: ${u.tillrackligt.fel}` : (() => {
                const s = u.transaktioner.filter((t) => t.tillrackligt?.status === 'saknar').length;
                const ok = u.transaktioner.filter((t) => t.tillrackligt?.status === 'tillrackligt').length;
                return `${ok} tillräckliga, ${s} saknar uppgifter. Kollat ${new Date(u.tillrackligt.at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}.`;
              })()
              : 'Inte kontrollerat än.'}
          </p>
          <button
            onClick={() => onKor('tillrackligt')}
            disabled={kor !== null}
            className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
          >
            {kor === 'tillrackligt' ? 'AI:n kontrollerar…' : u.tillrackligt ? 'Kontrollera igen' : 'Kontrollera med AI'}
          </button>
        </div>
      )}

      {vag === 'transaktioner' && (u.mejl || u.transaktioner.some((t) => !t.dublettAv && t.tillrackligt?.status === 'saknar')) && (() => {
        const utkast = u.mejl && u.mejl.status !== 'discarded' ? u.mejl : null;
        const nar = (at: string) => new Date(at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
        return (
          <div className="mb-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Skriv mail</div>
            <p className="text-xs text-slate-700 mb-2">
              {!utkast ? 'Frågas i kundens dygnsmejl kl 18, tillsammans med kundens övriga frågor.'
                : utkast.status === 'sent' ? `Skickat till ${utkast.till} ${nar(utkast.skickat ?? utkast.at)}.`
                  : <>Utkast till {utkast.till} med {utkast.antal} av underlagets transaktioner, skrivet {nar(utkast.at)} — skickas från <Link href="/admin/inkorg" className="text-violet-700 underline">inkorgen</Link>.</>}
            </p>
            {utkast && (
              <div className="mb-2 p-2 rounded-md bg-white border border-violet-100 text-xs text-slate-700">
                {utkast.amne && <div className="font-semibold mb-1">{utkast.amne}</div>}
                <div className="whitespace-pre-wrap max-h-64 overflow-y-auto">{utkast.text}</div>
              </div>
            )}
            {utkast?.status !== 'sent' && (
              <button
                onClick={() => onKor('skriv-mejl')}
                disabled={kor !== null}
                className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
              >
                {kor === 'skriv-mejl' ? 'AI:n skriver…' : utkast ? 'Skriv om' : 'Skriv kundens mejl nu'}
              </button>
            )}
          </div>
        );
      })()}

      {vag === 'transaktioner' && u.transaktioner.length > 0 && (() => {
        const att = u.transaktioner.filter((t) => !t.dublettAv && t.tillrackligt?.status !== 'saknar');
        const gron = att.filter((t) => t.kontering === 'gron').length;
        const granska = att.filter((t) => t.kontering === 'granska').length;
        const ingen = att.filter((t) => t.kontering === 'ingen' && !t.bokford).length;
        return (
          <div className="mb-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Konteras</div>
            <p className="text-xs text-slate-700 mb-2">
              {kor === 'konteras' && korText ? `${korText}.` : `${gron} gröna, ${granska} till granskning, ${ingen} inte konterade av ${att.length}.`}
              {att.length < u.transaktioner.length && ` ${u.transaktioner.length - att.length} är dubbletter eller saknar uppgifter och konteras inte.`}
            </p>
            <button
              onClick={() => onKor('konteras')}
              disabled={kor !== null || att.length === 0}
              className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
            >
              {kor === 'konteras' ? 'Två modeller konterar…' : gron + granska ? 'Kontera igen' : 'Kontera med AI'}
            </button>
          </div>
        );
      })()}

      {vag === 'transaktioner' && u.transaktioner.length > 0 && (() => {
        const bokforda = u.transaktioner.filter((t) => t.bokford).length;
        const gronaKvar = u.transaktioner.filter((t) => t.kontering === 'gron' && !t.bokford && !t.dublettAv).length;
        const granskaKvar = u.transaktioner.filter((t) => t.kontering === 'granska' && !t.bokford && !t.dublettAv).length;
        return (
          <div className="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">Skapa verifikationer</div>
            <p className="text-xs text-slate-700 mb-2">
              {bokforda} bokförda, {gronaKvar} gröna väntar{granskaKvar ? `, ${granskaKvar} väntar på granskning — välj konto under transaktionen` : ''}.
            </p>
            <button
              onClick={() => onKor('skapa-verif')}
              disabled={kor !== null || gronaKvar === 0}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
            >
              {kor === 'skapa-verif' ? 'Bokför…' : `Bokför gröna${gronaKvar ? ` (${gronaKvar})` : ''}`}
            </button>
          </div>
        );
      })()}

      <ol className="space-y-1.5 mb-3">
        {ordning.map((s) => {
          const { lage, text } = spar.steg[s.id];
          return (
            <li key={s.id}>
              <button onClick={() => onVal(s.id)} className="flex items-start gap-2 text-left w-full hover:bg-slate-50 rounded px-1 -mx-1 py-0.5">
                <span
                  className="mt-0.5 w-4 h-4 shrink-0 rounded-full text-[10px] font-bold leading-4 text-center text-white"
                  style={{ background: LAGE[lage].farg }}
                  title={LAGE[lage].namn}
                >
                  {LAGE[lage].tecken}
                </span>
                <span className="text-sm">
                  <span className={`text-slate-900 ${lage === 'har' ? 'font-semibold' : ''}`}>{steg[s.id].namn}</span>
                  <span className="block text-xs text-slate-500">{text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {u.transaktioner.length > 0 && (
        <>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Transaktioner ({u.transaktioner.length})</div>
          <ul className="divide-y divide-slate-100 text-xs">
            {u.transaktioner.map((t) => (
              <li key={t.id} className="py-1.5">
                <button onClick={() => setOppenTrans(oppenTrans === t.id ? null : t.id)} className="w-full flex items-start gap-2 text-left hover:bg-slate-50 rounded">
                  <span className="text-slate-400 mt-0.5">{oppenTrans === t.id ? '▾' : '▸'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-slate-800 truncate">{t.beskrivning || t.motpart || 'Utan beskrivning'}</span>
                    <span className="block text-slate-500 truncate">{t.datum ?? 'Inget datum'} · {t.riktning === 'in' ? '+' : '−'}{belopp.format(t.belopp)} {t.valuta}{t.motpart && t.beskrivning ? ` · ${t.motpart}` : ''}</span>
                  </span>
                  {t.dublettAv && !t.bokford ? (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Dublett</span>
                  ) : t.dublettkoll?.status === 'tveksam' && !t.bokford ? (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 text-red-700">Möjlig dublett</span>
                  ) : t.tillrackligt?.status === 'saknar' && !t.bokford && t.kontering === 'ingen' ? (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">Saknar uppgifter</span>
                  ) : (
                    <span className={`shrink-0 px-1.5 py-0.5 rounded ${t.bokford ? 'bg-emerald-600 text-white' : KONTERING[t.kontering].klass}`}>
                      {t.bokford ? 'Bokförd' : KONTERING[t.kontering].text}
                    </span>
                  )}
                </button>
                {oppenTrans === t.id && <TransaktionDetaljer t={t} format={belopp.format} onBokfor={(konto, momssats) => onKor('skapa-verif', { transaktionId: t.id, konto, momssats })} bokfor={kor === 'skapa-verif'} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

/** Allt som plockats ut om en transaktion, under raden i spårpanelen. */
function TransaktionDetaljer({ t, format, onBokfor, bokfor }: {
  t: FlodesUnderlag['transaktioner'][number]; format: (n: number) => string;
  onBokfor: (konto: string, momssats: number) => void; bokfor: boolean;
}) {
  const visa = (v: unknown): string => {
    if (typeof v === 'number') return format(v);
    if (typeof v === 'boolean') return v ? 'Ja' : 'Nej';
    if (Array.isArray(v)) return v.map(visa).join('\n');
    if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k}: ${visa(x)}`).join(', ');
    return String(v ?? '');
  };
  const exkl = t.uppgifter?.belopp_exkl_moms;
  const rader: [string, string][] = [
    ['Beskrivning', t.beskrivning],
    ['Datum', t.datum ?? ''],
    ['Motpart', t.motpart],
    ['Belopp', `${format(t.belopp)} ${t.valuta} inkl. moms, pengar ${t.riktning === 'in' ? 'in' : 'ut'}${typeof exkl === 'number' ? ` (${format(exkl)} exkl. moms)` : ''}`],
    ['Moms', t.moms ? `${format(t.moms)} ${t.valuta}` : ''],
    ['VAT-nummer', t.vatNummer],
    ...Object.entries(t.uppgifter ?? {}).filter(([k]) => k !== 'belopp_exkl_moms').map(([k, v]): [string, string] => [k.replace(/_/g, ' '), visa(v)]),
    ['Anteckning', t.anteckning],
  ];
  return (
    <div className="mt-1 ml-4 p-2 rounded bg-slate-50 border border-slate-100">
      <dl className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-0.5">
        {rader.filter(([, v]) => v).map(([k, v]) => (
          <Fragment key={k}><dt className="text-slate-500 first-letter:uppercase">{k}</dt><dd className="text-slate-800 whitespace-pre-wrap break-words">{v}</dd></Fragment>
        ))}
      </dl>
      {t.detaljer && (
        <details className="mt-1.5">
          <summary className="text-slate-500 cursor-pointer">Avskrift av underlaget</summary>
          <p className="mt-1 text-slate-600 whitespace-pre-wrap break-words">{t.detaljer}</p>
        </details>
      )}
      {t.dublettkoll && (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Dublettcheck</div>
          <div className={t.dublettkoll.status === 'dublett' ? 'text-slate-800 font-medium' : t.dublettkoll.status === 'tveksam' ? 'text-red-700 font-medium' : 'text-slate-800'}>
            {t.dublettkoll.status === 'dublett' ? 'Dublett' : t.dublettkoll.status === 'tveksam' ? 'Tveksam — kan vara en dublett' : 'Unik'}
            {t.dublettkoll.avFil && <span className="font-normal text-slate-500"> · liknar en transaktion i {t.dublettkoll.avFil}</span>}
          </div>
          {t.dublettkoll.motivering && <p className="text-slate-600">{t.dublettkoll.motivering}</p>}
        </div>
      )}
      {t.verifikation ? (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Verifikation</div>
          <div className="text-slate-500">{t.verifikation.datum ?? 'Utan datum'} · signerad {t.verifikation.signatur || '—'}</div>
          <table className="w-full mt-0.5">
            <tbody>
              {t.verifikation.rader.map((r, i) => (
                <tr key={i}>
                  <td className="font-mono pr-1.5 align-top">{r.konto}</td>
                  <td className="text-slate-600 pr-1.5">{r.kontonamn}</td>
                  <td className="text-right whitespace-nowrap font-mono">{r.belopp > 0 ? format(r.belopp) : ''}</td>
                  <td className="text-right whitespace-nowrap font-mono pl-1.5">{r.belopp < 0 ? format(-r.belopp) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : t.forslag.length > 0 && !t.dublettAv && (
        <Bokforingsval t={t} onBokfor={onBokfor} bokfor={bokfor} />
      )}
      {t.tillrackligt && (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Tillräckligt?</div>
          {t.tillrackligt.status === 'tillrackligt' ? (
            <div className="text-slate-800 font-medium">Tillräckligt</div>
          ) : (
            <>
              <div className="text-amber-800 font-medium">Saknas:</div>
              <ul className="list-disc ml-4">
                {t.tillrackligt.saknas.map((s, i) => (
                  <li key={i}><span className="text-slate-800">{s.vad}</span>{s.varfor && <span className="text-slate-500"> — {s.varfor}</span>}</li>
                ))}
              </ul>
            </>
          )}
          {t.tillrackligt.antaganden && <p className="text-slate-500 mt-0.5">Antaganden: {t.tillrackligt.antaganden}</p>}
        </div>
      )}
      {t.komplettering && <KompletteringVy k={t.komplettering} />}
    </div>
  );
}

/**
 * Modellernas konteringar för en transaktion som inte är bokförd. Grönt
 * bokförs med knappen i panelen; här väljer man konto för hand — ett av
 * förslagen eller ett eget — och bokför bara den här.
 */
function Bokforingsval({ t, onBokfor, bokfor }: {
  t: FlodesUnderlag['transaktioner'][number]; onBokfor: (konto: string, momssats: number) => void; bokfor: boolean;
}) {
  const [konto, setKonto] = useState(t.forslag[0]?.konto ?? '');
  const [sats, setSats] = useState(t.forslag[0]?.momssats ?? 0);
  const OMDOME: Record<string, string> = { gron: 'text-emerald-700', gul: 'text-amber-700', rod: 'text-red-700' };
  // Samma förslag från båda modellerna visas en gång
  const unika = t.forslag.filter((f, i, a) => f.konto && a.findIndex((x) => x.konto === f.konto && x.momssats === f.momssats) === i);
  return (
    <div className="mt-2 pt-2 border-t border-slate-200">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Kontering</div>
      <ul className="space-y-1 mt-0.5">
        {t.forslag.map((f, i) => (
          <li key={i}>
            <span className="text-slate-500">{f.modell.startsWith('claude') ? 'Claude' : 'GPT'}: </span>
            <span className="font-mono">{f.konto ?? '—'}</span> {f.kontonamn} · {f.momssats} % <span className={OMDOME[f.omdome] ?? ''}>({f.omdome})</span>
            {f.regler.length > 0 && <span className="block text-violet-700">Kundregel: {f.regler.map(regelNamn).join(', ')}</span>}
            {f.motivering && <span className="block text-slate-500">{f.motivering}</span>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {unika.map((f) => (
          <button
            key={`${f.konto}-${f.momssats}`}
            onClick={() => onBokfor(f.konto!, f.momssats)}
            disabled={bokfor}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded"
          >
            Bokför på {f.konto} ({f.momssats} %)
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-1.5">
        <input value={konto} onChange={(e) => setKonto(e.target.value)} placeholder="Konto" className="w-16 px-1.5 py-0.5 border border-slate-300 rounded font-mono" />
        <select value={sats} onChange={(e) => setSats(Number(e.target.value))} className="px-1 py-0.5 border border-slate-300 rounded">
          {[25, 12, 6, 0].map((s) => <option key={s} value={s}>{s} %</option>)}
        </select>
        <button
          onClick={() => onBokfor(konto.trim(), sats)}
          disabled={bokfor || !/^\d{4}$/.test(konto.trim())}
          className="px-2 py-0.5 border border-slate-300 hover:bg-white disabled:opacity-50 rounded"
        >
          Bokför eget konto
        </button>
      </div>
    </div>
  );
}

/** Det steget Komplettera med kundhistorik lade till på transaktionen. */
function KompletteringVy({ k }: { k: NonNullable<FlodesUnderlag['transaktioner'][number]['komplettering']> }) {
  const lista = (rubrik: string, poster: typeof k.kundensHistorik) => (
    <div className="mt-1.5">
      <div className="text-slate-500">{rubrik}</div>
      {poster.length === 0 ? <div className="text-slate-400">Inget liknande</div> : (
        <ul className="space-y-1 mt-0.5">
          {poster.map((p, i) => (
            <li key={i}>
              <span className="text-slate-800">{p.text}</span>
              <span className="text-slate-500"> · {p.antal} st{p.datum ? `, senast ${p.datum}` : ''}</span>
              <span className="block font-mono text-[11px] text-slate-700">{p.rader.map((r) => r.konto).join(' · ')}</span>
              {p.varfor && <span className="block text-slate-500">{p.varfor}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className="mt-2 pt-2 border-t border-slate-200">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Kundhistorik</div>
      {k.sammanfattning && <p className="text-slate-800 mt-0.5">{k.sammanfattning}</p>}
      {lista('Kunden har bokfört', k.kundensHistorik)}
      {lista('Andra kunder har bokfört', k.andraKunder)}
      <div className="mt-1.5">
        <div className="text-slate-500">Mejlen</div>
        <div className={k.mejl ? 'text-slate-800 whitespace-pre-wrap' : 'text-slate-400'}>{k.mejl || 'Säger inget om transaktionen'}</div>
      </div>
      <div className="mt-1.5">
        <div className="text-slate-500">Verksamhet</div>
        <div className={k.verksamhet ? 'text-slate-800' : 'text-slate-400'}>{k.verksamhet || 'Saknas i Kundkontext'}</div>
      </div>
    </div>
  );
}

function Detaljer({ valt, steg, spar, onVal, onSpara }: {
  valt: Steg; steg: Record<string, Steg>; spar?: { lage: Lage; text: string };
  onVal: (id: string | null) => void; onSpara: (id: string, t: Texter) => Promise<void>;
}) {
  const [utkast, setUtkast] = useState<Texter | null>(null);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState('');
  const harFinns = valt.typ !== 'hopp' && valt.typ !== 'val';

  const sparaUtkast = async () => {
    if (!utkast) return;
    setSparar(true);
    setFel('');
    try {
      await onSpara(valt.id, utkast);
      setUtkast(null);
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Kunde inte spara');
    } finally {
      setSparar(false);
    }
  };

  const falt = 'w-full mb-3 px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const rubrik = 'block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1';

  return (
    <aside className="absolute top-3 right-3 w-80 max-h-[calc(100%-24px)] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <TypMarke typ={valt.typ} />
        {!utkast && (
          <button
            onClick={() => setUtkast({ beskrivning: valt.beskrivning ?? '', finns: valt.finns ?? '', status: valt.status ?? null })}
            className="ml-auto text-xs text-blue-700 hover:underline"
          >
            Redigera
          </button>
        )}
        <button onClick={() => onVal(null)} className={`${utkast ? 'ml-auto' : ''} text-slate-400 hover:text-slate-700 text-lg leading-none`} title="Stäng">×</button>
      </div>
      <h2 className="text-base font-semibold text-slate-900 mb-1.5">
        {valt.typ === 'hopp' ? `Hopp ${valt.namn}` : valt.namn}
      </h2>

      {spar && (
        <div className="mb-3 px-3 py-2 rounded-lg text-sm border" style={{ borderColor: LAGE[spar.lage].farg, background: `${LAGE[spar.lage].farg}12` }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: LAGE[spar.lage].farg }}>
            Underlaget · {LAGE[spar.lage].namn}
          </div>
          <div className="text-slate-800">{spar.text}</div>
        </div>
      )}

      {utkast ? (
        <div className="mb-4">
          <label className={rubrik}>Beskrivning</label>
          <textarea
            autoFocus
            rows={5}
            value={utkast.beskrivning}
            onChange={(e) => setUtkast({ ...utkast, beskrivning: e.target.value })}
            className={falt}
          />
          {harFinns && (
            <>
              <label className={rubrik}>Finns i systemet</label>
              <textarea
                rows={3}
                value={utkast.finns}
                placeholder="Tomt = inget ännu"
                onChange={(e) => setUtkast({ ...utkast, finns: e.target.value })}
                className={falt}
              />
              <label className={rubrik}>Status</label>
              <select
                value={utkast.status ?? ''}
                onChange={(e) => setUtkast({ ...utkast, status: (e.target.value || null) as Status | null })}
                className={falt}
              >
                <option value="">Som i koden ({STATUS[stegStatus({ ...valt, status: undefined })].namn})</option>
                {(Object.keys(STATUS) as Status[]).map((k) => <option key={k} value={k}>{STATUS[k].namn}</option>)}
              </select>
            </>
          )}
          {fel && <p className="text-xs text-red-600 mb-2">{fel}</p>}
          <div className="flex gap-2">
            <button
              onClick={sparaUtkast}
              disabled={sparar}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {sparar ? 'Sparar…' : 'Spara'}
            </button>
            <button onClick={() => { setUtkast(null); setFel(''); }} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <>
          {valt.beskrivning && <p className="text-sm text-slate-600 mb-3 whitespace-pre-line">{valt.beskrivning}</p>}
          {harFinns && (
            <>
              <div className={rubrik}>Status</div>
              <p className={`text-sm font-medium mb-3 ${STATUS[stegStatus(valt)].klass}`}>{STATUS[stegStatus(valt)].namn}</p>
              <div className={rubrik}>Finns i systemet</div>
              <p className="text-sm text-slate-700 mb-3 whitespace-pre-line">{valt.finns ?? 'Inget ännu'}</p>
            </>
          )}
        </>
      )}
      <Grannar id={valt.id} steg={steg} onVal={onVal} />
    </aside>
  );
}

function TypMarke({ typ }: { typ: Typ }) {
  const t = TYPER[typ];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0"
      style={{ background: t.fyll, borderColor: t.kant, color: t.text }}
    >
      {typ !== 'hopp' && <svg width="14" height="13"><Ikon typ={typ} x={0} y={0} /></svg>}
      {t.namn}
    </span>
  );
}

function Grannar({ id, steg, onVal }: { id: string; steg: Record<string, Steg>; onVal: (id: string) => void }) {
  const namn = (s: Steg) => (s.typ === 'hopp' ? `Hopp ${s.namn}` : s.namn);
  const lista = (rubrik: string, rader: { id: string; text?: string }[]) =>
    rader.length > 0 && (
      <div className="mb-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{rubrik}</div>
        <ul className="space-y-1">
          {rader.map((r, i) => (
            <li key={i}>
              <button onClick={() => onVal(r.id)} className="text-sm text-blue-700 hover:underline text-left">
                {namn(steg[r.id])}
              </button>
              {r.text && <span className="text-xs text-slate-500"> · {r.text}</span>}
            </li>
          ))}
        </ul>
      </div>
    );

  const hoppHit = STEG.filter((s) => s.hopp === id).map((s) => ({ id: s.id }));
  const hoppDit = steg[id].hopp ? [{ id: steg[id].hopp! }] : [];

  return (
    <>
      {lista('Kommer från', [...PILAR.filter((p) => p.till === id).map((p) => ({ id: p.fran, text: p.text })), ...hoppHit])}
      {lista('Går vidare till', [...PILAR.filter((p) => p.fran === id).map((p) => ({ id: p.till, text: p.text })), ...hoppDit])}
    </>
  );
}

interface Anteckning { id: string; rubrik: string; text: string; at: string }

/** Anteckningar under schemat: hur saker är uppsatta, vad som är kvar att göra. */
function Anteckningar({ lista, onAndrad }: { lista: Anteckning[] | null; onAndrad: (l: Anteckning[]) => void }) {
  // Id på den som redigeras, 'ny' för en ny anteckning
  const [redigerar, setRedigerar] = useState<string | null>(null);
  const [utkast, setUtkast] = useState({ rubrik: '', text: '' });
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState('');
  const [raderar, setRaderar] = useState<string | null>(null);

  const anrop = async (method: string, body: Record<string, unknown>) => {
    const d = await fetch('/api/admin/flodesschema', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then((r) => r.json()).catch(() => ({ error: 'Kunde inte nå servern' }));
    if (d.error) throw new Error(d.error);
    return d;
  };
  const borja = (a?: Anteckning) => {
    setRedigerar(a?.id ?? 'ny');
    setUtkast({ rubrik: a?.rubrik ?? '', text: a?.text ?? '' });
    setFel('');
  };
  const spara = async () => {
    if (!lista || (!utkast.rubrik.trim() && !utkast.text.trim())) return;
    setSparar(true);
    setFel('');
    try {
      if (redigerar === 'ny') {
        const d = await anrop('POST', utkast);
        onAndrad([...lista, d.anteckning]);
      } else {
        const d = await anrop('PATCH', { anteckning: redigerar, ...utkast });
        onAndrad(lista.map((a) => (a.id === redigerar ? { ...a, rubrik: utkast.rubrik.trim(), text: utkast.text.trim(), at: d.at } : a)));
      }
      setRedigerar(null);
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Kunde inte spara');
    } finally {
      setSparar(false);
    }
  };
  const radera = async (id: string) => {
    if (!lista) return;
    try {
      await anrop('DELETE', { anteckning: id });
      onAndrad(lista.filter((a) => a.id !== id));
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Kunde inte ta bort');
    } finally {
      setRaderar(null);
    }
  };

  const falt = 'w-full px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const formular = (
    <div className="p-4">
      <input
        autoFocus
        value={utkast.rubrik}
        onChange={(e) => setUtkast({ ...utkast, rubrik: e.target.value })}
        placeholder="Rubrik"
        className={`${falt} mb-2 font-semibold`}
      />
      <textarea
        rows={8}
        value={utkast.text}
        onChange={(e) => setUtkast({ ...utkast, text: e.target.value })}
        placeholder="Skriv en anteckning…"
        className={`${falt} mb-2`}
      />
      {fel && <p className="text-xs text-red-600 mb-2">{fel}</p>}
      <div className="flex gap-2">
        <button onClick={spara} disabled={sparar} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
          {sparar ? 'Sparar…' : 'Spara'}
        </button>
        <button onClick={() => { setRedigerar(null); setFel(''); }} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Avbryt</button>
      </div>
    </div>
  );

  return (
    <section className="mt-6 bg-white border border-slate-200 rounded-xl">
      <div className="flex items-center px-4 py-2.5 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-900">Anteckningar</h2>
        {redigerar === null && lista && (
          <button onClick={() => borja()} className="ml-auto text-xs text-blue-700 hover:underline">+ Ny anteckning</button>
        )}
      </div>
      {!lista ? (
        <p className="px-4 py-3 text-sm text-slate-400">Hämtar…</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {lista.length === 0 && redigerar !== 'ny' && <li className="px-4 py-3 text-sm text-slate-400">Inga anteckningar än.</li>}
          {lista.map((a) => (
            <li key={a.id}>
              {redigerar === a.id ? formular : (
                <div className="px-4 py-3">
                  <div className="flex items-start gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-slate-900">{a.rubrik || 'Utan rubrik'}</h3>
                    <span className="ml-auto text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(a.at).toLocaleDateString('sv-SE')}
                    </span>
                    {redigerar === null && (raderar === a.id ? (
                      <span className="flex gap-2 text-xs whitespace-nowrap">
                        <button onClick={() => radera(a.id)} className="text-red-600 font-semibold hover:underline">Ja, ta bort</button>
                        <button onClick={() => setRaderar(null)} className="text-slate-500 hover:underline">Avbryt</button>
                      </span>
                    ) : (
                      <span className="flex gap-3 text-xs whitespace-nowrap">
                        <button onClick={() => borja(a)} className="text-blue-700 hover:underline">Redigera</button>
                        <button onClick={() => setRaderar(a.id)} className="text-slate-500 hover:text-red-600 hover:underline">Ta bort</button>
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{a.text}</p>
                </div>
              )}
            </li>
          ))}
          {redigerar === 'ny' && <li>{formular}</li>}
        </ul>
      )}
    </section>
  );
}
