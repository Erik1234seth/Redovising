import type { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON } from '@/lib/inmail/openai-client';

/**
 * Läser ett inkommande mejl eller SMS och skapar ärenden för det vi behöver
 * göra senare — påminna kunden, höra av oss igen, skicka något ett visst
 * datum. Ärendena läggs in direkt, utan godkännande, och går att ändra på
 * Ärenden-sidan.
 *
 * Körs efter att svaret skrivits och får aldrig stoppa det: allt fel loggas
 * och sväljs.
 */

const MODELL = 'gpt-5.5';

interface Forslag { titel: string; beskrivning?: string; datum?: string | null }

const PROMPT = (idag: string) => `Du hjälper en redovisningsbyrå (Enkla Bokslut, bokföring och bokslut åt enskilda firmor) att hålla koll på saker de behöver göra SENARE.

Du får ett inkommande meddelande från en kund eller ett lead, tidigare konversation och ibland det svar vi tänker skicka.
Avgör om meddelandet kräver att byrån gör något vid en senare tidpunkt. Påminnelser till kunden är det vanligaste. Exempel:
- Kunden säger att underlaget kommer nästa vecka → "Påminn kunden om underlaget" med datum när det borde ha kommit.
- Kunden lovar att göra något (skicka kvitton, kontoutdrag, uppgifter, lägga in oss som deklarationsombud hos Skatteverket, betala) → "Påminn kunden om …" några dagar efter att det borde vara gjort.
- Vi ber kunden om något i vårt svar (underlag, en uppgift, ett svar på en fråga, att lägga in oss som ombud) → "Påminn kunden om …" om 3–5 dagar, ifall de inte hör av sig.
- Kunden nämner en deadline eller ett datum som rör deras bokföring eller deklaration → påminn i god tid före.
- Kunden ber oss höra av oss efter semestern / i januari / om en månad.
- Leadet vill tänka på saken → "Följ upp" om ungefär en vecka.
- Vi lovar i svaret att återkomma, kontrollera något eller skicka något.
- Kunden ber om ett samtal eller möte som inte redan är bokat.

Skapa INGA ärenden för sådant som besvaras direkt i svaret, för vanliga frågor, tack eller hälsningar.
De flesta meddelanden ger inga ärenden alls. Hellre ett för lite än ett onödigt.

Dagens datum: ${idag}. Räkna ut datum som YYYY-MM-DD. Saknas en tidpunkt, välj en rimlig (oftast 3–7 dagar fram).

Svara med JSON: {"arenden": [{"titel": "kort, börjar med ett verb — t.ex. 'Påminn kunden om kontoutdragen'", "beskrivning": "en eller två meningar: vad vi väntar på eller ska göra, och varför", "datum": "YYYY-MM-DD"}]}
Tom lista om inget behöver göras.`;

export async function skapaArendenFranMeddelande(opts: {
  supabase: SupabaseClient;
  kanal: 'mejl' | 'sms';
  /** Meddelandets id (Gmail message id eller sms_messages-id), så att samma meddelande inte ger dubbletter. */
  ref: string;
  personKey: string;
  personNamn: string | null;
  meddelande: string;
  historik?: string;
  vartSvar?: string | null;
}): Promise<void> {
  try {
    const idag = new Date().toISOString().slice(0, 10);
    const delar = [
      opts.personNamn ? `Avsändare: ${opts.personNamn} (${opts.personKey})` : `Avsändare: ${opts.personKey}`,
      `Kanal: ${opts.kanal}`,
      opts.historik?.trim() ? `Tidigare konversation:\n${opts.historik.trim().slice(-6000)}` : '',
      `Inkommande meddelande:\n${opts.meddelande.trim().slice(0, 4000)}`,
      opts.vartSvar?.trim() ? `Vårt svar (utkast):\n${opts.vartSvar.trim().slice(0, 3000)}` : '',
    ].filter(Boolean).join('\n\n');

    const raw = await callOpenAI({
      model: MODELL,
      messages: [
        { role: 'system', content: PROMPT(idag) },
        { role: 'user', content: delar },
      ],
      responseFormat: { type: 'json_object' },
      maxTokens: 4000,
    });

    const forslag = (parseJSON<{ arenden?: Forslag[] }>(raw).arenden ?? [])
      .filter((a) => a?.titel?.trim())
      .slice(0, 3);
    if (!forslag.length) return;

    const giltigt = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
    const { error } = await opts.supabase.from('arenden').upsert(
      forslag.map((a) => ({
        titel: a.titel.trim().slice(0, 200),
        beskrivning: a.beskrivning?.trim() || null,
        datum: giltigt(a.datum),
        person_key: opts.personKey,
        person_namn: opts.personNamn,
        kalla: opts.kanal,
        kalla_ref: opts.ref,
      })),
      { onConflict: 'kalla,kalla_ref,titel', ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    console.log(`[arenden] ${forslag.length} ärende(n) från ${opts.kanal} ${opts.personKey}`);
  } catch (err) {
    console.error('[arenden] kunde inte skapa ärenden:', err instanceof Error ? err.message : err);
  }
}
