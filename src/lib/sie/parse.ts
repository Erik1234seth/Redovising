/**
 * SIE4-tolk.
 *
 * SIE är ett strikt textformat, så det här är en vanlig parser — ingen AI
 * inblandad. Läser #VER-blocken med sina #TRANS-rader, kontonamn från #KONTO
 * och företagsuppgifterna i huvudet.
 *
 * Portad från ai-test/sie.mjs, som bara körs lokalt. Den här används av
 * adminpanelen för att visa verifikationerna i inskickade SIE-filer.
 *
 * Spec: SIE 4B (importfil med verifikationer).
 */

export interface SieTransaktion {
  konto: string;
  kontonamn: string;
  objekt: { dimension: string; objekt: string }[];
  belopp: number;
  datum: string;
  text: string;
  kvantitet: number | null;
  signatur: string;
  /** #BTRANS: raden togs bort i efterhand. Räknas inte. */
  borttagen: boolean;
  /** #RTRANS: raden lades till i efterhand. Följs av en vanlig #TRANS som räknas. */
  tillagd: boolean;
}

export interface SieVerifikation {
  serie: string;
  nummer: string;
  datum: string;
  text: string;
  registrerad: string;
  signatur: string;
  transaktioner: SieTransaktion[];
  summa: number;
  balanserad: boolean;
}

export interface SieResultat {
  teckenkodning: string;
  header: {
    program: string;
    format: string;
    sietyp: string;
    orgnr: string;
    foretag: string;
    genererad: string;
    rakenskapsar: { id: string; start: string; slut: string }[];
  };
  kontonamn: Record<string, string>;
  verifikationer: SieVerifikation[];
  varningar: string[];
  summering: {
    antalVerifikationer: number;
    antalTransaktioner: number;
    antalKonton: number;
    summaDebet: number;
    summaKredit: number;
    differens: number;
    obalanseradeVerifikationer: { verifikation: string; summa: number }[];
  };
}

/** SIE4 heter .se, SIE4I .si. En del sparar dem som .sie. */
export function isSieFile(fileName: string | null | undefined): boolean {
  return /\.(se|si|sie)$/i.test(fileName?.trim() ?? '');
}

// CP437 (#FORMAT PC8) — det SIE-standarden föreskriver. Tabell för 0x80–0xFF.
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅ' +
  'ÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
  'áíóúñÑªº¿⌐¬½¼¡«»' +
  '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
  '└┴┬├─┼╞╟╚╔╩╦╠═╬╧' +
  '╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
  'αßΓπΣσµτΦΘΩδ∞φε∩' +
  '≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

function decodeCp437(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte < 0x80 ? String.fromCharCode(byte) : CP437_HIGH[byte - 0x80];
  return out;
}

/** SIE-filer är oftast CP437, men moderna program exporterar ibland UTF-8. */
export function avkoda(bytes: Uint8Array): { text: string; teckenkodning: string } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), teckenkodning: 'UTF-8 (BOM)' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), teckenkodning: 'UTF-8' };
  } catch {
    return { text: decodeCp437(bytes), teckenkodning: 'CP437 (PC8)' };
  }
}

type Token = { typ: 'ord' | 'objekt'; värde: string };

/** Delar en SIE-rad i fält: "text i citat", {objektlista} och bara ord. */
function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    const c = line[i];

    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }

    if (c === '{') {
      i++;
      const start = i;
      while (i < line.length && line[i] !== '}') i++;
      tokens.push({ typ: 'objekt', värde: line.slice(start, i) });
      i++; // hoppa över }
      continue;
    }

    if (c === '"') {
      i++;
      let ut = '';
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && i + 1 < line.length) {
          ut += line[i + 1];
          i += 2;
          continue;
        }
        ut += line[i++];
      }
      i++; // hoppa över avslutande "
      tokens.push({ typ: 'ord', värde: ut });
      continue;
    }

    const start = i;
    while (i < line.length && line[i] !== ' ' && line[i] !== '\t') i++;
    tokens.push({ typ: 'ord', värde: line.slice(start, i) });
  }

  return tokens;
}

/** "1 \"100\" 6 \"Projekt X\"" -> [{ dimension: '1', objekt: '100' }, ...] */
function parseObjekt(raw: string) {
  if (!raw.trim()) return [];
  const tokens = tokenize(raw);
  const par: { dimension: string; objekt: string }[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    par.push({ dimension: tokens[i].värde, objekt: tokens[i + 1].värde });
  }
  return par;
}

function parseDatum(v: string): string {
  if (!/^\d{8}$/.test(v)) return v;
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

function parseBelopp(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const avrunda = (n: number) => Math.round(n * 100) / 100;

/** Tolkar en SIE4-fil. Kastar aldrig — det som inte går att läsa blir varningar. */
export function tolkaSie(bytes: Uint8Array): SieResultat {
  const { text, teckenkodning } = avkoda(bytes);
  const rader = text.split(/\r?\n/);

  const header: SieResultat['header'] = {
    program: '', format: '', sietyp: '', orgnr: '', foretag: '', genererad: '', rakenskapsar: [],
  };
  const kontonamn: Record<string, string> = {};
  const verifikationer: SieVerifikation[] = [];
  const varningar: string[] = [];

  let aktuell: SieVerifikation | null = null;

  for (let radnr = 0; radnr < rader.length; radnr++) {
    let rad = rader[radnr].trim();
    if (!rad || rad === '{') continue;

    if (rad === '}') {
      if (aktuell) {
        verifikationer.push(aktuell);
        aktuell = null;
      }
      continue;
    }

    // "#VER ... {" — måsvingen kan ligga sist på samma rad
    if (rad.endsWith('{')) rad = rad.slice(0, -1).trim();

    const tokens = tokenize(rad);
    if (tokens.length === 0) continue;
    const post = tokens[0].värde.toUpperCase();
    const f = (i: number) => tokens[i]?.värde ?? '';

    switch (post) {
      case '#PROGRAM':
        header.program = tokens.slice(1).map((t) => t.värde).join(' ');
        break;
      case '#FORMAT':
        header.format = f(1);
        break;
      case '#SIETYP':
        header.sietyp = f(1);
        break;
      case '#ORGNR':
        header.orgnr = f(1);
        break;
      case '#FNAMN':
        header.foretag = f(1);
        break;
      case '#GEN':
        header.genererad = parseDatum(f(1));
        break;
      case '#RAR':
        header.rakenskapsar.push({ id: f(1), start: parseDatum(f(2)), slut: parseDatum(f(3)) });
        break;
      case '#KONTO':
        kontonamn[f(1)] = f(2);
        break;

      case '#VER':
        if (aktuell) {
          // föregående block stängdes aldrig
          verifikationer.push(aktuell);
          varningar.push(`Rad ${radnr + 1}: verifikation ${aktuell.serie}${aktuell.nummer} saknar avslutande }`);
        }
        aktuell = {
          serie: f(1),
          nummer: f(2),
          datum: parseDatum(f(3)),
          text: f(4),
          registrerad: parseDatum(f(5)),
          signatur: f(6),
          transaktioner: [],
          summa: 0,
          balanserad: true,
        };
        break;

      case '#TRANS':
      case '#RTRANS':
      case '#BTRANS': {
        if (!aktuell) {
          varningar.push(`Rad ${radnr + 1}: ${post} utanför verifikation — hoppades över`);
          break;
        }
        // #TRANS konto {objekt} belopp [datum] [text] [kvantitet] [sign]
        // Vissa program utelämnar objektlistan — hantera båda.
        const harObjekt = tokens[2]?.typ === 'objekt';
        const b = harObjekt ? 3 : 2;
        const konto = f(1);

        aktuell.transaktioner.push({
          konto,
          kontonamn: kontonamn[konto] ?? '',
          objekt: parseObjekt(harObjekt ? tokens[2].värde : ''),
          belopp: parseBelopp(f(b)),
          datum: parseDatum(f(b + 1)) || aktuell.datum,
          text: f(b + 2),
          kvantitet: f(b + 3) ? Number(f(b + 3)) : null,
          signatur: f(b + 4),
          borttagen: post === '#BTRANS',
          tillagd: post === '#RTRANS',
        });
        break;
      }

      default:
        break; // #IB, #UB, #RES, #PSALDO m.fl. behövs inte för verifikationslistan
    }
  }

  if (aktuell) {
    verifikationer.push(aktuell);
    varningar.push(`Filen slutar mitt i verifikation ${aktuell.serie}${aktuell.nummer}`);
  }

  // Fyll på kontonamn som dök upp efter #TRANS-raderna, och räkna ihop
  let debet = 0;
  let kredit = 0;
  let antalTransaktioner = 0;
  for (const ver of verifikationer) {
    for (const t of ver.transaktioner) {
      if (!t.kontonamn) t.kontonamn = kontonamn[t.konto] ?? '';
    }
    const giltiga = ver.transaktioner.filter((t) => !t.borttagen && !t.tillagd);
    ver.summa = avrunda(giltiga.reduce((s, t) => s + t.belopp, 0));
    ver.balanserad = Math.abs(ver.summa) < 0.005;
    for (const t of giltiga) {
      if (t.belopp > 0) debet += t.belopp;
      else kredit += t.belopp;
    }
    antalTransaktioner += giltiga.length;
  }

  if (verifikationer.length === 0) {
    varningar.push('Inga #VER-poster hittades. Är det verkligen en SIE4-fil? (SIE1–3 innehåller bara saldon.)');
  }

  return {
    teckenkodning,
    header,
    kontonamn,
    verifikationer,
    varningar,
    summering: {
      antalVerifikationer: verifikationer.length,
      antalTransaktioner,
      antalKonton: Object.keys(kontonamn).length,
      summaDebet: avrunda(debet),
      summaKredit: avrunda(Math.abs(kredit)),
      differens: avrunda(debet + kredit),
      obalanseradeVerifikationer: verifikationer
        .filter((v) => !v.balanserad)
        .map((v) => ({ verifikation: `${v.serie}${v.nummer}`, summa: v.summa })),
    },
  };
}
