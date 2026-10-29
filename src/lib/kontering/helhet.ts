import type { SupabaseClient } from '@supabase/supabase-js';
import { KUND_KOLUMNER, byggKundkontext, type Kund } from '@/lib/ai-test/kundkontext';
import { hamtaArslista, hamtaKundbild } from './kundbild';
import { fraga } from './modeller';
import { momsText, rensaMomsdelar } from './momsdelar';
import { slutligKontering } from './preliminar';
import { kontoBlock, kontolista, provaKonto, slaUppKonto, type Flagga } from './regelverk';
import { reglerAttValja } from '@/lib/transaktioner/kundregler';
import { hamtaInstruktioner, reglerFor } from '@/lib/transaktioner/instruktioner';

/**
 * Helhetskontrollen: när kundens transaktioner är konterade läser en modell
 * alla konteringar tillsammans och letar efter det man inte ser i en
 * transaktion åt gången — samma motpart på olika konton, privata mönster,
 * moms som inte går ihop, ett abonnemang som hoppar över en månad.
 *
 * Varje anmärkning har en åtgärd:
 *
 *   granska     Ett troligt fel — fel moms, en trolig dubblett. Båda
 *               modellernas kontering flaggas, och raden går till Granska.
 *   samordna    Likadana köp har konterats olika och kundens egna
 *               transaktioner visar vilken linje som gäller. Kontrollen skriver
 *               en instruktion, som sparas som en kontext på transaktionen i
 *               `flodes_instruktioner` (namn "Helhetskontrollen"), och raden
 *               konteras om av båda modellerna med den. Är de överens blir den
 *               grön — kravet på två modeller ligger kvar.
 *   anteckning  Principfrågor och sådant som gäller kunden i stort. Stoppar inget.
 *
 * Kontrollen har samma regler som konteringen: K1-kontoplanen, hela regeltexten
 * för kontona kunden använder, kundreglerna och byråns kontext för kunden. En
 * linje att samordna efter ska stämma med reglerna — annars blir
 * omkonteringen gul, som när pant på engångsförpackningar lades på 0 % trots
 * att regeln säger att den följer drycken.
 *
 * Bara rader som inte är bokförda flaggas eller konteras om. Varje kontroll
 * ersätter förra kontrollens instruktioner. Allt sparas i `kundbilder.helhet`.
 */

const MODELL = 'claude-opus-5-5' as const;
const MODELLNAMN: Record<string, string> = { 'gpt-6-astra': 'GPT', 'claude-opus-5-5': 'Claude' };

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
        required: ['rader', 'text', 'atgard', 'instruktion'],
        properties: {
          rader: { type: 'array', items: { type: 'integer' }, description: 'Numren (K12 → 12) på transaktionerna det gäller. Vid samordna bara de rader som ska konteras om. Tom lista när det gäller kunden i stort.' },
          text: { type: 'string' },
          atgard: { type: 'string', enum: ['granska', 'samordna', 'anteckning'] },
          instruktion: { type: 'string', description: 'Vid samordna: instruktionen till konteringen. Annars tom sträng.' },
        },
      },
    },
  },
};

const FAST = `Du kontrollerar bokföringen för en svensk enskild näringsidkare med förenklat årsbokslut (K1) och kontantmetoden, åt en bokföringsbyrå.

Varje transaktion har konterats för sig av två modeller. Du ser nu alla kundens transaktioner tillsammans (K1, K2 …), med kontot och momsen de fått och vem som bestämt det (byrån, AI, bokförd — eller "AI oense", då står båda modellernas förslag). En uppdelning på flera konton står som "4000 Varor + 2013 Övriga egna uttag". Leta efter det man inte ser i en transaktion åt gången:
- Samma motpart eller samma slags köp på olika konton utan synlig anledning.
- Privata mönster: insättningar och uttag som tar ut varandra, överföringar mellan egna konton, privata köp bokförda som kostnad.
- Moms som inte går ihop: samma leverantör med olika momssatser, moms på något som borde vara momsfritt eller tvärtom, utländska köp med svensk moms.
- Återkommande poster som saknas eller dubblerats: ett abonnemang som hoppar över en månad, samma faktura två gånger.
- Konton som inte passar verksamheten i kundbilden.

Du har byråns regler — samma som konteringen följer: K1-kontoplanen, hela regeltexten för de konton kunden använder, kundreglerna och byråns kontext. Reglerna går före kundens mönster. Innan du anmärker eller samordnar: pröva både de nuvarande raderna och linjen du vill samordna efter mot kontots regler — "Använd när", "Använd INTE när", beslutsregler och momsregler. Att raderna konterats olika kan ha en förklaring i reglerna (till exempel att pant på engångsförpackningar följer drycken medan returlådor är momsfria) — då är det ingen avvikelse. Strider en rad mot reglerna är det reglerna som är linjen, inte hur de flesta rader ligger.

Varje transaktion har konterats med originalunderlaget framför sig — kvittot, fakturan — och momsen på underlaget står vid raden. Anmärk inte på sådant som bara skulle kräva att någon tittar på originalet, till exempel om fakturan verkligen anger moms: det har konteringen redan sett. Anmärk på det som syns när kundens transaktioner läses tillsammans.

Anmärk bara på det som sannolikt är fel eller som en människa bör titta på. Inga anmärkningar alls är ett bra svar när allt ser rimligt ut. Varje anmärkning: en eller två meningar på svenska som säger vad som ser fel ut och vad som troligen är rätt, med raderna det gäller (numren, utan K). Har en transaktion inget konto än är den inte konterad — anmärk inte på det.

atgard avgör vad som händer med raderna:
- "samordna" när likadana köp har konterats olika och kundens egna transaktioner visar vilken linje som är rimlig — oftast hur de flesta liknande raderna redan ligger — och linjen stämmer med reglerna. Samordna också rader som bryter mot reglerna, mot det reglerna säger. Ange i rader bara de rader som avviker och ska konteras om, inte de som redan följer linjen. Skriv i instruktion vad konteringen ska göra och varför, med hänvisning till raderna, t.ex. "Kundens övriga småköp av fika och pålägg hos Coop (K31, K37) ligger på 4000 som varuinköp. Behandla det här köpet likadant om inget i underlaget talar emot det." Instruktionen läses av konteringen för varje rad för sig, så den ska gå att förstå utan din anmärkning. Samordna bara när du kan peka på ett mönster i kundens transaktioner — inte för att du tycker att något borde vara annorlunda.
- "granska" bara när just de raderna är tydligt fel och det inte går att rätta med ett mönster: fel moms, en trolig dubblett, en post som uppenbart inte kan höra till verksamheten (t.ex. cigaretter eller kläder bokförda som varuinköp).

En rad där modellerna är oense och den ena följer kundens linje är ett typiskt fall för samordna.

Är något en bedömningsfråga — ett litet köp som kan vara privat eller höra till verksamheten, något som kan konteras på två rimliga sätt — och har kundens liknande köp redan en linje, så samordna efter den linjen. Fråga inte kunden och skicka det inte till granskning: byrån vill att småsaker behandlas konsekvent, inte att varje osäkerhet granskas. Välj den linje de flesta liknande raderna redan följer, och säg i instruktionen att det är därför.
- "anteckning" för principfrågor där det inte finns någon tydlig linje att följa, och för sådant som gäller kunden i stort — att underlag saknas, att intäkter inte finns. Det stoppar inte bokföringen.
instruktion är en tom sträng utom vid samordna.

sammanfattning: två eller tre meningar om hur kundens bokföring ser ut i stort.`;

export type Atgard = 'granska' | 'samordna' | 'anteckning';

export interface Helhet {
  sammanfattning: string;
  /** `granska` finns kvar för äldre kontroller, där det var den enda åtgärden. */
  anmarkningar: { rader: number[]; text: string; atgard: Atgard; granska: boolean; instruktion: string }[];
  /** Transaktionerna som fick en flagga. */
  flaggade: number;
  /** Transaktionerna som ska konteras om med kontrollens instruktion, per underlag. */
  samordna: { underlagId: string; transaktionIds: string[] }[];
}

/** Namnet på kontrollens instruktioner i `flodes_instruktioner`, så att de kan ersättas. */
export const HELHET_NAMN = 'Helhetskontrollen';

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
  const [arslista, kundbild, { data: profil }, instruktioner] = await Promise.all([
    hamtaArslista(supabase, userId),
    hamtaKundbild(supabase, userId),
    supabase.from('profiles').select(KUND_KOLUMNER).eq('id', userId).maybeSingle(),
    hamtaInstruktioner(supabase, { userId }),
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
    // En del per konto, så att en uppdelning syns — 4000 + 2013 är inte samma sak som 4000
    const kontering = (konto: string | null, momssats: number, momsdelar: ReturnType<typeof rensaMomsdelar>) => {
      if (!konto) return '—';
      const konton = [...new Set((momsdelar ?? []).map((d) => d.konto).filter((x): x is string => !!x))];
      const namn = (konton.length > 1 ? konton : [konto]).map((x) => `${x} ${slaUppKonto(x)?.namn ?? ''}`.trim()).join(' + ');
      return `${namn}, moms ${momsText(momssats, momsdelar)}`;
    };
    // Oense modeller visas med båda förslagen, så att kontrollen kan samordna efter kundens linje
    const vad = slutlig
      ? kontering(slutlig.konto, slutlig.momssats, slutlig.momsdelar)
      : k.length > 1
        ? k.map((x) => `${MODELLNAMN[x.modell] ?? x.modell}: ${kontering(x.konto, Number(x.momssats ?? 0), rensaMomsdelar(x.momsdelar))}`).join(' / ')
        : k[0] ? kontering(k[0].konto, Number(k[0].momssats ?? 0), rensaMomsdelar(k[0].momsdelar)) : '—';
    const kalla = r.kalla === 'bank' ? 'bankrad' : r.kalla === 'woocommerce' ? 'webbutik' : arslista.filnamn.get(r.underlag_id ?? '') ?? 'fil';
    const underlagsmoms = Number(r.moms) ? ` (moms på underlaget ${Number(r.moms)} kr)` : '';
    return `K${i + 1} ${r.datum ?? 'okänt datum'} ${r.riktning === 'in' ? 'IN ' : 'UT '} ${Number(r.belopp)} ${r.valuta || 'SEK'}${underlagsmoms} · ${r.motpart || '—'} · ${(r.beskrivning ?? '').slice(0, 80)} · ${kalla.slice(0, 40)} → ${vad} (${lage})`;
  });

  // Hela regeltexten för kontona kunden använder. Gränsprövningarna gäller en
  // enskild transaktion och räknas inte här.
  const anvanda = new Set<string>();
  for (const k of konteringar) {
    if (k.konto) anvanda.add(k.konto);
    for (const d of rensaMomsdelar(k.momsdelar) ?? []) if (d.konto) anvanda.add(d.konto);
  }
  for (const r of arslista.rader) if (r.vald_kontering?.konto) anvanda.add(r.vald_kontering.konto);
  const kontoregler = [...anvanda].filter((k) => slaUppKonto(k)).sort()
    .map((k) => kontoBlock({ ...provaKonto({ konto: k, netto: 0, brutto: 0, datum: null }), gransprovningar: [] }))
    .join('\n\n---\n\n');
  // Byråns kontext för kunden och alla kunder — inte den på enskilda transaktioner, och inte kontrollens egen
  const byransKontext = instruktioner
    .filter((i) => i.typ === 'kontext' && (i.omfang === 'kund' || i.omfang === 'alla') && i.namn !== HELHET_NAMN)
    .map((i) => `- (${i.omfang === 'alla' ? 'alla kunder' : 'kunden'}) ${i.text}`).join('\n');

  const { data } = await fraga<{ sammanfattning: string; anmarkningar: { rader: number[]; text: string; atgard: string; instruktion: string }[] }>(MODELL, {
    system: { fast: `${FAST}\n\nK1-KONTOPLAN (konto namn — beskrivning [sökord]):\n${kontolista()}`, kund: '' },
    user: [
      byggKundkontext(profil as unknown as Kund | null),
      kundbild ? `KUNDBILDEN:\n${kundbild}` : '',
      kontoregler ? `REGLERNA FÖR KONTONA KUNDEN ANVÄNDER:\n\n${kontoregler}` : '',
      `KUNDREGLER:\n${reglerAttValja(reglerFor(instruktioner, userId))}`,
      byransKontext ? `BYRÅNS KONTEXT FÖR KUNDEN:\n${byransKontext}` : '',
      `KUNDENS TRANSAKTIONER MED KONTERING (${rader.length} st, äldst först):\n${rader.join('\n')}`,
    ].filter(Boolean).join('\n\n'),
    namn: 'helhet',
    schema: SCHEMA,
  });
  const anmarkningar = (Array.isArray(data.anmarkningar) ? data.anmarkningar : [])
    .map((a) => {
      const instruktion = String(a.instruktion ?? '').trim();
      // Samordna utan instruktion går inte att kontera om med — då är det en anteckning
      const atgard: Atgard = a.atgard === 'granska' ? 'granska' : a.atgard === 'samordna' && instruktion ? 'samordna' : 'anteckning';
      return {
        rader: (Array.isArray(a.rader) ? a.rader : []).filter((n) => Number.isInteger(n) && n >= 1 && n <= arslista.rader.length),
        text: String(a.text ?? '').trim(),
        atgard,
        granska: atgard === 'granska',
        instruktion: atgard === 'samordna' ? instruktion : '',
      };
    })
    .filter((a) => a.text);

  // Förra kontrollens instruktioner ersätts av den här kontrollens
  const { error: rFel } = await supabase.from('flodes_instruktioner').delete().eq('user_id', userId).eq('namn', HELHET_NAMN);
  if (rFel) throw new Error(`Kunde inte ta bort förra kontrollens instruktioner: ${rFel.message}`);
  const perUnderlag = new Map<string, string[]>();
  const nyaInstruktioner = anmarkningar.filter((a) => a.atgard === 'samordna').flatMap((a) => a.rader.flatMap((n) => {
    const r = arslista.rader[n - 1];
    // En instruktion på en transaktion hör till dess underlag. Bokförda och rader utan fil konteras inte om härifrån.
    if (bokforda.has(r.id) || !r.underlag_id) return [];
    if (!perUnderlag.get(r.underlag_id)?.includes(r.id)) perUnderlag.set(r.underlag_id, [...(perUnderlag.get(r.underlag_id) ?? []), r.id]);
    return [{ typ: 'kontext', omfang: 'transaktion', steg: 'konteras', user_id: userId, underlag_id: r.underlag_id, transaktion_id: r.id, namn: HELHET_NAMN, text: a.instruktion }];
  }));
  if (nyaInstruktioner.length) {
    const { error: iFel } = await supabase.from('flodes_instruktioner').insert(nyaInstruktioner);
    if (iFel) throw new Error(`Kunde inte spara kontrollens instruktioner: ${iFel.message}`);
  }

  // Förra kontrollens flaggor tas bort först, så att en rättad rad inte ligger kvar som anmärkt
  const perTransaktion = new Map<string, string[]>();
  // Bara anmärkningar om troliga fel flaggar raderna — principfrågor blir anteckningar
  for (const a of anmarkningar.filter((x) => x.atgard === 'granska')) {
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

  const helhet: Helhet = {
    sammanfattning: String(data.sammanfattning ?? ''),
    anmarkningar,
    flaggade: perTransaktion.size,
    samordna: [...perUnderlag].map(([underlagId, transaktionIds]) => ({ underlagId, transaktionIds })),
  };
  await supabase.from('kundbilder').upsert({ user_id: userId, helhet, helhet_at: new Date().toISOString(), helhet_fel: null }, { onConflict: 'user_id' });
  return helhet;
}
