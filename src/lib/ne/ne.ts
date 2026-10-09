import { latin1 } from '@/lib/moms/eskd';

/**
 * NE-bilagan (SKV 2161) för en enskild näringsidkare med förenklat
 * årsbokslut enligt K1 — det enda vi gör.
 *
 * Räkenskapsschemat (B1–B16, R1–R11) räknas ur verifikationerna enligt BAS
 * kopplingstabell "NE K1-regler", med kontointervall så att fullständig BAS
 * också fungerar (3041, 6040 …). Balansposterna är ingående balans plus årets
 * rörelser; ingående balans är förra årets B-rader och fylls i för hand, för
 * vi sparar inga saldon. B10 eget kapital är tillgångar minus skulder, som på
 * blanketten.
 *
 * De skattemässiga raderna (R12–R48) är det bokföringen inte vet: icke
 * avdragsgilla kostnader, fjolårets underskott, periodiseringsfond och
 * egenavgifter. De fylls i för hand; R13, R14 och R43 får ett förslag.
 *
 * Filen är SRU (INFO.SRU + BLANKETTER.SRU) för Skatteverkets filöverföring,
 * fältkoder ur NE_SKV2161 för beskattningsperiod <år>P4. Kunden skriver under
 * INK1 på Mina sidor, där NE-uppgifterna hämtas in.
 */

// ─── Fälten ──────────────────────────────────────────────────────────────────

export const B_FALT = [
  { kod: '7200', rad: 'B1', namn: 'Immateriella anläggningstillgångar', skuld: false },
  { kod: '7210', rad: 'B2', namn: 'Byggnader och markanläggningar', skuld: false },
  { kod: '7211', rad: 'B3', namn: 'Mark och andra tillgångar som inte får skrivas av', skuld: false },
  { kod: '7212', rad: 'B4', namn: 'Maskiner och inventarier', skuld: false },
  { kod: '7213', rad: 'B5', namn: 'Övriga anläggningstillgångar', skuld: false },
  { kod: '7240', rad: 'B6', namn: 'Varulager', skuld: false },
  { kod: '7250', rad: 'B7', namn: 'Kundfordringar', skuld: false },
  { kod: '7260', rad: 'B8', namn: 'Övriga fordringar', skuld: false },
  { kod: '7280', rad: 'B9', namn: 'Kassa och bank', skuld: false },
  { kod: '7320', rad: 'B11', namn: 'Obeskattade reserver', skuld: true },
  { kod: '7330', rad: 'B12', namn: 'Avsättningar', skuld: true },
  { kod: '7380', rad: 'B13', namn: 'Låneskulder', skuld: true },
  { kod: '7381', rad: 'B14', namn: 'Skatteskulder', skuld: true },
  { kod: '7382', rad: 'B15', namn: 'Leverantörsskulder', skuld: true },
  { kod: '7383', rad: 'B16', namn: 'Övriga skulder', skuld: true },
] as const;

export type BKod = (typeof B_FALT)[number]['kod'];

export const R_FALT = [
  { kod: '7400', rad: 'R1', namn: 'Försäljning och utfört arbete samt övriga momspliktiga intäkter', intakt: true },
  { kod: '7401', rad: 'R2', namn: 'Momsfria intäkter', intakt: true },
  { kod: '7402', rad: 'R3', namn: 'Bil- och bostadsförmån m.m.', intakt: true },
  { kod: '7403', rad: 'R4', namn: 'Ränteintäkter m.m.', intakt: true },
  { kod: '7500', rad: 'R5', namn: 'Varor, material och tjänster', intakt: false },
  { kod: '7501', rad: 'R6', namn: 'Övriga externa kostnader', intakt: false },
  { kod: '7502', rad: 'R7', namn: 'Anställd personal', intakt: false },
  { kod: '7503', rad: 'R8', namn: 'Räntekostnader m.m.', intakt: false },
  { kod: '7504', rad: 'R9', namn: 'Avskrivningar och nedskrivningar byggnader och markanläggningar', intakt: false },
  { kod: '7505', rad: 'R10', namn: 'Avskrivningar och nedskrivningar maskiner, inventarier och immateriella tillgångar', intakt: false },
] as const;

export type RKod = (typeof R_FALT)[number]['kod'];

/** Det som fylls i för hand, per inkomstår. Sparas i profiles.ne_uppgifter. */
export interface NeManuellt {
  /** Ingående balans per B-rad — förra årets NE, samma rad. */
  ib?: Partial<Record<BKod, number>>;
  /** Bokförda kostnader som inte ska dras av. Saknas = förslaget. */
  r13?: number;
  /** Bokförda intäkter som inte ska tas upp. Saknas = förslaget. */
  r14?: number;
  r15?: number;
  r16?: number;
  /** Outnyttjat underskott från förra året (R48 i fjol). */
  r24?: number;
  /** Återföring av periodiseringsfond. */
  r32?: number;
  /** Avsättning till periodiseringsfond, högst 30 % av R33. */
  r34?: number;
  /** Fjolårets avdrag för egenavgifter (R43 i fjol). */
  r40?: number;
  /** Påförda egenavgifter enligt slutskattebeskedet. */
  r41?: number;
  /** Årets avdrag för egenavgifter. Saknas = schablonen 25 %. */
  r43?: number;
  /** Verksamhetens art, högst 80 tecken. Saknas = profilens beskrivning. */
  verksamhet?: string;
}

// ─── Kontona ─────────────────────────────────────────────────────────────────

/** Vilken B-rad ett balanskonto hör till. 'EK' = eget kapital, som räknas fram. */
export function balansFalt(konto: string): BKod | 'EK' | null {
  if (!/^\d{4}$/.test(konto)) return null;
  const k = Number(konto);
  if (k < 1000 || k > 2999) return null;
  if (k < 1100) return '7200';
  if (k < 1200) return (k >= 1130 && k <= 1149) || (k >= 1180 && k <= 1189) ? '7211' : '7210';
  if (k < 1300) return '7212';
  if (k < 1400) return '7213';
  if (k < 1500) return '7240';
  if (k < 1600) return '7250';
  if (k < 1900) return '7260';
  if (k < 2000) return '7280';
  if (k < 2100) return 'EK';
  if (k < 2200) return '7320';
  if (k < 2300) return '7330';
  if (k < 2400 || (k >= 2410 && k <= 2419) || (k >= 2480 && k <= 2489)) return '7380';
  if ((k >= 2440 && k <= 2449) || (k >= 2460 && k <= 2479)) return '7382';
  // K1: moms, personalskatt och sociala avgifter är skatteskulder
  if (k >= 2500 && k <= 2799) return '7381';
  return '7383';
}

/**
 * Vilken R-rad ett resultatkonto hör till. Finansiella poster (80xx–88xx)
 * hamnar efter sitt saldo: intäkt i R4, kostnad i R8. 899x är bokslutets
 * resultatkonto och räknas inte — resultatet räknas fram.
 */
export function resultatFalt(konto: string, saldo: number): RKod | null {
  if (!/^\d{4}$/.test(konto)) return null;
  const k = Number(konto);
  if (k >= 3000 && k <= 3999) {
    if (k >= 3970) return '7401'; // vinst vid avyttring, bidrag, övriga ersättningar
    if (k < 3700 && k % 10 === 4) return '7401'; // momsfria konton i BAS slutar på 4
    return '7400';
  }
  if (k >= 4000 && k <= 4999) return '7500';
  if (k >= 5000 && k <= 6999) return '7501';
  if (k >= 7000 && k <= 7699) return '7502';
  if (k >= 7700 && k <= 7899) {
    const grupp = Math.floor(k / 10);
    if ([772, 777, 782, 784].includes(grupp)) return '7504';
    if ([771, 773, 776, 778, 781, 783].includes(grupp)) return '7505';
    return '7503';
  }
  if (k >= 7900 && k <= 7999) return '7503';
  if (k >= 8000 && k <= 8899) return saldo < 0 ? '7403' : '7503';
  if (k >= 8900 && k <= 8989) return '7503';
  return null;
}

/** Konton vars kostnad aldrig är avdragsgill — förslaget till R13. */
const EJ_AVDRAGSGILLA = new Set(['6072', '6982', '6992', '7623', '8423']);
/** Intäkter som inte ska tas upp — förslaget till R14 (skattefri ränta på skattekontot). */
const EJ_SKATTEPLIKTIGA = new Set(['8314']);

// ─── Beräkningen ─────────────────────────────────────────────────────────────

export interface NeResultat {
  /** R1–R10, positiva för intäkter och kostnader (en lagerökning kan göra R5 negativ). */
  r: Record<RKod, number>;
  /** R11 bokfört resultat. */
  r11: number;
  /** B1–B9, B11–B16: ingående balans + årets rörelser. */
  b: Record<BKod, number>;
  /** Årets rörelser per B-rad, för att kunna visa vad som kommer ur bokföringen. */
  rorelser: Record<BKod, number>;
  /** B10 eget kapital = tillgångar − skulder. */
  b10: number;
  summaTillgangar: number;
  /** Skattemässiga rader, alla positiva som på blanketten. */
  skatt: {
    r12: number; r13: number; r14: number; r15: number; r16: number; r17: number;
    r24: number; r29: number; r32: number; r33: number; r34: number; r35: number;
    r40: number; r41: number; r42: number; r43: number;
    /** R47 överskott eller R48 underskott (negativt). */
    resultat: number;
  };
  forslag: { r13: number; r14: number; r43: number };
  /** Konton som inte hamnade på någon rad. */
  ignorerade: { konto: string; kontonamn: string; belopp: number }[];
  varningar: string[];
}

const heltal = (n: number) => Math.sign(n) * Math.round(Math.abs(n) + 1e-9);

export function raknaNe(
  rader: { konto: string; kontonamn?: string; belopp: number }[],
  manuellt: NeManuellt = {},
): NeResultat {
  // Saldo per konto först — finansiella konton fördelas efter sitt saldo
  const saldo = new Map<string, { namn: string; belopp: number }>();
  for (const r of rader) {
    const s = saldo.get(r.konto) ?? { namn: r.kontonamn ?? '', belopp: 0 };
    s.belopp += r.belopp;
    if (!s.namn && r.kontonamn) s.namn = r.kontonamn;
    saldo.set(r.konto, s);
  }

  const rSum = Object.fromEntries(R_FALT.map((f) => [f.kod, 0])) as Record<RKod, number>;
  const rorelser = Object.fromEntries(B_FALT.map((f) => [f.kod, 0])) as Record<BKod, number>;
  const ignorerade: NeResultat['ignorerade'] = [];
  let r13f = 0;
  let r14f = 0;

  for (const [konto, { namn, belopp }] of saldo) {
    if (Math.abs(belopp) < 0.005) continue;
    if (EJ_AVDRAGSGILLA.has(konto)) r13f += belopp;
    if (EJ_SKATTEPLIKTIGA.has(konto)) r14f -= belopp;

    const b = balansFalt(konto);
    if (b === 'EK') continue; // eget kapital räknas fram ur tillgångar och skulder
    if (b) {
      const skuld = B_FALT.find((f) => f.kod === b)!.skuld;
      rorelser[b] += skuld ? -belopp : belopp;
      continue;
    }
    const r = resultatFalt(konto, belopp);
    if (r) {
      const intakt = R_FALT.find((f) => f.kod === r)!.intakt;
      rSum[r] += intakt ? -belopp : belopp;
      continue;
    }
    if (/^899\d$/.test(konto)) continue; // bokslutets resultatkonto
    ignorerade.push({ konto, kontonamn: namn, belopp });
  }

  const r = Object.fromEntries(R_FALT.map((f) => [f.kod, heltal(rSum[f.kod])])) as Record<RKod, number>;
  const r11 = R_FALT.reduce((s, f) => s + (f.intakt ? r[f.kod] : -r[f.kod]), 0);

  const b = Object.fromEntries(B_FALT.map((f) => [
    f.kod, heltal((manuellt.ib?.[f.kod] ?? 0) + rorelser[f.kod]),
  ])) as Record<BKod, number>;
  const summaTillgangar = B_FALT.filter((f) => !f.skuld).reduce((s, f) => s + b[f.kod], 0);
  const summaSkulder = B_FALT.filter((f) => f.skuld).reduce((s, f) => s + b[f.kod], 0);
  const b10 = summaTillgangar - summaSkulder;

  // Skattemässiga justeringar — samma ordning som blanketten sida 2
  const forslag = {
    r13: Math.max(0, heltal(r13f)),
    r14: Math.max(0, heltal(r14f)),
    r43: 0,
  };
  const v = (n: number | undefined) => Math.max(0, heltal(n ?? 0));
  const r12 = r11;
  const r13 = manuellt.r13 !== undefined ? v(manuellt.r13) : forslag.r13;
  const r14 = manuellt.r14 !== undefined ? v(manuellt.r14) : forslag.r14;
  const r15 = v(manuellt.r15);
  const r16 = v(manuellt.r16);
  const r17 = r12 + r13 - r14 + r15 - r16;
  const r24 = v(manuellt.r24);
  const r29 = r17 - r24;
  const r32 = v(manuellt.r32);
  const r33 = r29 + r32;
  const r34 = v(manuellt.r34);
  const r35 = r33 - r34;
  const r40 = v(manuellt.r40);
  const r41 = v(manuellt.r41);
  const r42 = r35 + r40 - r41;
  // Schablonavdraget för egenavgifter är 25 % av överskottet
  forslag.r43 = r42 > 0 ? heltal(r42 * 0.25) : 0;
  const r43 = manuellt.r43 !== undefined ? v(manuellt.r43) : forslag.r43;
  const resultat = r42 - r43;

  const varningar: string[] = [];
  for (const i of ignorerade) {
    varningar.push(`Konto ${i.konto}${i.kontonamn ? ` ${i.kontonamn}` : ''} (${i.belopp.toFixed(2)} kr) hamnar inte på någon rad`);
  }
  for (const f of B_FALT) {
    if (b[f.kod] < 0) {
      varningar.push(`${f.rad} ${f.namn} är negativ (${b[f.kod]} kr) — saknas ingående balans?`);
    }
  }
  if (r33 > 0 && r34 > Math.floor(r33 * 0.3)) {
    varningar.push(`Avsättningen till periodiseringsfond (R34) är mer än 30 % av R33 (högst ${Math.floor(r33 * 0.3)} kr)`);
  }
  if (r34 > 0 && r33 <= 0) varningar.push('Avsättning till periodiseringsfond (R34) kräver överskott i R33');

  return {
    r, r11, b, rorelser, b10, summaTillgangar,
    skatt: { r12, r13, r14, r15, r16, r17, r24, r29, r32, r33, r34, r35, r40, r41, r42, r43, resultat },
    forslag, ignorerade, varningar,
  };
}

// ─── Personnumret ────────────────────────────────────────────────────────────

function luhn(tio: string): boolean {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(tio[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(tio[9]);
}

/**
 * Personnumret med sekel, ÅÅÅÅMMDDNNNK, som SRU kräver. Ett tiosiffrigt
 * nummer får 20 om året inte har passerat, annars 19 — och 19/18 med "+",
 * som betyder över hundra år.
 */
export function personnummer12(nr: string | null | undefined, idag = new Date()): string | null {
  const text = (nr ?? '').trim();
  const siffror = text.replace(/\D/g, '');
  let tolv: string;
  if (siffror.length === 12) {
    tolv = siffror;
  } else if (siffror.length === 10) {
    const yy = Number(siffror.slice(0, 2));
    const nu = idag.getFullYear() % 100;
    let sekel = yy <= nu ? 20 : 19;
    if (text.includes('+')) sekel -= 1;
    tolv = `${sekel}${siffror}`;
  } else {
    return null;
  }
  return luhn(tolv.slice(2)) ? tolv : null;
}

// ─── SRU-filerna ─────────────────────────────────────────────────────────────

/** Vi lämnar filen — medieleverantören i INFO.SRU. */
const MEDIELEVERANTOR = {
  orgnr: '165595553586',
  namn: 'Sethapp Innovation AB',
  adress: 'Ulrikedalsvägen 10 C',
  postnr: '22458',
  postort: 'LUND',
  email: 'info@enklabokslut.se',
};

const datum8 = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const tid6 = (d: Date) => [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
/** Inga radbrytningar eller #-tecken i fritext — de skulle bryta filens struktur. */
const ren = (s: string) => s.replace(/[\r\n#]+/g, ' ').trim();

/** Fälten som ska med i filen, i blankettens ordning. Nollor utelämnas. */
export function neFalt(ne: NeResultat, ar: number, verksamhet: string): [string, string][] {
  const falt: [string, string][] = [
    ['7011', `${ar}0101`],
    ['7012', `${ar}1231`],
  ];
  const art = ren(verksamhet).slice(0, 80);
  if (art) falt.push(['7020', art]);

  for (const f of B_FALT.slice(0, 9)) if (ne.b[f.kod]) falt.push([f.kod, String(ne.b[f.kod])]);
  if (ne.b10) falt.push(['7300', String(ne.b10)]);
  for (const f of B_FALT.slice(9)) if (ne.b[f.kod]) falt.push([f.kod, String(ne.b[f.kod])]);

  for (const f of R_FALT) if (ne.r[f.kod]) falt.push([f.kod, String(ne.r[f.kod])]);
  falt.push(['7440', String(ne.r11)]);
  // Vi har biträtt vid årsbokslutet — det är tjänsten
  falt.push(['8046', 'X']);

  const s = ne.skatt;
  falt.push(['7600', String(s.r12)]);
  const valfria: [string, number][] = [
    ['7601', s.r13], ['7700', s.r14], ['7602', s.r15], ['7701', s.r16],
    ['7705', s.r24], ['7608', s.r32], ['7709', s.r34],
    ['7610', s.r40], ['7713', s.r41], ['7714', s.r43],
  ];
  for (const [kod, belopp] of valfria) if (belopp) falt.push([kod, String(belopp)]);
  if (s.resultat >= 0) falt.push(['7630', String(s.resultat)]);
  else falt.push(['7730', String(-s.resultat)]);
  return falt;
}

export function byggSru(opts: {
  ar: number;
  personnummer: string;
  namn: string;
  falt: [string, string][];
  skapad?: Date;
}): { info: Uint8Array<ArrayBuffer>; blanketter: Uint8Array<ArrayBuffer> } {
  const nu = opts.skapad ?? new Date();
  const m = MEDIELEVERANTOR;
  const info = [
    '#DATABESKRIVNING_START',
    '#PRODUKT SRU',
    `#SKAPAD ${datum8(nu)} ${tid6(nu)}`,
    '#PROGRAM ENKLA BOKSLUT',
    '#FILNAMN BLANKETTER.SRU',
    '#DATABESKRIVNING_SLUT',
    '#MEDIELEV_START',
    `#ORGNR ${m.orgnr}`,
    `#NAMN ${m.namn}`,
    `#ADRESS ${m.adress}`,
    `#POSTNR ${m.postnr}`,
    `#POSTORT ${m.postort}`,
    `#EMAIL ${m.email}`,
    '#MEDIELEV_SLUT',
  ];
  const blanketter = [
    `#BLANKETT NE-${opts.ar}P4`,
    `#IDENTITET ${opts.personnummer} ${datum8(nu)} ${tid6(nu)}`,
    ...(ren(opts.namn) ? [`#NAMN ${ren(opts.namn)}`] : []),
    ...opts.falt.map(([kod, varde]) => `#UPPGIFT ${kod} ${varde}`),
    '#BLANKETTSLUT',
    '#FIL_SLUT',
  ];
  return {
    info: latin1(info.join('\r\n') + '\r\n'),
    blanketter: latin1(blanketter.join('\r\n') + '\r\n'),
  };
}
