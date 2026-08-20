/**
 * SIE4-tolk.
 *
 * SIE är ett strikt textformat, så det här är en vanlig parser — ingen AI
 * inblandad. Läser #VER-blocken och plockar ut varje #TRANS-rad som en
 * enskild transaktion, med kontonamn från #KONTO.
 *
 * Spec: SIE 4B (importfil med verifikationer).
 */

// CP437 (#FORMAT PC8) — det SIE-standarden föreskriver. Tabell för 0x80–0xFF.
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅ' +
  'ÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
  'áíóúñÑªº¿⌐¬½¼¡«»' +
  '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
  '└┴┬├─┼╞╟╚╔╩╦╠═╬╧' +
  '╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
  'αßΓπΣσµτΦΘΩδ∞φε∩' +
  '≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

function decodeCp437(buffer) {
  let out = '';
  for (const byte of buffer) {
    out += byte < 0x80 ? String.fromCharCode(byte) : CP437_HIGH[byte - 0x80];
  }
  return out;
}

/** SIE-filer är oftast CP437, men moderna program exporterar ibland UTF-8. */
export function avkoda(buffer) {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.toString('utf-8').slice(1), teckenkodning: 'UTF-8 (BOM)' };
  }
  const utf8 = buffer.toString('utf-8');
  if (!utf8.includes('�')) {
    return { text: utf8, teckenkodning: 'UTF-8' };
  }
  return { text: decodeCp437(buffer), teckenkodning: 'CP437 (PC8)' };
}

/** Delar en SIE-rad i fält: "text i citat", {objektlista} och bara ord. */
function tokenize(line) {
  const tokens = [];
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
function parseObjekt(raw) {
  if (!raw || !raw.trim()) return [];
  const tokens = tokenize(raw);
  const par = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    par.push({ dimension: tokens[i].värde, objekt: tokens[i + 1].värde });
  }
  return par;
}

function parseDatum(v) {
  if (!v || !/^\d{8}$/.test(v)) return v || '';
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

function parseBelopp(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function avrunda(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Tolkar en SIE4-fil.
 *
 * @param {Buffer} buffer  filens innehåll
 * @param {string} filnamn
 */
export function tolkaSie(buffer, filnamn = '') {
  const { text, teckenkodning } = avkoda(buffer);
  const rader = text.split(/\r?\n/);

  const header = {
    program: '',
    format: '',
    sietyp: '',
    orgnr: '',
    foretag: '',
    genererad: '',
    rakenskapsar: [],
  };
  const kontonamn = {};
  const dimensioner = {};
  const verifikationer = [];
  const varningar = [];

  let aktuellVer = null;
  let iBlock = false;

  for (let radnr = 0; radnr < rader.length; radnr++) {
    let rad = rader[radnr].trim();
    if (!rad) continue;

    if (rad === '{') {
      iBlock = true;
      continue;
    }

    if (rad === '}') {
      if (aktuellVer) {
        verifikationer.push(aktuellVer);
        aktuellVer = null;
      }
      iBlock = false;
      continue;
    }

    // "#VER ... {" — måsvingen kan ligga sist på samma rad
    let öppnarBlock = false;
    if (rad.endsWith('{')) {
      rad = rad.slice(0, -1).trim();
      öppnarBlock = true;
    }

    const tokens = tokenize(rad);
    if (tokens.length === 0) continue;
    const post = tokens[0].värde.toUpperCase();
    const f = (i) => tokens[i]?.värde ?? '';

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
      case '#DIM':
        dimensioner[f(1)] = f(2);
        break;

      case '#VER':
        if (aktuellVer) {
          // föregående block stängdes aldrig
          verifikationer.push(aktuellVer);
          varningar.push(`Rad ${radnr + 1}: verifikation ${aktuellVer.serie}${aktuellVer.nummer} saknar avslutande }`);
        }
        aktuellVer = {
          serie: f(1),
          nummer: f(2),
          datum: parseDatum(f(3)),
          text: f(4),
          registrerad: parseDatum(f(5)),
          signatur: f(6),
          transaktioner: [],
        };
        iBlock = öppnarBlock;
        break;

      case '#TRANS':
      case '#RTRANS':
      case '#BTRANS': {
        if (!aktuellVer) {
          varningar.push(`Rad ${radnr + 1}: ${post} utanför verifikation — hoppades över`);
          break;
        }
        // #TRANS konto {objekt} belopp [datum] [text] [kvantitet] [sign]
        // Vissa program utelämnar objektlistan — hantera båda.
        const harObjekt = tokens[2]?.typ === 'objekt';
        const objektRaw = harObjekt ? tokens[2].värde : '';
        const b = harObjekt ? 3 : 2;
        const konto = f(1);

        const transaktion = {
          konto,
          kontonamn: kontonamn[konto] ?? '',
          objekt: parseObjekt(objektRaw),
          belopp: parseBelopp(f(b)),
          datum: parseDatum(f(b + 1)) || aktuellVer.datum,
          text: f(b + 2),
          kvantitet: f(b + 3) ? Number(f(b + 3)) : null,
          signatur: f(b + 4),
          /** #RTRANS/#BTRANS är historik för ändrade/borttagna rader */
          borttagen: post === '#BTRANS',
          tillagd: post === '#RTRANS',
        };
        aktuellVer.transaktioner.push(transaktion);
        break;
      }

      default:
        break; // #IB, #UB, #RES, #PSALDO m.fl. behövs inte för transaktionslistan
    }
  }

  if (aktuellVer) {
    verifikationer.push(aktuellVer);
    varningar.push(`Filen slutar mitt i verifikation ${aktuellVer.serie}${aktuellVer.nummer}`);
  }
  if (iBlock) {
    // block som aldrig stängdes — redan hanterat ovan, inget mer att göra
  }

  // Fyll på kontonamn som dök upp efter #TRANS-raderna, och räkna ihop
  for (const ver of verifikationer) {
    for (const t of ver.transaktioner) {
      if (!t.kontonamn) t.kontonamn = kontonamn[t.konto] ?? '';
    }
    const giltiga = ver.transaktioner.filter((t) => !t.borttagen && !t.tillagd);
    ver.summa = avrunda(giltiga.reduce((s, t) => s + t.belopp, 0));
    ver.balanserad = Math.abs(ver.summa) < 0.005;
  }

  // Platt lista: varje #TRANS-rad som en egen transaktion
  const transaktioner = [];
  for (const ver of verifikationer) {
    for (const t of ver.transaktioner) {
      if (t.borttagen || t.tillagd) continue;
      transaktioner.push({
        verifikation: `${ver.serie}${ver.nummer}`,
        serie: ver.serie,
        nummer: ver.nummer,
        verdatum: ver.datum,
        vertext: ver.text,
        ...t,
      });
    }
  }

  const debet = avrunda(transaktioner.filter((t) => t.belopp > 0).reduce((s, t) => s + t.belopp, 0));
  const kredit = avrunda(transaktioner.filter((t) => t.belopp < 0).reduce((s, t) => s + t.belopp, 0));
  const obalanserade = verifikationer.filter((v) => !v.balanserad);

  if (verifikationer.length === 0) {
    varningar.push('Inga #VER-poster hittades. Är det verkligen en SIE4-fil? (SIE1–3 innehåller bara saldon.)');
  }

  return {
    filnamn,
    teckenkodning,
    header,
    kontonamn,
    dimensioner,
    verifikationer,
    transaktioner,
    varningar,
    summering: {
      antalVerifikationer: verifikationer.length,
      antalTransaktioner: transaktioner.length,
      antalKonton: Object.keys(kontonamn).length,
      summaDebet: debet,
      summaKredit: avrunda(Math.abs(kredit)),
      differens: avrunda(debet + kredit),
      obalanseradeVerifikationer: obalanserade.map((v) => ({
        verifikation: `${v.serie}${v.nummer}`,
        summa: v.summa,
      })),
    },
  };
}
