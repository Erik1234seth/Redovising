/**
 * Testmiljö för bokförings-AI:n — kommandoradsversionen.
 *
 * Läser allt du lagt i ai-test/underlag/, kör samma AI-analys som appen gör,
 * och sparar svaren i ai-test/resultat/ — utan att röra databasen.
 *
 * Kör med:  npm run ai-test
 * (som är:  node --env-file=.env.local ai-test/run.mjs)
 *
 * Vill du ha samma sak i webbläsaren: kör "npm run dev" och gå till /ai-test.
 * Båda kör samma kod i analyze.mjs.
 *
 * Flaggor:
 *   --fil <text>          kör bara filer vars namn innehåller <text>
 *   --typ kvitto|transaktioner   tvinga analystyp istället för att gissa på filändelsen
 *   --haendelse kopt-nagot|kund-betalat   för kvitton (default: kopt-nagot)
 *   --modell <namn>       kör med en annan modell än standard
 *   --basdokument         sök i basdokumenten och skicka med relevanta utdrag
 *   --tyst                skriv inte ut hela JSON-svaret i terminalen
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyseraFil, gissaTyp } from './analyze.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UNDERLAG_DIR = path.join(HERE, 'underlag');
const RESULTAT_DIR = path.join(HERE, 'resultat');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function parseArgs(argv) {
  const args = { fil: null, typ: null, haendelse: 'kopt-nagot', modell: null, tyst: false, basdokument: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tyst') args.tyst = true;
    else if (a === '--basdokument') args.basdokument = true;
    else if (a === '--fil') args.fil = argv[++i];
    else if (a === '--typ') args.typ = argv[++i];
    else if (a === '--haendelse') args.haendelse = argv[++i];
    else if (a === '--modell') args.modell = argv[++i];
  }
  return args;
}

function skrivSammanfattning(svar, tyst) {
  if (svar.typ === 'kvitto') {
    const r = svar.resultat;
    console.log(`   ${r.avsandare ?? '—'} · ${r.datum ?? 'inget datum'} · ${r.belopp} kr (moms ${r.moms}) · ${r.land ?? '—'}`);
    console.log(`   ${r.vad ?? '—'}`);
  } else {
    const txns = svar.resultat.transactions;
    const in_ = txns.filter((t) => t.haendelse_typ === 'kund-betalat');
    const ut = txns.filter((t) => t.haendelse_typ === 'kopt-nagot');
    console.log(`   ${txns.length} transaktioner — ${in_.length} in, ${ut.length} ut`);
    for (const t of txns.slice(0, 5)) {
      console.log(`   ${t.datum}  ${String(t.belopp).padStart(9)} kr  ${t.debit_konto}/${t.kredit_konto}  ${t.beskrivning}`);
    }
    if (txns.length > 5) console.log(`   ... ${txns.length - 5} till`);
  }
  if (!tyst) {
    console.log(JSON.stringify(svar.resultat, null, 2).split('\n').map((l) => '   │ ' + l).join('\n'));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!OPENAI_API_KEY) {
    console.error('Saknar OPENAI_API_KEY.');
    console.error('Tips: kör via "npm run ai-test" så laddas .env.local.');
    process.exit(1);
  }

  if (!fs.existsSync(UNDERLAG_DIR)) fs.mkdirSync(UNDERLAG_DIR, { recursive: true });
  if (!fs.existsSync(RESULTAT_DIR)) fs.mkdirSync(RESULTAT_DIR, { recursive: true });

  let filer = fs
    .readdirSync(UNDERLAG_DIR)
    .filter((f) => !f.startsWith('.'))
    .filter((f) => fs.statSync(path.join(UNDERLAG_DIR, f)).isFile());

  if (args.fil) {
    filer = filer.filter((f) => f.toLowerCase().includes(args.fil.toLowerCase()));
  }

  if (filer.length === 0) {
    console.log('Inga filer i ai-test/underlag/. Lägg dit kvitton, fakturor eller kontoutdrag och kör igen.');
    return;
  }

  console.log(`Kör AI-analys på ${filer.length} fil${filer.length === 1 ? '' : 'er'}...\n`);

  let ok = 0;
  let fel = 0;

  for (const fil of filer) {
    const ext = path.extname(fil).toLowerCase();
    const typ = args.typ ?? gissaTyp(ext);

    if (!typ) {
      console.log(`⏭️  ${fil} — vet inte hur ${ext} ska analyseras (kör med --typ kvitto eller --typ transaktioner)`);
      continue;
    }

    console.log(`📄 ${fil}  [${typ}]`);

    try {
      const svar = await analyseraFil({
        buffer: fs.readFileSync(path.join(UNDERLAG_DIR, fil)),
        filnamn: fil,
        typ,
        haendelse: args.haendelse,
        modell: args.modell ?? undefined,
        basdokument: args.basdokument,
        apiKey: OPENAI_API_KEY,
      });

      const extra = svar.basdokument?.length ? ` · ${svar.basdokument.length} utdrag ur basdokument` : '';
      console.log(`   ${svar.modell} · ${svar.kalla} · ${svar.sekunder}s${svar.usage ? ` · ${svar.usage.total_tokens} tokens` : ''}${extra}`);
      skrivSammanfattning(svar, args.tyst);

      const utfil = path.join(RESULTAT_DIR, `${path.basename(fil, ext)}.json`);
      fs.writeFileSync(utfil, JSON.stringify({ kord: new Date().toISOString(), ...svar }, null, 2), 'utf-8');
      console.log(`   → ai-test/resultat/${path.basename(utfil)}\n`);
      ok++;
    } catch (err) {
      console.log(`   ❌ ${err.message}\n`);
      fel++;
    }
  }

  console.log(`Klart. ${ok} lyckades${fel ? `, ${fel} misslyckades` : ''}.`);
}

main().catch((err) => {
  console.error('\n❌ Körningen kraschade:', err.message);
  process.exit(1);
});
