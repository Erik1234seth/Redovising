/**
 * Provkonterar transaktioner med båda modellerna utan att spara något.
 *
 *     npm run provkontera -- <kundens user_id> <transaktions-id> [fler id]
 */
import { createClient } from '@supabase/supabase-js';
import { konteraTransaktioner } from '../src/lib/kontering/kontera';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ids = process.argv.slice(3);
const start = Date.now();
const utfall = await konteraTransaktioner(sb, process.argv[2], ids, { torrkorning: true });
for (const u of utfall) {
  console.log('\n=== ' + u.transaktionId + (u.fel ? '  FEL: ' + u.fel : ''));
  for (const k of u.konteringar) {
    console.log(`  ${k.modell.padEnd(16)} ${k.omdome.padEnd(5)} konto ${k.konto} moms ${k.momssats}%  (${k.svarade})`);
    console.log(`     pass1: ${k.motivering}`);
    if (k.granskning) console.log(`     pass2: stämmer=${k.granskning.stammer} bättre=${k.granskning.battre_konto} kräver=${k.granskning.granskning_kravs} — ${k.granskning.motivering}`);
    for (const f of k.flaggor) console.log(`     [${f.allvar}] ${f.text}`);
  }
}
console.log('\ntid', Math.round((Date.now() - start) / 1000), 's');
