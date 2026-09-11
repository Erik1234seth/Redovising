import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Läser in lead-historiken från Gmail (Apps Script: exportLeadsBackfill).
 *
 * Bakgrund: under en period skickade Zapier välkomstmejlet direkt från
 * erik@enklabokslut.se, helt utanför vår kod. Twilio fanns inte med då heller.
 * De leadsen har alltså en rad i contact_requests men ingenting i email_log,
 * och för påminnelsejobbet ser de ut som om vi aldrig hört av oss. Ännu värre:
 * de som faktiskt svarade Erik i Gmail syns inte som svarande någonstans, så
 * utan den här importen hade de riskerat att få en påminnelse om ett samtal de
 * redan har haft.
 *
 * Gmail är den enda källan till sanningen för den perioden. Skriptet går igenom
 * Skickat, plockar ut vem mejlet gick till och om det kom något svar i tråden,
 * och skickar hit paren. Vi skriver ned det i de tabeller som redan finns:
 *
 *  - `email_log` med kind 'lead_valkomst' och mejlets riktiga datum, så att
 *    påminnelsejobbet räknar de två veckorna från rätt dag och tidslinjen i
 *    panelen visar utskicket där det hör hemma.
 *  - `email_threads` med state 'prospect:<adress>' för dem som svarade, vilket
 *    är samma markering mail-AI:n sätter i dag. Den är redan en av spärrarna i
 *    påminnelsejobbet, så de faller bort av sig själva.
 *
 * Inget nytt fält, ingen ny tabell och ingen ändring i påminnelsejobbet:
 * historiken skrivs om till samma form som om vår egen kod hade skickat mejlen.
 *
 * Går att köra om hur många gånger som helst. Dubbletter stoppas på Gmails
 * message_id respektive gmail_thread_id, som båda är stabila.
 */

interface IncomingLeadMail {
  /** Gmails message_id för utskicket. Dubblettspärren. */
  messageId: string;
  gmailThreadId: string;
  /** Adressen mejlet gick till. */
  email: string;
  subject?: string;
  /** När mejlet gick ut, ISO 8601. */
  sentAt: string;
  /** Kom det något svar från mottagaren i tråden? */
  replied: boolean;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-inmail-secret');
    if (secret !== process.env.INMAIL_SECRET) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 });
    }

    const body = (await request.json()) as { mails?: IncomingLeadMail[]; dryRun?: boolean };
    const mails = (body.mails ?? []).filter(
      (m) => m?.messageId && m?.email?.includes('@') && m?.sentAt,
    );

    if (!mails.length) return NextResponse.json({ imported: 0, replies: 0, skipped: 0 });

    const supabase = getSupabase();

    // Dubblettspärr på Gmails message_id, som ligger i provider_id. Adressen
    // duger inte: samma person kan mycket väl ha fått mejlet mer än en gång.
    const ids = mails.map((m) => m.messageId);
    const { data: existing } = await supabase
      .from('email_log')
      .select('provider_id')
      .in('provider_id', ids);
    const alreadyLogged = new Set((existing ?? []).map((r) => r.provider_id as string));

    const fresh = mails.filter((m) => !alreadyLogged.has(m.messageId));

    if (body.dryRun) {
      return NextResponse.json({
        dryRun: true,
        imported: fresh.length,
        replies: fresh.filter((m) => m.replied).length,
        skipped: mails.length - fresh.length,
        sample: fresh.slice(0, 10).map((m) => ({
          email: m.email.trim().toLowerCase(),
          sentAt: m.sentAt,
          replied: m.replied,
        })),
      });
    }

    let imported = 0;
    if (fresh.length) {
      const { error } = await supabase.from('email_log').insert(
        fresh.map((m) => ({
          to_email: m.email.trim().toLowerCase(),
          subject: m.subject || 'Välkomstmejl till lead',
          kind: 'lead_valkomst',
          provider: 'gmail',
          provider_id: m.messageId,
          status: 'sent',
          // Mejlets riktiga datum, inte importens. Annars hade varenda gammalt
          // lead sett ut som nytt och fått vänta två veckor till på sin
          // påminnelse.
          created_at: m.sentAt,
        })),
      );
      if (error) {
        console.error('[leads/import] kunde inte skriva email_log:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      imported = fresh.length;
    }

    // De som svarade märks som prospects, samma markering mail-AI:n sätter.
    // Här räknas alla mejl i importen, inte bara de nya: en tråd kan ha fått
    // sitt svar långt efter att utskicket redan importerats.
    const repliers = mails.filter((m) => m.replied);
    let replies = 0;

    if (repliers.length) {
      const { data: knownThreads } = await supabase
        .from('email_threads')
        .select('gmail_thread_id')
        .in('gmail_thread_id', repliers.map((m) => m.gmailThreadId));
      const known = new Set((knownThreads ?? []).map((t) => t.gmail_thread_id as string));

      const newThreads = repliers.filter((m) => !known.has(m.gmailThreadId));
      if (newThreads.length) {
        const { error } = await supabase.from('email_threads').insert(
          newThreads.map((m) => ({
            gmail_thread_id: m.gmailThreadId,
            state: `prospect:${m.email.trim().toLowerCase()}`,
            // user_id är null: de här personerna har inget konto, och det är
            // hela poängen med prospect-markeringen.
            user_id: null,
          })),
        );
        if (error) {
          console.error('[leads/import] kunde inte skriva email_threads:', error.message);
        } else {
          replies = newThreads.length;
        }
      }
    }

    console.log(`[leads/import] ${imported} utskick, ${replies} svarande, ${alreadyLogged.size} redan kända`);
    return NextResponse.json({
      imported,
      replies,
      skipped: mails.length - fresh.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[leads/import]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
