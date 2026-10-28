import type { SupabaseClient } from '@supabase/supabase-js';
import { KUND_KOLUMNER, byggKundkontext, type Kund } from '@/lib/ai-test/kundkontext';
import { hamtaArslista, hamtaKundbild } from './kundbild';
import { fraga } from './modeller';
import { momsText, rensaMomsdelar } from './momsdelar';
import { slutligKontering } from './preliminar';
import { slaUppKonto, type Flagga } from './regelverk';

/**
 * Helhetskontrollen: när kundens transaktioner är konterade läser en modell
 * alla konteringar tillsammans och letar efter det man inte ser i en
 * transaktion åt gången — samma motpart på olika konton, privata mönster,
 * moms som inte går ihop, ett abonnemang som hoppar över en månad.
 *
 * En anmärkning om ett troligt fel på en transaktion som inte är bokförd blir
 * en flagga på båda modellernas kontering, och en grön rad blir gul och går
 * till Granska. Principfrågor — förpackningar på två konton, köp som kanske är
 * privata — och anmärkningar om kunden i stort blir anteckningar till byrån.
 * Allt sparas i `kundbilder.helhet`.
 */

const MODELL = 'claude-opus-5-5' as const;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sammanfattning', 'anmarkningar'],
  properties: {
    sammanfattning: { type: 'string' },
    anmarkningar: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rader', 'text', 'granska'],
        properties: {
          rader: { type: 'array', items: { type: 'integer' }, description: 'Numren (K12 → 12) på transaktionerna det gäller. Tom lista när det gäller kunden i stort.' },
          text: { type: 'string' },
          granska: { type: 'boolean', description: 'true bara när raderna troligen är fel konterade och en människa måste rätta just dem' },
        },
      },
    },
  },
};

const FAST = `Du kontrollerar bokföringen för en svensk enskild näringsidkare med förenklat årsbokslut (K1) och kontantmetoden, åt en bokföringsbyrå.

Varje transaktion har konterats för sig. Du ser nu alla kundens transaktioner tillsammans (K1, K2 …), med kontot och momsen de fått och vem som bestämt det (byrån, AI eller bokförd). Leta efter det man inte ser i en transaktion åt gången:
- Samma motpart eller samma slags köp på olika konton utan synlig anledning.
- Privata mönster: insättningar och uttag som tar ut varandra, överföringar mellan egna konton, privata köp bokförda som kostnad.
- Moms som inte går ihop: samma leverantör med olika momssatser, moms på något som borde vara momsfritt eller tvärtom, utländska köp med svensk moms.
- Återkommande poster som saknas eller dubblerats: ett abonnemang som hoppar över en månad, samma faktura två gånger.
- Konton som inte passar verksamheten i kundbilden.

Anmärk bara på det som sannolikt är fel eller som en människa bör titta på. Inga anmärkningar alls är ett bra svar när allt ser rimligt ut. Varje anmärkning: en eller två meningar på svenska som säger vad som ser fel ut och vad som troligen är rätt, med raderna det gäller (numren, utan K). Har en transaktion inget konto än är den inte konterad — anmärk inte på det.

granska avgör om raderna går till manuell granskning:
- true när just de raderna troligen är fel konterade: fel konto, fel moms, en trolig dubblett, en uppenbart privat post bokförd som kostnad.
- false för principfrågor och avvägningar — att något kan konteras på två sätt och byrån bör välja ett, att något kanske är privat utan att något tyder på det, att underlag saknas för kunden i stort. De blir en anteckning till byrån och stoppar inte bokföringen.

sammanfattning: två eller tre meningar om hur kundens bokföring ser ut i stort.`;

export interface Helhet {
  sammanfattning: string;
  /** granska: raderna går till Granska. Annars är anmärkningen en anteckning till byrån. */
  anmarkningar: { rader: number[]; text: string; granska: boolean }[];
  /** Transaktionerna som fick en flagga. */
  flaggade: number;
}

/** Kör helhetskontrollen för kunden och flaggar konteringarna. Ett fel sparas, så att det syns i schemat. */
export async function helhetskontroll(supabase: SupabaseClient, userId: string): Promise<Helhet> {
  try {
    return await kontrollera(supabase, userId);
  } catch (err) {
    const fel = err instanceof Error ? err.message : String(err);
    await supabase.from('kundbilder').upsert({ user_id: userId, helhet_fel: fel }, { onConflict: 'user_id' });
    throw new Error(`Helhetskontrollen: ${fel}`);
  }
}

async function kontrollera(supabase: SupabaseClient, userId: string): Promise<Helhet> {
  const [arslista, kundbild, { data: profil }] = await Promise.all([
    hamtaArslista(supabase, userId),
    hamtaKundbild(supabase, userId),
    supabase.from('profiles').select(KUND_KOLUMNER).eq('id', userId).maybeSingle(),
  ]);
  const ids = arslista.rader.map((r) => r.id);
  const konteringar: { transaktion_id: string; modell: string; konto: string | null; momssats: number | null; momsdelar: unknown; omdome: string; flaggor: Flagga[] }[] = [];
  const bokforda = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const del = ids.slice(i, i + 200);
    const [k, v] = await Promise.all([
      supabase.from('konteringar').select('transaktion_id, modell, konto, momssats, momsdelar, omdome, flaggor').in('transaktion_id', del),
      supabase.from('verifikationer').select('transaktion_id').in('transaktion_id', del),
    ]);
    if (k.error ?? v.error) throw new Error((k.error ?? v.error)!.message);
    konteringar.push(...(k.data ?? []) as typeof konteringar);
    for (const x of v.data ?? []) if (x.transaktion_id) bokforda.add(x.transaktion_id);
  }

  const rader = arslista.rader.map((r, i) => {
    const k = konteringar.filter((x) => x.transaktion_id === r.id);
    const slutlig = slutligKontering(r.vald_kontering, k);
    const lage = bokforda.has(r.id) ? 'bokförd' : slutlig?.signatur === 'Erik' ? 'byrån' : slutlig ? 'AI' : k.length ? 'AI oense' : 'ej konterad';
    const konto = slutlig?.konto ?? k[0]?.konto ?? null;
    const moms = slutlig ? momsText(slutlig.momssats, slutlig.momsdelar) : k[0] ? momsText(Number(k[0].momssats ?? 0), rensaMomsdelar(k[0].momsdelar)) : '';
    const kalla = r.kalla === 'bank' ? 'bankrad' : r.kalla === 'woocommerce' ? 'webbutik' : arslista.filnamn.get(r.underlag_id ?? '') ?? 'fil';
    return `K${i + 1} ${r.datum ?? 'okänt datum'} ${r.riktning === 'in' ? 'IN ' : 'UT '} ${Number(r.belopp)} ${r.valuta || 'SEK'} · ${r.motpart || '—'} · ${(r.beskrivning ?? '').slice(0, 80)} · ${kalla.slice(0, 40)} → ${konto ? `${konto} ${slaUppKonto(konto)?.namn ?? ''}, moms ${moms}` : '—'} (${lage})`;
  });

  const { data } = await fraga<{ sammanfattning: string; anmarkningar: { rader: number[]; text: string; granska: boolean }[] }>(MODELL, {
    system: { fast: FAST, kund: '' },
    user: [
      byggKundkontext(profil as unknown as Kund | null),
      kundbild ? `KUNDBILDEN:\n${kundbild}` : '',
      `KUNDENS TRANSAKTIONER MED KONTERING (${rader.length} st, äldst först):\n${rader.join('\n')}`,
    ].filter(Boolean).join('\n\n'),
    namn: 'helhet',
    schema: SCHEMA,
  });
  const anmarkningar = (Array.isArray(data.anmarkningar) ? data.anmarkningar : [])
    .map((a) => ({ rader: (Array.isArray(a.rader) ? a.rader : []).filter((n) => Number.isInteger(n) && n >= 1 && n <= arslista.rader.length), text: String(a.text ?? '').trim(), granska: a.granska === true }))
    .filter((a) => a.text);

  // Förra kontrollens flaggor tas bort först, så att en rättad rad inte ligger kvar som anmärkt
  const perTransaktion = new Map<string, string[]>();
  // Bara anmärkningar om troliga fel flaggar raderna — principfrågor blir anteckningar
  for (const a of anmarkningar.filter((x) => x.granska)) {
    for (const n of a.rader) {
      const id = arslista.rader[n - 1].id;
      if (bokforda.has(id)) continue;
      perTransaktion.set(id, [...(perTransaktion.get(id) ?? []), a.text]);
    }
  }
  for (const k of konteringar) {
    if (bokforda.has(k.transaktion_id)) continue;
    const gamla = (k.flaggor ?? []).filter((f) => f.typ !== 'helhet');
    const nya = (perTransaktion.get(k.transaktion_id) ?? []).map((text): Flagga => ({ typ: 'helhet', allvar: 'granskning', text: `Helhetskontrollen: ${text}` }));
    if (gamla.length === (k.flaggor ?? []).length && !nya.length) continue;
    const flaggor = [...gamla, ...nya];
    // Utan helhetsflaggan avgör de andra flaggorna omdömet, som när raden konterades
    const omdome = flaggor.some((f) => f.allvar === 'stopp') ? 'rod' : flaggor.length ? 'gul' : 'gron';
    const { error } = await supabase.from('konteringar').update({ flaggor, omdome })
      .eq('transaktion_id', k.transaktion_id).eq('modell', k.modell);
    if (error) throw new Error(`Kunde inte spara helhetskontrollen: ${error.message}`);
  }

  const helhet: Helhet = { sammanfattning: String(data.sammanfattning ?? ''), anmarkningar, flaggade: perTransaktion.size };
  await supabase.from('kundbilder').upsert({ user_id: userId, helhet, helhet_at: new Date().toISOString(), helhet_fel: null }, { onConflict: 'user_id' });
  return helhet;
}
