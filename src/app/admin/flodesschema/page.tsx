'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { FlodesKund, FlodesUnderlag } from '@/lib/admin-types';

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

type Typ = 'ai' | 'system' | 'mejl-in' | 'mejl-ut' | 'regel' | 'manuell' | 'kund' | 'start' | 'slut' | 'val' | 'hopp';

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
  beskrivning?: string;
  finns?: string;
}

interface Pil {
  fran: string;
  till: string;
  text?: string;
  /** vh: först lodrätt, sedan vågrätt. hv: först vågrätt, sedan lodrätt. */
  form?: 'vh' | 'hv';
  /** Streckad — ett mejl mellan oss och kunden */
  mejl?: boolean;
}

// Rad 0 = kund, 1–4 = system (3 är huvudspåret), 5 = manuellt
const RADER = [124, 78, 78, 92, 78, 96];
const BANOR = [
  { namn: 'Kund', fran: 0, till: 0, farg: '#fff5f5' },
  { namn: 'System', fran: 1, till: 4, farg: '#f8fafc' },
  { namn: 'Manuellt', fran: 5, till: 5, farg: '#fffbeb' },
];
const FASER = [
  { namn: '1 · Ta emot & sortera', fran: 0, till: 4 },
  { namn: '2 · Löpande bokföring', fran: 5, till: 11 },
  { namn: '3 · Moms', fran: 12, till: 12 },
  { namn: '4 · Årsbokslut', fran: 13, till: 15 },
  { namn: '5 · Kontroll & inlämning', fran: 16, till: 18 },
];

const STEG: Steg[] = [
  { id: 'hopp-in', namn: 'A', typ: 'hopp', rad: 3, kol: 0, beskrivning: 'Här kommer allt tillbaka när kunden svarar med mer underlag.' },
  { id: 'kund-skickar', namn: 'Skickar underlag', typ: 'start', rad: 0, kol: 1, beskrivning: 'Kunden mejlar eller laddar upp kvitton, fakturor, kontoutdrag eller annat underlag.', finns: 'Mejl till oss och uppladdning på kundsidan' },
  { id: 'manuell-skickar', namn: 'Skicka in/hämta underlag', typ: 'start', rad: 5, kol: 1, beskrivning: 'Vi lägger själva in underlag, eller hämtar det från bank och kassasystem.', finns: 'Bankkoppling (Enable Banking), Zettle, Shopify, WooCommerce' },
  { id: 'ta-emot', namn: 'Ta emot underlag', typ: 'mejl-in', rad: 3, kol: 1, beskrivning: 'Allt som kommer in samlas på kunden, oavsett kanal.', finns: 'Inkorgen och underlagslistan på personkortet' },
  { id: 'definiera', namn: 'Definiera underlaget', typ: 'ai', rad: 3, kol: 2, beskrivning: 'AI:n läser underlaget och avgör vad det är och vilket år det hör till.', finns: 'AI-avläsningen sorterar underlag och övriga filer' },
  { id: 'val-aret', namn: 'Tillhör året?', typ: 'val', rad: 3, kol: 3 },
  { id: 'val-typ', namn: 'Vilken sort?', typ: 'val', rad: 3, kol: 4 },
  { id: 'separat-mapp', namn: 'Spara i separat mapp', typ: 'slut', rad: 4, kol: 4, beskrivning: 'Underlag som inte tillhör året, eller inte är bokföringsunderlag, sparas undan utan att bokföras.', finns: 'Fliken Övriga filer' },

  { id: 'plocka-verif', namn: 'Plocka ut verifikationer', typ: 'system', rad: 1, kol: 5, beskrivning: 'Redan konterad historik, t.ex. en SIE-fil, läses in direkt som verifikationer.', finns: 'Ingående balans ur kundens SIE-fil' },
  { id: 'plocka-trans', namn: 'Plocka ut transaktioner', typ: 'ai', rad: 3, kol: 5, beskrivning: 'AI:n plockar ut varje transaktion: datum, belopp, motpart och moms.' },
  { id: 'komplettera', namn: 'Komplettera med kundhistorik', typ: 'ai', rad: 3, kol: 6, beskrivning: 'Transaktionerna kompletteras med hur kunden konterat liknande saker tidigare och med mejlarkivet.', finns: 'Mejlarkivet per kund' },
  { id: 'val-tillrackligt', namn: 'Tillräckligt?', typ: 'val', rad: 3, kol: 7 },
  { id: 'skriv-mejl', namn: 'Skriv mail', typ: 'ai', rad: 2, kol: 7, beskrivning: 'Saknas något skriver AI:n till kunden och frågar efter just det.', finns: 'Underlagskontrollen frågar tills underlaget är komplett' },
  { id: 'kund-svarar-1', namn: 'Svara mail', typ: 'kund', rad: 0, kol: 7, beskrivning: 'Kunden svarar med det som saknades.' },
  { id: 'hopp-ut-1', namn: 'A', typ: 'hopp', rad: 0, kol: 8, hopp: 'hopp-in', beskrivning: 'Svaret tas emot som nytt underlag.' },
  { id: 'konteras', namn: 'Konteras', typ: 'ai', rad: 3, kol: 8, beskrivning: 'Två AI-modeller konterar var för sig enligt K1. Grönt när båda är säkra och överens.', finns: 'Fliken Kontering (GPT + Claude tvåpass)' },
  { id: 'val-resultat', namn: 'Grönt?', typ: 'val', rad: 3, kol: 9 },
  { id: 'granska', namn: 'Granska', typ: 'manuell', rad: 5, kol: 9, beskrivning: 'Det AI:n inte är överens om eller osäker på granskar vi själva.', finns: 'Rätta kontering i fliken Kontering' },
  { id: 'skapa-verif', namn: 'Skapa verifikationer', typ: 'system', rad: 3, kol: 10, beskrivning: 'Godkända konteringar blir verifikationer.' },
  { id: 'huvudbok', namn: 'Uppdatera verifikationslista / huvudbok', typ: 'system', rad: 3, kol: 11, finns: 'Verifikationslistan' },

  { id: 'bb-rr', namn: 'Uppdatera BB, RR, momsrapport', typ: 'system', rad: 3, kol: 12, beskrivning: 'Balansräkning, resultaträkning och momsrapport räknas om.' },
  { id: 'momsfil', namn: 'Skapa momsfil / periodisk sammanställning', typ: 'system', rad: 4, kol: 12, finns: 'Momsfil (eSKD)' },
  { id: 'lamna-moms', namn: 'Lämna in moms', typ: 'manuell', rad: 5, kol: 12, finns: 'Sidan Inlämning' },

  { id: 'infor-bokslut', namn: 'Inför årsbokslut', typ: 'regel', rad: 3, kol: 13, beskrivning: 'När året är slut och bokföringen är ikapp startar bokslutet.', finns: 'Fliken Bokslut (checklista)' },
  { id: 'mejl-bekrafta', namn: 'Mail: bekräfta underlag, inventarier, periodisering', typ: 'mejl-ut', rad: 2, kol: 13, beskrivning: 'Kunden får bekräfta att allt är med och svara på frågor om inventarier och periodiseringar.' },
  { id: 'kund-svarar-2', namn: 'Svara mail', typ: 'kund', rad: 0, kol: 13 },
  { id: 'val-svar', namn: 'Kundens svar', typ: 'val', rad: 0, kol: 14 },
  { id: 'hopp-ut-2', namn: 'A', typ: 'hopp', rad: 0, kol: 14, dy: -52, hopp: 'hopp-in', beskrivning: 'Kunden skickar fler transaktioner, som tas emot som nytt underlag.' },
  { id: 'justeringar', namn: 'Bokslutsjusteringar', typ: 'ai', rad: 1, kol: 15, beskrivning: 'AI:n bokar periodiseringar, avskrivningar och andra justeringar utifrån kundens svar.' },
  { id: 'sammanstall', namn: 'Sammanställ bokslut inkl. NE, moms', typ: 'system', rad: 3, kol: 15, finns: 'NE (SRU) och årsbokslut-PDF' },

  { id: 'rimlighet-ai', namn: 'Rimlighetskontroll', typ: 'ai', rad: 3, kol: 16, beskrivning: 'AI:n jämför mot tidigare år och letar efter konstiga belopp innan vi tittar.' },
  { id: 'rimlighet-manuell', namn: 'Rimlighetskontroll', typ: 'manuell', rad: 5, kol: 16, beskrivning: 'Vi går själva igenom bokslutet en sista gång.' },
  { id: 'lamna-in', namn: 'Lämna in', typ: 'manuell', rad: 5, kol: 17, finns: 'Sidan Inlämning' },
  { id: 'kvitto', namn: 'Mail med inlämningskvitto', typ: 'mejl-ut', rad: 3, kol: 17 },
  { id: 'klart', namn: 'Klart', typ: 'slut', rad: 3, kol: 18 },
];

const PILAR: Pil[] = [
  { fran: 'kund-skickar', till: 'ta-emot' },
  { fran: 'manuell-skickar', till: 'ta-emot' },
  { fran: 'hopp-in', till: 'ta-emot' },
  { fran: 'ta-emot', till: 'definiera' },
  { fran: 'definiera', till: 'val-aret' },
  { fran: 'val-aret', till: 'val-typ', text: 'Tillhör året' },
  { fran: 'val-aret', till: 'separat-mapp', text: 'Ej året' },
  { fran: 'val-typ', till: 'plocka-trans', text: 'Transaktioner' },
  { fran: 'val-typ', till: 'plocka-verif', text: 'Konterad historik' },
  { fran: 'val-typ', till: 'separat-mapp', text: 'Övrigt' },

  { fran: 'plocka-trans', till: 'komplettera' },
  { fran: 'komplettera', till: 'val-tillrackligt' },
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
  return { d: `M${a.cx},${y1} V${b.cy} H${b.v}`, tx: a.cx + 6, ty: textY(y1, b.cy), mitt: false };
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
type Texter = { beskrivning: string; finns: string };

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
 * Stegen efter huvudboken gäller hela perioden och inte ett enskilt underlag,
 * så spåret slutar där.
 */
function foljUnderlag(u: FlodesUnderlag): Spar {
  const steg: Spar['steg'] = {};
  const pilar = new Set<string>();
  const satt = (id: string, lage: Lage, text: string) => { steg[id] = { lage, text }; };
  const ga = (fran: string, till: string) => pilar.add(pilNyckel(fran, till));

  const start = u.source === 'admin' ? 'manuell-skickar' : 'kund-skickar';
  satt(start, 'klar', u.source === 'mejl' ? 'Kom som bilaga i ett mejl' : u.source === 'app' ? 'Uppladdat i appen' : 'Uppladdat av oss');
  ga(start, 'ta-emot');
  satt('ta-emot', 'klar', `Mottaget ${kort(u.at)}`);
  ga('ta-emot', 'definiera');

  if (!u.sortering) { satt('definiera', 'har', 'Inte sorterat än'); return { steg, pilar }; }
  satt('definiera', 'klar', `Sorterat som ${u.sortering === 'ovrigt' ? 'övrig fil' : 'underlag'}${u.sorteringOrsak ? ` — ${u.sorteringOrsak}` : ''}`);
  ga('definiera', 'val-aret');
  satt('val-aret', 'oppen', 'Årskontrollen finns inte än, underlaget antas tillhöra året');
  ga('val-aret', 'val-typ');

  if (u.sortering === 'ovrigt') {
    satt('val-typ', 'klar', 'Övrigt');
    ga('val-typ', 'separat-mapp');
    satt('separat-mapp', 'klar', 'Ligger under Övriga filer');
    return { steg, pilar };
  }

  if (u.sie) {
    satt('val-typ', 'klar', 'Redan konterad historik (SIE)');
    ga('val-typ', 'plocka-verif');
    if (u.sie.fel) { satt('plocka-verif', 'fel', u.sie.fel); return { steg, pilar }; }
    satt('plocka-verif', 'klar', `${u.sie.antal} verifikationer inlagda${u.sie.dubbletter ? `, ${u.sie.dubbletter} dubbletter` : ''}`);
    ga('plocka-verif', 'huvudbok');
    satt('huvudbok', 'klar', `${u.verifikationer} verifikationer i listan`);
    return { steg, pilar };
  }

  satt('val-typ', 'klar', 'Transaktioner');
  ga('val-typ', 'plocka-trans');
  if (!u.utlasning) { satt('plocka-trans', 'har', 'AI-avläsningen har inte körts'); return { steg, pilar }; }
  if (u.utlasning.fel) { satt('plocka-trans', 'fel', u.utlasning.fel); return { steg, pilar }; }
  satt('plocka-trans', 'klar', `${u.utlasning.antal} transaktioner utlästa ${kort(u.utlasning.at)}`);
  ga('plocka-trans', 'komplettera');
  satt('komplettera', 'oppen', 'Finns inte som eget steg än');
  ga('komplettera', 'val-tillrackligt');

  const T = u.transaktioner;
  const konterade = T.filter((t) => t.kontering !== 'ingen');

  if (u.kontroll?.status === 'fel') {
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
  } else {
    satt('val-tillrackligt', u.kontroll ? 'klar' : 'oppen', u.kontroll ? 'Underlaget är komplett' : 'Ingen underlagskontroll gjord');
  }

  ga('val-tillrackligt', 'konteras');
  if (T.length === 0) { satt('konteras', 'fel', 'Avläsningen gav inga transaktioner'); return { steg, pilar }; }
  if (konterade.length === 0) { satt('konteras', 'har', `Ingen av ${T.length} transaktioner konterad än`); return { steg, pilar }; }
  satt('konteras', konterade.length < T.length ? 'har' : 'klar', `${konterade.length} av ${T.length} konterade`);
  ga('konteras', 'val-resultat');

  const gron = T.filter((t) => t.kontering === 'gron');
  const granska = T.filter((t) => t.kontering === 'granska');
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
  satt('skapa-verif', bokforda < konterade.length ? 'har' : 'klar', `${bokforda} av ${T.length} bokförda`);
  ga('skapa-verif', 'huvudbok');
  satt('huvudbok', 'klar', `${u.verifikationer} verifikationer i listan`);
  return { steg, pilar };
}

export default function FlodesschemaPage() {
  const [vald, setVald] = useState<string | null>(null);
  const [baraAi, setBaraAi] = useState(false);
  const [vy, setVy] = useState<Vy>(HELA);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vy: Vy; ctm: DOMMatrix; flyttad: boolean } | null>(null);

  const platser = useMemo(() => Object.fromEntries(STEG.map((s) => [s.id, plats(s)])), []);
  const [texter, setTexter] = useState<Record<string, Texter>>({});

  useEffect(() => {
    fetch('/api/admin/flodesschema').then((r) => r.json()).then((d) => { if (d.texter) setTexter(d.texter); }).catch(() => {});
  }, []);

  // Sparade texter går före dem i koden. En tom sparad text betyder att den medvetet tömts.
  const steg = useMemo(() => Object.fromEntries(STEG.map((s) => {
    const t = texter[s.id];
    return [s.id, t ? { ...s, beskrivning: t.beskrivning || undefined, finns: t.finns || undefined } : s];
  })), [texter]);

  const spara = async (id: string, nya: Texter) => {
    const svar = await fetch('/api/admin/flodesschema', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...nya }),
    }).then((r) => r.json()).catch(() => ({ error: 'Kunde inte spara' }));
    if (svar.error) throw new Error(svar.error);
    setTexter((t) => ({ ...t, [id]: { beskrivning: nya.beskrivning.trim(), finns: nya.finns.trim() } }));
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

  const tonad = (id: string) => (spar ? !spar.steg[id] && vald !== id : nara ? !nara.has(id) : baraAi && steg[id].typ !== 'ai');
  /** Hur en pil ska se ut: följd av underlaget, kopplad till valt steg, eller nedtonad. */
  const pilLage = (p: Pil) => {
    const aktiv = vald !== null && (p.fran === vald || p.till === vald);
    if (spar) return { gangen: spar.pilar.has(pilNyckel(p.fran, p.till)), aktiv: false, tona: !spar.pilar.has(pilNyckel(p.fran, p.till)) };
    return { gangen: false, aktiv, tona: vald !== null ? !aktiv : baraAi };
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
          {antal('ai')} AI-steg · {antal('system')} automatiska · {antal('manuell')} manuella
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {(['ai', 'system', 'mejl-ut', 'regel', 'manuell', 'kund'] as Typ[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <svg width="16" height="14"><Ikon typ={t} x={1} y={1} /></svg>
              {TYPER[t].namn}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
            Mejl
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="16"><circle cx="8" cy="8" r="6.5" fill="#fff" stroke="#E95C63" strokeWidth="1.5" /><text x="8" y="11" textAnchor="middle" fontSize="8" fontWeight="700" fill="#E95C63">A</text></svg>
            Hopp tillbaka
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={baraAi} onChange={(e) => setBaraAi(e.target.checked)} className="w-4 h-4 accent-violet-600" />
          Markera AI-stegen
        </label>
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
                    <text x={pl.h + 5} y={pl.cy + 3} fontSize="9.5" fill="#64748b" paintOrder="stroke" stroke="#fff" strokeWidth="3">till Ta emot</text>
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
                  {rader(s.namn, 20).map((r, i) => (
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

        {foljer && spar && <Sparpanel u={foljer} spar={spar} steg={steg} onVal={setVald} />}
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
                      {s.finns
                        ? <span className="ml-auto text-[11px] text-emerald-700">Finns delvis</span>
                        : <span className="ml-auto text-[11px] text-slate-400">Inte byggt</span>}
                    </div>
                    <div className="text-slate-800">{s.namn}</div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Underlaget som följs: vad det är, var det står och dess transaktioner. */
function Sparpanel({ u, spar, steg, onVal }: { u: FlodesUnderlag; spar: Spar; steg: Record<string, Steg>; onVal: (id: string) => void }) {
  const ordning = STEG.filter((s) => spar.steg[s.id]).sort((a, b) => a.kol - b.kol || a.rad - b.rad);
  const belopp = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const KONTERING = {
    ingen: { text: 'Ej konterad', klass: 'bg-slate-100 text-slate-600' },
    gron: { text: 'Grön', klass: 'bg-emerald-50 text-emerald-700' },
    granska: { text: 'Granska', klass: 'bg-amber-50 text-amber-800' },
  };

  return (
    <aside className="absolute top-3 left-3 w-80 max-h-[calc(100%-70px)] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Följer underlag</div>
      <h2 className="text-base font-semibold text-slate-900 break-words mb-1">{u.fileName}</h2>
      <div className="flex gap-3 text-xs mb-3">
        <Link href={`/admin/underlag/${u.id}`} className="text-blue-700 hover:underline">Öppna underlaget</Link>
        {u.personKey && <Link href={`/admin/person/${encodeURIComponent(u.personKey)}`} className="text-blue-700 hover:underline">Kundens sida</Link>}
      </div>

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
              <li key={t.id} className="py-1.5 flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-slate-800 truncate">{t.motpart || t.beskrivning || 'Utan beskrivning'}</span>
                  <span className="text-slate-500">{t.datum ?? 'Inget datum'} · {belopp.format(t.belopp)} {t.valuta}</span>
                </span>
                <span className={`shrink-0 px-1.5 py-0.5 rounded ${t.bokford ? 'bg-emerald-600 text-white' : KONTERING[t.kontering].klass}`}>
                  {t.bokford ? 'Bokförd' : KONTERING[t.kontering].text}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
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
            onClick={() => setUtkast({ beskrivning: valt.beskrivning ?? '', finns: valt.finns ?? '' })}
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
