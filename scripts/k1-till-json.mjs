import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

/**
 * Gör om K1-kontobeskrivningarna (xlsx) till JSON som konteringen läser.
 *
 *     npm run k1                       senaste K1_kontobeskrivningar*.xlsx i roten
 *     npm run k1 -- sökväg/till/fil.xlsx
 *
 * Bara två flikar används: Kontobeskrivningar och Gränsvärden. Resten av
 * arbetsboken är arbetsmaterial och följer inte med.
 *
 * Gränsvärden innehåller TVÅ tabeller under varandra: först parametrar
 * (prisbasbelopp, momssatser, schabloner), sedan en ny rubrikrad (rule_id)
 * och regler som pekar på en parameter med en jämförelse.
 *
 * JSON:en committas och läses bara på servern. xlsx-filen ska aldrig ligga i
 * public/, där den kan laddas ner av vem som helst.
 */

const UT = path.join(process.cwd(), 'src', 'lib', 'kontering', 'k1.json');

function hittaFil() {
  if (process.argv[2]) return process.argv[2];
  const kandidater = readdirSync(process.cwd())
    .filter((f) => /^K1_kontobeskrivningar.*\.xlsx$/i.test(f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!kandidater.length) throw new Error('Hittar ingen K1_kontobeskrivningar*.xlsx i projektroten');
  return kandidater[0];
}

/** Flerfältsvärden är separerade med | */
function lista(v) {
  return String(v ?? '').split('|').map((s) => s.trim()).filter(Boolean);
}

function text(v) {
  return String(v ?? '').trim();
}

/** Excel lagrar datum som serienummer; 25569 är 1970-01-01. */
function datum(v) {
  const n = Number(v);
  if (v === '' || !Number.isFinite(n) || n < 1000) return null;
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
}

function tal(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const fil = hittaFil();
const wb = XLSX.read(readFileSync(fil), { type: 'buffer' });
for (const ark of ['Kontobeskrivningar', 'Gränsvärden']) {
  if (!wb.SheetNames.includes(ark)) throw new Error(`Fliken ${ark} saknas i ${fil}`);
}

const konton = [];
for (const r of XLSX.utils.sheet_to_json(wb.Sheets.Kontobeskrivningar, { defval: '' })) {
  const konto = text(r.account_number);
  if (!konto) continue;
  if (text(r.status) !== 'active') continue;
  const beskrivning = text(r.short_description);
  const beslutsregler = lista(r.decision_rules);
  konton.push({
    konto,
    namn: text(r.account_name),
    beskrivning,
    anvandNar: lista(r.use_when),
    anvandInteNar: lista(r.do_not_use_when),
    beslutsregler,
    exempel: lista(r.examples),
    varningar: lista(r.warnings),
    nyckelord: lista(r.keywords),
    granskningNar: lista(r.needs_human_review),
    trosklar: lista(r.threshold_references),
    // Spärren står i klartext ("Konto 1110 får aldrig väljas automatiskt").
    // Bara meningen om kontot självt räknas — andra "aldrig automatiskt" i
    // texten handlar om undantag eller andra konton.
    endastManuellt: new RegExp(`Konto ${konto} får aldrig väljas automatiskt`, 'i')
      .test([beskrivning, ...beslutsregler, r.warnings].join(' ')),
  });
}

const gv = XLSX.utils.sheet_to_json(wb.Sheets['Gränsvärden'], { header: 1, blankrows: false, defval: '' });
const brytpunkt = gv.findIndex((r, i) => i > 0 && text(r[0]) === 'rule_id');
if (brytpunkt === -1) throw new Error('Hittar inte regeltabellen (rubriken rule_id) i Gränsvärden');
const objekt = (rubriker, rad) => Object.fromEntries(rubriker.map((k, i) => [text(k), rad[i] ?? '']));

const parametrar = gv.slice(1, brytpunkt)
  .filter((r) => text(r[0]))
  .map((r) => objekt(gv[0], r))
  .filter((p) => text(p.status) === 'active')
  .map((p) => ({
    id: text(p.value_id),
    namn: text(p.parameter_name),
    // Ett härlett värde kan peka på en annan parameter i stället för ett tal
    varde: tal(p.value) ?? text(p.value),
    enhet: text(p.unit),
    basParameter: text(p.base_parameter_id) || null,
    multiplikator: tal(p.multiplier),
    gallerFran: datum(p.valid_from),
    gallerTill: datum(p.valid_to),
  }));

const regler = gv.slice(brytpunkt + 1)
  .filter((r) => text(r[0]))
  .map((r) => objekt(gv[brytpunkt], r))
  .filter((g) => text(g.status) === 'active')
  .map((g) => ({
    id: text(g.rule_id),
    namn: text(g.rule_name),
    parameterId: text(g.value_id),
    operator: text(g.comparison_operator),
    omfattning: text(g.aggregation_scope),
    moms: text(g.vat_treatment),
    gallerFran: datum(g.valid_from),
    gallerTill: datum(g.valid_to),
    konton: lista(g.applies_to_accounts),
    anteckning: text(g.rule_notes),
  }));

writeFileSync(UT, JSON.stringify({ kalla: path.basename(fil), konton, parametrar, regler }, null, 1) + '\n');

console.log(`${path.basename(fil)} → ${path.relative(process.cwd(), UT)}`);
console.log(`  ${konton.length} konton, ${parametrar.length} parametrar, ${regler.length} regler`);
console.log(`  får aldrig väljas automatiskt: ${konton.filter((k) => k.endastManuellt).map((k) => k.konto).join(', ')}`);
