import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/**
 * Tvåpasskontering.
 *
 * Pass 1  AI:n föreslår konton fritt, utan promptens lista på vanliga konton.
 * Grind   Koden prövar förslaget mot regelverket: finns kontot, är det spärrat
 *         för automatik, håller beloppsgränserna. Deterministiskt, alltid.
 * Pass 2  Konton med situationsberoende regler (använd INTE när / kräver
 *         manuell granskning) går tillbaka till modellen — men nu med exakt
 *         den kontoraden inklistrad, inte något den råkade minnas.
 * Grind   Ändrade konton prövas om, så pass 2 inte kan smita förbi koden.
 *
 * Varje steg loggas per rad, så att felprocenten går att räkna på i efterhand.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Ord som gör att ett underlag faktiskt handlar om ett förskott. */
const FORSKOTT_I_UNDERLAGET = /(förskott|a conto|à conto|handpenning|deposition)/i;

function laddaFarskt(filnamn) {
  const file = pathToFileURL(path.join(HERE, filnamn));
  return import(`${file.href}?t=${Date.now()}`);
}

/** Kör högst `tak` löften samtidigt. */
async function iOmgangar(poster, tak, fn) {
  const resultat = new Array(poster.length);
  let i = 0;
  const arbetare = Array.from({ length: Math.min(tak, poster.length) }, async () => {
    while (i < poster.length) {
      const index = i++;
      resultat[index] = await fn(poster[index], index);
    }
  });
  await Promise.all(arbetare);
  return resultat;
}

function csvFalt(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/**
 * Varje rad får ett radnr som modellen ska skicka tillbaka.
 *
 * Utan det går svaren inte att para ihop med underlaget: modellen slår ibland
 * ihop eller hoppar över rader, och då stämmer inte längre position N i svaret
 * med rad N i filen. Med radnr syns bortfallet istället för att tyst förskjuta
 * allting efteråt.
 */
function radTillCsv(rader) {
  // Moms och händelsetyp tas med bara när de faktiskt är kända. Rader ur en
  // SIE-fil har dem inte, men ett tolkat kvitto har det — och då är det
  // slöseri att låta modellen gissa det den redan fått veta.
  const harMoms = rader.some((r) => Number.isFinite(Number(r.moms)));
  const harHaendelse = rader.some((r) => r.haendelse);

  const rubriker = ['Radnr', 'Datum', 'Beskrivning', 'Belopp'];
  if (harMoms) rubriker.push('Moms');
  if (harHaendelse) rubriker.push('Handelse');

  return [
    rubriker.join(';'),
    ...rader.map((r, i) => {
      const celler = [i + 1, csvFalt(r.datum), csvFalt(r.text), csvFalt(r.belopp)];
      if (harMoms) celler.push(csvFalt(Number.isFinite(Number(r.moms)) ? r.moms : ''));
      if (harHaendelse) celler.push(csvFalt(r.haendelse ?? ''));
      return celler.join(';');
    }),
  ].join('\n');
}

/** Parar ihop modellens svar med inraderna via radnr, och hittar bortfallet. */
function paraIhop(rader, forslag) {
  const perRad = new Map();
  const utanRadnr = [];
  for (const f of forslag) {
    const nr = Number(f.radnr);
    if (Number.isInteger(nr) && nr >= 1 && nr <= rader.length && !perRad.has(nr)) perRad.set(nr, f);
    else utanRadnr.push(f);
  }
  // Saknar svaret radnr helt faller vi tillbaka på ordningen, men bara när
  // antalet stämmer — annars är en hopparning ändå bara gissning.
  if (perRad.size === 0 && forslag.length === rader.length) {
    forslag.forEach((f, i) => perRad.set(i + 1, f));
    utanRadnr.length = 0;
  }
  return { perRad, utanRadnr };
}

/**
 * Väger ihop grindarnas flaggor till ett omdöme.
 *
 * En notis om att kontot saknar beskrivning räknas som granskning: vi har
 * ingen regel att pröva mot, så en människa får titta. Den är däremot aldrig
 * ett skäl att byta konto — se GRANSKNING_PROMPT.
 */
function omdome({ flaggor, granskningKravs, andrad }) {
  if (flaggor.some((f) => f.allvar === 'stopp')) return 'stopp';
  if (andrad) return 'andrad';
  if (granskningKravs || flaggor.some((f) => f.allvar === 'granskning' || f.allvar === 'notis'))
    return 'granskning';
  return 'godkand';
}

/**
 * Prövar båda benen i en kontering och slår ihop flaggorna.
 */
function provaKontering(forslag, regler, regelverk) {
  const debet = regler.provaKonto(
    { konto: forslag.debit_konto, belopp: forslag.belopp, datum: forslag.datum },
    regelverk
  );
  const kredit = regler.provaKonto(
    { konto: forslag.kredit_konto, belopp: forslag.belopp, datum: forslag.datum },
    regelverk
  );
  return {
    debet,
    kredit,
    flaggor: [
      ...debet.flaggor.map((f) => ({ ...f, sida: 'debet' })),
      ...kredit.flaggor.map((f) => ({ ...f, sida: 'kredit' })),
    ],
  };
}

/**
 * Behöver raden andra passet alls?
 *
 * Bara om det finns något att pröva mot: en flagga med tyngd, eller en
 * kontobeskrivning med situationsberoende regler. Ett konto vi saknar
 * beskrivning för ger inget att granska — då skickas raden inte i onödan.
 */
function kraverAndraPasset(provning) {
  if (provning.flaggor.some((f) => f.allvar === 'stopp' || f.allvar === 'granskning')) return true;
  return [provning.debet, provning.kredit].some(
    (p) => p.rad && (p.rad.anvandInteNar.length > 0 || p.rad.granskningNar.length > 0)
  );
}

/**
 * En sökning per rad i stället för en för hela högen.
 *
 * Förut skickades hela CSV:en som en enda sökfråga. Frågan blev då genomsnittet
 * av alla rader, och de sex utdrag som kom tillbaka hörde inte hemma på någon
 * av dem — leasingregler hamnade på en maskinhyra och regeln om "naturligt
 * samband" på en EU-faktura. Sex rader ska ge sex frågor.
 *
 * Färre träffar per rad än förut (3 mot 6), för att prompten annars växer med
 * antalet rader. Dubbletter faller bort, så överlappande rader kostar inget.
 */
async function sokReglerPerRad({ rader, apiKey, antalPerRad = 3 }) {
  const { sokBasdokument, byggRadfraga } = await laddaFarskt('basdokument.mjs');

  const sedda = new Set();
  const traffar = [];

  for (const rad of rader) {
    const funna = await sokBasdokument({ fraga: byggRadfraga(rad), antal: antalPerRad, apiKey });
    for (const t of funna) {
      const nyckel = `${t.source}|${t.content.slice(0, 80)}`;
      if (sedda.has(nyckel)) continue;
      sedda.add(nyckel);
      traffar.push(t);
    }
  }

  return traffar;
}

export async function konteraTvaPass({
  rader,
  kalla = 'valda rader',
  kundkontext,
  basdokument = false,
  modell,
  prompt,
  granskningsModell,
  /** 0 gör körningarna jämförbara; sätt undefined för produktionens beteende. */
  temperatur = 0,
  apiKey,
}) {
  const start = Date.now();
  const { analyseraFil, callOpenAI } = await laddaFarskt('analyze.mjs');
  const prompts = await laddaFarskt('prompts.mjs');
  const regler = await laddaFarskt('kontoregler.mjs');
  const regelverk = regler.laddaRegelverk();

  // Sökningen görs här, per rad, och inte inne i analyseraFil — den ser bara
  // en CSV-fil och kan därför inte veta var en rad slutar och nästa börjar.
  const { byggBasdokumentBlock } = await laddaFarskt('basdokument.mjs');
  const traffar = basdokument ? await sokReglerPerRad({ rader, apiKey }) : [];
  const regelblock = byggBasdokumentBlock(traffar);

  const pass1Prompt = prompt || prompts.TRANSAKTIONER_PROMPT_FRI;

  // ---------- pass 1: fritt förslag ----------
  const pass1 = await analyseraFil({
    buffer: Buffer.from(radTillCsv(rader), 'utf-8'),
    filnamn: `${kalla}.csv`,
    typ: 'transaktioner',
    modell,
    prompt: regelblock ? `${pass1Prompt}\n\n${regelblock}` : pass1Prompt,
    kundkontext,
    basdokument: false,
    temperatur,
    apiKey,
  });

  const rasvar = pass1.resultat?.transactions ?? [];
  const { perRad, utanRadnr } = paraIhop(rader, rasvar);
  const saknade = rader.map((_, i) => i + 1).filter((nr) => !perRad.has(nr));

  // Varje inrad följer med vidare, även de modellen inte svarade på — annars
  // försvinner bortfallet tyst.
  const forslag = rader.map((rad, i) => {
    const f = perRad.get(i + 1);
    return f
      ? { ...f, radnr: i + 1, underlag: rad }
      : {
          radnr: i + 1,
          underlag: rad,
          datum: rad.datum,
          beskrivning: rad.text,
          belopp: rad.belopp,
          saknasISvaret: true,
        };
  });

  const valdGranskningsModell = granskningsModell || modell || prompts.MODELLER.transaktioner;
  let granskningsTokens = 0;

  // ---------- grind + pass 2 ----------
  const granskade = await iOmgangar(forslag, 3, async (f) => {
    if (f.saknasISvaret) {
      return {
        ...f,
        forslag: { debit_konto: null, kredit_konto: null },
        grind: { flaggor: [], gransprovningar: [] },
        granskning: null,
        andrad: false,
        omdome: 'saknas',
      };
    }
    const forsta = provaKontering(f, regler, regelverk);
    const post = {
      ...f,
      // Varje rad ska kunna svara på varför den fick sitt konto, även när
      // modellen struntar i fältet — annars går det inte att se om ett fel
      // uppstod i avläsningen av underlaget eller i kontovalet.
      motivering: String(f.motivering ?? '').trim() || '(modellen lämnade ingen motivering)',
      forslag: { debit_konto: f.debit_konto, kredit_konto: f.kredit_konto },
      grind: {
        flaggor: forsta.flaggor,
        gransprovningar: [
          ...forsta.debet.gransprovningar.map((g) => ({ ...g, sida: 'debet' })),
          ...forsta.kredit.gransprovningar.map((g) => ({ ...g, sida: 'kredit' })),
        ],
      },
      granskning: null,
      andrad: false,
    };

    if (!kraverAndraPasset(forsta)) {
      post.omdome = omdome({ flaggor: forsta.flaggor, granskningKravs: false, andrad: false });
      return post;
    }

    const block = [
      regler.kontoBlock(forsta.debet.rad, forsta.debet.gransprovningar, forsta.debet),
      regler.kontoBlock(forsta.kredit.rad, forsta.kredit.gransprovningar, forsta.kredit),
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    const kodflaggor = forsta.flaggor.length
      ? `\nKodens kontroller gav:\n${forsta.flaggor.map((fl) => `- (${fl.sida}) ${fl.text}`).join('\n')}\n`
      : '';

    const userContent = `UNDERLAGET:
Datum: ${f.datum}
Beskrivning: ${f.beskrivning}
Belopp: ${f.belopp} kr (varav moms ${f.moms} kr)
Händelse: ${f.haendelse_typ === 'kopt-nagot' ? 'inköp' : 'försäljning'}

FÖRSLAGET SOM SKA GRANSKAS:
Debet ${f.debit_konto} ${f.debit_namn} / Kredit ${f.kredit_konto} ${f.kredit_namn}
Modellens egen motivering: ${f.motivering ?? '—'} (säkerhet: ${f.sakerhet ?? '—'})
${kodflaggor}
REGLERNA FÖR DE FÖRESLAGNA KONTONA:
${block || '(kontona saknas i kontoplanen)'}`;

    const systemPrompt = kundkontext
      ? `${prompts.GRANSKNING_PROMPT}\n\n${kundkontext}`
      : prompts.GRANSKNING_PROMPT;

    let svar;
    try {
      const { parsed, usage } = await callOpenAI({
        apiKey,
        modell: valdGranskningsModell,
        systemPrompt,
        userContent,
        temperatur,
      });
      granskningsTokens += usage?.total_tokens ?? 0;
      svar = parsed;
    } catch (err) {
      post.granskning = { fel: err instanceof Error ? err.message : String(err) };
      post.omdome = 'granskning';
      return post;
    }

    /**
     * Byten mellan syskonkonton rullas tillbaka.
     *
     * Delar två konton K1-huvudkonto har de samma regler, och då finns det
     * inget i regelverket som kan motivera bytet — modellen gissar. Pass 1:s
     * konto är dessutom oftast det mer specifika (5616 Trängselskatt slogs ut
     * av 5618 just så här). Raden flaggas för granskning istället.
     */
    const foreslaget = (nytt, gammalt) => {
      const n = String(nytt ?? gammalt).trim();
      const g = String(gammalt).trim();
      if (n === g) return { konto: g, syskonbyte: false };
      return regler.kontoavstand(n, g, regelverk) === 'syskon'
        ? { konto: g, syskonbyte: true, avvisat: n }
        : { konto: n, syskonbyte: false };
    };

    const debetVal = foreslaget(svar.debit_konto, f.debit_konto);
    const kreditVal = foreslaget(svar.kredit_konto, f.kredit_konto);
    const syskonbyten = [debetVal, kreditVal].filter((v) => v.syskonbyte);

    /**
     * Förskottsregeln rullas tillbaka när underlaget inte nämner förskott.
     *
     * Regeln lyder "kundförskott över 5 000 kronor för en prestation som inte
     * har påbörjats" — två villkor. Modellen ser bara beloppsgränsen och gör om
     * varje kundfaktura till en skuld på 2900. Om prestationen är påbörjad går
     * inte att läsa ur ett papper, så står det inget om förskott är en vanlig
     * försäljning det enda rimliga antagandet.
     */
    const citerat = [...(svar.brutna_regler ?? []), svar.motivering ?? ''].join(' ');
    const forskottUtanStod =
      /förskott/i.test(citerat) && !FORSKOTT_I_UNDERLAGET.test(f.beskrivning ?? '');

    if (forskottUtanStod) {
      debetVal.konto = String(f.debit_konto).trim();
      kreditVal.konto = String(f.kredit_konto).trim();
    }

    const nyttDebet = debetVal.konto;
    const nyttKredit = kreditVal.konto;
    const andrad = nyttDebet !== String(f.debit_konto).trim() || nyttKredit !== String(f.kredit_konto).trim();

    post.granskning = {
      ok: svar.ok !== false,
      brutna_regler: Array.isArray(svar.brutna_regler) ? svar.brutna_regler : [],
      granskning_kravs: Boolean(svar.granskning_kravs),
      motivering: svar.motivering ?? '',
    };

    if (forskottUtanStod) {
      post.grind.flaggor = [
        ...post.grind.flaggor,
        {
          typ: 'forskottsbyte-avvisat',
          allvar: 'granskning',
          text:
            'Granskningen ville boka om posten som kundförskott, men underlaget nämner inget ' +
            'förskott. Förslaget behålls — kontrollera själv om prestationen är påbörjad.',
        },
      ];
    }

    if (syskonbyten.length) {
      post.grind.flaggor = [
        ...post.grind.flaggor,
        ...syskonbyten.map((v) => ({
          typ: 'syskonbyte-avvisat',
          allvar: 'granskning',
          text: `Granskningen ville byta ${v.konto} mot ${v.avvisat}, men kontona delar huvudkonto och har därmed samma regler. ${v.konto} behålls — välj själv vilket som är rätt.`,
        })),
      ];
      post.syskonbyten = syskonbyten.map((v) => ({ behallet: v.konto, avvisat: v.avvisat }));
    }

    if (andrad) {
      // Pass 2 får inte smita förbi koden — det nya förslaget prövas också.
      const efter = provaKontering(
        { ...f, debit_konto: nyttDebet, kredit_konto: nyttKredit },
        regler,
        regelverk
      );
      post.andrad = true;
      post.debit_konto = nyttDebet;
      post.debit_namn = svar.debit_namn ?? efter.debet.rad?.namn ?? f.debit_namn;
      post.kredit_konto = nyttKredit;
      post.kredit_namn = svar.kredit_namn ?? efter.kredit.rad?.namn ?? f.kredit_namn;
      post.grind.efterAndring = { flaggor: efter.flaggor };
      post.omdome = omdome({
        flaggor: efter.flaggor,
        granskningKravs: post.granskning.granskning_kravs,
        andrad: true,
      });
      return post;
    }

    post.omdome = omdome({
      flaggor: post.grind.flaggor,
      granskningKravs: post.granskning.granskning_kravs || svar.ok === false,
      andrad: false,
    });
    return post;
  });

  const rakna = (v) => granskade.filter((g) => g.omdome === v).length;

  return {
    typ: 'transaktioner',
    lage: 'tvapass',
    modell: pass1.modell,
    granskningsModell: valdGranskningsModell,
    kalla: `${rader.length} rader, tvåpass`,
    resultat: { transactions: granskade },
    basdokument: traffar,
    kundkontext: kundkontext || null,
    filnamn: `${kalla}.csv`,
    usage: {
      pass1_tokens: pass1.usage?.total_tokens ?? 0,
      granskning_tokens: granskningsTokens,
      total_tokens: (pass1.usage?.total_tokens ?? 0) + granskningsTokens,
    },
    sammanfattning: {
      rader: granskade.length,
      godkand: rakna('godkand'),
      granskning: rakna('granskning'),
      andrad: rakna('andrad'),
      stopp: rakna('stopp'),
      saknas: rakna('saknas'),
      andraPasset: granskade.filter((g) => g.granskning !== null).length,
    },
    hopparning: {
      inrader: rader.length,
      svarsrader: rasvar.length,
      saknadeRadnr: saknade,
      utanRadnr: utanRadnr.length,
    },
    regelverk: {
      fil: path.basename(regelverk.sokvag),
      ...regelverk.statistik,
    },
    sekunder: Number(((Date.now() - start) / 1000).toFixed(1)),
  };
}
