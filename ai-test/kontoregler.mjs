import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

/**
 * Regelverket ur K1-kontobeskrivningarna (xlsx) som uppslagsbar struktur.
 *
 * Poängen: det här är det ENDA stället där reglerna körs deterministiskt.
 * Allt som kan avgöras med en uppslagning eller en jämförelse görs här i kod
 * och lämnas aldrig till modellen — den kan inte minnas årets prisbasbelopp
 * och ska inte räkna på beloppsgränser.
 *
 * Arket "Gränsvärden" innehåller TVÅ tabeller under varandra: först
 * parametrar (prisbasbelopp, momssatser, schabloner), sedan en ny rubrikrad
 * och därefter regler som pekar på en parameter med en jämförelseoperator.
 * De läses därför som rader, inte som ett enda objekt per rad.
 */

const ARK = {
  konton: 'Kontobeskrivningar',
  gransvarden: 'Gränsvärden',
  kallor: 'Källor',
};

/** Flerfältsvärden är separerade med | enligt arket Fältdefinitioner. */
function lista(v) {
  return String(v ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Excel lagrar datum som serienummer; 25569 är 1970-01-01. */
function serieTillDatum(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1000) return null;
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
}

function hittaRegelfil() {
  if (process.env.KONTOREGLER_FIL) return process.env.KONTOREGLER_FIL;
  const mapp = path.join(process.cwd(), 'public');
  const kandidater = readdirSync(mapp)
    .filter((f) => /^K1_kontobeskrivningar.*\.xlsx$/i.test(f))
    .map((f) => path.join(mapp, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (kandidater.length === 0) {
    throw new Error(
      'Hittar ingen K1_kontobeskrivningar*.xlsx i public/. Sätt KONTOREGLER_FIL till sökvägen.'
    );
  }
  return kandidater[0];
}

/** Delar Gränsvärden-arket vid den andra rubrikraden. */
function lasGransvarden(ark) {
  const rader = XLSX.utils.sheet_to_json(ark, { header: 1, blankrows: false, defval: '' });
  const brytpunkt = rader.findIndex((r, i) => i > 0 && String(r[0]).trim() === 'rule_id');

  const tillObjekt = (rubriker, rad) =>
    Object.fromEntries(rubriker.map((k, i) => [k, rad[i] ?? '']));

  const paramRubriker = rader[0].map((h) => String(h).trim());
  const paramRader = (brytpunkt === -1 ? rader.slice(1) : rader.slice(1, brytpunkt))
    .filter((r) => r[0])
    .map((r) => tillObjekt(paramRubriker, r));

  let regelRader = [];
  if (brytpunkt !== -1) {
    const regelRubriker = rader[brytpunkt].map((h) => String(h).trim());
    regelRader = rader
      .slice(brytpunkt + 1)
      .filter((r) => r[0])
      .map((r) => tillObjekt(regelRubriker, r));
  }

  const parametrar = new Map();
  for (const r of paramRader) {
    parametrar.set(String(r.value_id).trim(), {
      id: String(r.value_id).trim(),
      namn: r.parameter_name,
      varde: r.value,
      enhet: String(r.unit ?? '').trim(),
      typ: r.parameter_type,
      basParameter: String(r.base_parameter_id ?? '').trim() || null,
      multiplikator: r.multiplier === '' ? null : Number(r.multiplier),
      gallerFran: serieTillDatum(r.valid_from),
      gallerTill: serieTillDatum(r.valid_to),
      kalla: r.source_reference,
      kallaUrl: r.source_url,
      status: String(r.status ?? '').trim(),
    });
  }

  const regler = new Map();
  for (const r of regelRader) {
    regler.set(String(r.rule_id).trim(), {
      id: String(r.rule_id).trim(),
      namn: r.rule_name,
      parameterId: String(r.value_id ?? '').trim(),
      operator: String(r.comparison_operator ?? '').trim(),
      omfattning: r.aggregation_scope,
      moms: r.vat_treatment,
      gallerFran: serieTillDatum(r.valid_from),
      gallerTill: serieTillDatum(r.valid_to),
      lagrum: r.legal_reference,
      konton: lista(r.applies_to_accounts),
      anteckning: r.rule_notes,
      kallaUrl: r.source_url,
      status: String(r.status ?? '').trim(),
    });
  }

  return { parametrar, regler };
}

/** Löser upp ett parametervärde till ett tal, inklusive härledda värden. */
function loesVarde(parametrar, id, djup = 0) {
  const p = parametrar.get(id);
  if (!p || djup > 5) return null;

  const direkt = Number(p.varde);
  if (Number.isFinite(direkt)) return { varde: direkt, enhet: p.enhet, parameter: p };

  // Härlett värde: value pekar på en annan parameter
  const bas = String(p.varde ?? '').trim();
  if (bas && parametrar.has(bas)) {
    const under = loesVarde(parametrar, bas, djup + 1);
    if (under) {
      const faktor = Number.isFinite(p.multiplikator) ? p.multiplikator : 1;
      return { varde: under.varde * faktor, enhet: p.enhet || under.enhet, parameter: p };
    }
  }
  if (p.basParameter && Number.isFinite(p.multiplikator)) {
    const under = loesVarde(parametrar, p.basParameter, djup + 1);
    if (under) return { varde: under.varde * p.multiplikator, enhet: p.enhet || under.enhet, parameter: p };
  }
  return null;
}

/**
 * Konton som aldrig får konteras automatiskt. Formuleringen står i klartext i
 * beskrivningarna — vi letar efter den istället för att hårdkoda kontonummer,
 * så att nya konton med samma spärr fångas när arket uppdateras.
 */
const MANUELLT_MONSTER =
  /(aldrig väljas automatiskt|endast efter manuell granskning|får aldrig konteras automatiskt|kräver alltid manuell)/i;

let cache = null;

/** Laddar regelverket. Läser om filen när den ändrats på disk. */
export function laddaRegelverk({ fil } = {}) {
  const sokvag = fil || hittaRegelfil();
  const mtime = statSync(sokvag).mtimeMs;
  if (cache && cache.sokvag === sokvag && cache.mtime === mtime) return cache.regelverk;

  const wb = XLSX.read(readFileSync(sokvag), { type: 'buffer' });
  const saknade = Object.values(ARK).filter((n) => !wb.SheetNames.includes(n));
  if (saknade.length) throw new Error(`Arket saknas i regelfilen: ${saknade.join(', ')}`);

  const { parametrar, regler } = lasGransvarden(wb.Sheets[ARK.gransvarden]);

  const konton = new Map();
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets[ARK.konton], { defval: '' })) {
    const nummer = String(r.account_number ?? '').trim();
    if (!nummer) continue;
    const beslutsregler = lista(r.decision_rules);
    konton.set(nummer, {
      konto: nummer,
      namn: String(r.account_name ?? '').trim(),
      beskrivning: String(r.short_description ?? '').trim(),
      anvandNar: lista(r.use_when),
      anvandInteNar: lista(r.do_not_use_when),
      beslutsregler,
      motkonton: lista(r.common_counter_accounts),
      exempel: lista(r.examples),
      varningar: lista(r.warnings),
      nyckelord: lista(r.keywords),
      narliggande: lista(r.related_accounts),
      kallor: lista(r.source_reference),
      granskningNar: lista(r.needs_human_review),
      trosklar: lista(r.threshold_references),
      status: String(r.status ?? '').trim(),
      version: r.version,
      endastManuellt: MANUELLT_MONSTER.test(
        [r.short_description, r.decision_rules, r.warnings].join(' ')
      ),
    });
  }

  const regelverk = {
    sokvag,
    konton,
    parametrar,
    regler,
    statistik: {
      antalKonton: konton.size,
      antalParametrar: parametrar.size,
      antalRegler: regler.size,
      statusar: [...konton.values()].reduce((acc, k) => {
        acc[k.status] = (acc[k.status] ?? 0) + 1;
        return acc;
      }, {}),
      endastManuellt: [...konton.values()].filter((k) => k.endastManuellt).map((k) => k.konto),
    },
  };

  cache = { sokvag, mtime, regelverk };
  return regelverk;
}

export function slaUppKonto(nummer, regelverk = laddaRegelverk()) {
  return regelverk.konton.get(String(nummer ?? '').trim()) ?? null;
}

/**
 * Slår upp ett konto och faller tillbaka på närmaste överordnade konto.
 *
 * Regelfilen är K1-kontoplanen, som är avsiktligt grov. Riktiga bokföringar
 * använder BAS underkonton: 1932 under 1930, 4010 under 4000, 5460 under 5400.
 * BAS är hierarkiskt uppbyggt, så vi nollställer en siffra i taget tills ett
 * konto vi har regler för dyker upp — reglerna för 5400 gäller rimligen även
 * 5460. Att regeln är ärvd följer med i svaret, så det syns i granskningen.
 */
export function slaUppMedForalder(nummer, regelverk = laddaRegelverk()) {
  const konto = String(nummer ?? '').trim();
  const exakt = regelverk.konton.get(konto);
  if (exakt) return { rad: exakt, arvdFran: null };
  if (!/^\d{4}$/.test(konto)) return { rad: null, arvdFran: null };

  for (let siffror = 3; siffror >= 1; siffror--) {
    const foralder = konto.slice(0, siffror).padEnd(4, '0');
    if (foralder === konto) continue;
    const rad = regelverk.konton.get(foralder);
    if (rad) return { rad, arvdFran: foralder };
  }
  return { rad: null, arvdFran: null };
}

/** Reglerna som gäller ett konto: både via applies_to_accounts och threshold_references. */
export function reglerForKonto(nummer, regelverk = laddaRegelverk()) {
  const konto = String(nummer ?? '').trim();
  const rad = regelverk.konton.get(konto);
  const via = new Set(rad ? rad.trosklar : []);
  const träffar = [];
  for (const regel of regelverk.regler.values()) {
    if (regel.konton.includes(konto) || via.has(regel.id)) träffar.push(regel);
  }
  return träffar;
}

/**
 * Hur långt ifrån varandra två konton ligger enligt regelverket.
 *
 * 'exakt'  — samma konto.
 * 'syskon' — olika konton som rullar upp till samma K1-huvudkonto. 3011 och
 *            3014 hamnar båda under 3000, 5615 och 5616 under 5610. De har
 *            därmed exakt samma regler, så regelverket kan inte skilja dem åt.
 * 'annat'  — olika huvudkonto, alltså olika regler.
 *
 * Skillnaden är viktig i två lägen: när ett förslag ska rättas (regelverket
 * har ingen grund för att byta mellan syskon) och när träffsäkerhet mäts (att
 * välja 3011 istället för 3014 är inte samma sorts fel som att välja 4000).
 */
export function kontoavstand(a, b, regelverk = laddaRegelverk()) {
  const x = String(a ?? '').trim();
  const y = String(b ?? '').trim();
  if (!x || !y) return 'annat';
  if (x === y) return 'exakt';

  // Samma tresiffriga grupp i BAS: 5616 och 5618 är båda personbilskostnader,
  // 1930 och 1932 båda företagskonton. Testas separat, för K1-listan innehåller
  // enstaka underkonton (5618) som annars aldrig rullar upp till sin grupp.
  if (/^\d{4}$/.test(x) && /^\d{4}$/.test(y) && x.slice(0, 3) === y.slice(0, 3)) return 'syskon';

  const fx = slaUppMedForalder(x, regelverk).rad;
  const fy = slaUppMedForalder(y, regelverk).rad;
  if (fx && fy && fx.konto === fy.konto) return 'syskon';
  return 'annat';
}

function jamfor(operator, a, b) {
  switch (operator) {
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    default:
      return null;
  }
}

/**
 * Prövar ett föreslaget konto mot regelverket.
 *
 * Deterministiskt här: att kontot finns, att det inte är spärrat för
 * automatisk kontering, och beloppsjämförelser mot rätt årsvärde.
 *
 * Situationsberoende regler (do_not_use_when, needs_human_review) kan inte
 * avgöras med kod — de returneras som underlag till andra passet.
 */
export function provaKonto({ konto, belopp, datum }, regelverk = laddaRegelverk()) {
  const nummer = String(konto ?? '').trim();
  const { rad, arvdFran } = slaUppMedForalder(nummer, regelverk);

  if (!rad) {
    // Viktigt: xlsx:en är ett urval på 151 K1-konton, inte hela BAS-kontoplanen.
    // Att ett konto saknas här betyder att vi inte har någon regel för det —
    // inte att kontot är fel. Bara uppenbart trasiga kontonummer stoppas.
    const ogiltigt = !/^\d{4}$/.test(nummer);
    return {
      konto: nummer,
      finns: false,
      flaggor: [
        ogiltigt
          ? {
              typ: 'ogiltigt-konto',
              allvar: 'stopp',
              text: `"${nummer || '(tomt)'}" är inte ett giltigt fyrsiffrigt kontonummer.`,
            }
          : {
              typ: 'utan-beskrivning',
              allvar: 'notis',
              text: `Konto ${nummer} saknar beskrivning i regelverket — det finns alltså ingen regel att pröva mot, vilket inte säger något om kontot är rätt eller fel.`,
            },
      ],
      gransprovningar: [],
      rad: null,
    };
  }

  const flaggor = [];
  if (arvdFran) {
    flaggor.push({
      typ: 'arvd-regel',
      allvar: 'notis',
      text: `${nummer} finns inte i K1-kontoplanen; reglerna nedan är hämtade från huvudkontot ${arvdFran} ${rad.namn}.`,
    });
  }
  if (rad.endastManuellt) {
    flaggor.push({
      typ: 'endast-manuellt',
      allvar: 'stopp',
      text: `${nummer} ${rad.namn} får inte konteras automatiskt enligt beskrivningen.`,
    });
  }

  const gransprovningar = [];
  const dag = datum && /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : null;

  for (const regel of reglerForKonto(rad.konto, regelverk)) {
    if (regel.status && regel.status !== 'active') continue;
    if (dag && regel.gallerFran && dag < regel.gallerFran) continue;
    if (dag && regel.gallerTill && dag > regel.gallerTill) continue;

    const löst = loesVarde(regelverk.parametrar, regel.parameterId);
    if (!löst) continue;

    const beloppsregel = /^SEK/i.test(löst.enhet) && ['<', '<=', '>', '>='].includes(regel.operator);
    const provning = {
      regel: regel.id,
      namn: regel.namn,
      operator: regel.operator,
      parameter: löst.parameter?.namn ?? regel.parameterId,
      varde: löst.varde,
      enhet: löst.enhet,
      omfattning: regel.omfattning,
      lagrum: regel.lagrum,
      anteckning: regel.anteckning,
      utfall: null,
    };

    if (beloppsregel && Number.isFinite(Number(belopp))) {
      const b = Math.abs(Number(belopp));
      provning.belopp = b;
      provning.utfall = jamfor(regel.operator, b, löst.varde);
      if (provning.utfall === false) {
        flaggor.push({
          typ: 'gransvarde',
          allvar: 'granskning',
          text: `${regel.namn}: ${b.toLocaleString('sv-SE')} kr uppfyller inte ${regel.operator} ${löst.varde.toLocaleString('sv-SE')} kr (${löst.parameter?.namn ?? regel.parameterId}).`,
          regel: regel.id,
        });
      }
    }

    gransprovningar.push(provning);
  }

  return { konto: nummer, finns: true, rad, arvdFran, flaggor, gransprovningar };
}

/** Kort textblock om ett konto — det som klistras in i andra passet. */
export function kontoBlock(rad, gransprovningar = [], { konto, arvdFran } = {}) {
  if (!rad) return '';
  const punkt = (rubrik, rader) =>
    rader.length ? `${rubrik}:\n${rader.map((r) => `- ${r}`).join('\n')}\n` : '';

  const gransrader = gransprovningar
    .filter((g) => g.utfall !== null)
    .map(
      (g) =>
        `${g.namn}: ${g.belopp?.toLocaleString('sv-SE')} kr ${g.operator} ${g.varde.toLocaleString('sv-SE')} kr → ${g.utfall ? 'uppfyllt' : 'EJ uppfyllt'}${g.omfattning ? ` (${g.omfattning})` : ''}`
    );

  return [
    arvdFran
      ? `KONTO ${konto} (underkonto till ${rad.konto} ${rad.namn} — reglerna nedan gäller huvudkontot och är vägledande, inte ett besked om att ${konto} är fel)`
      : `KONTO ${rad.konto} ${rad.namn}`,
    rad.beskrivning,
    '',
    punkt('Använd när', rad.anvandNar),
    punkt('Använd INTE när', rad.anvandInteNar),
    punkt('Beslutsregler', rad.beslutsregler),
    punkt('Varningar', rad.varningar),
    punkt('Kräver manuell granskning när', rad.granskningNar),
    punkt('Vanliga motkonton', rad.motkonton),
    punkt('Gränsprövning (uträknad i kod, godta siffrorna)', gransrader),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

export { lista as delaLista };
