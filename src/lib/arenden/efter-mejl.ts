import { after } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { isNoReplyAddress } from '@/lib/inmail/no-reply';
import { profilForAdress } from '@/lib/inmail/profil';
import { skapaArendenFranMeddelande } from './fran-meddelande';
import { kollaArenden } from './ai-koll';

/**
 * Läggs runt /api/inmail och /api/inmail/reply, precis som underlagskvittot:
 * när svaret är klart läses mejlet (och vårt svar) en gång till för att se om
 * det ger något ärende. Görs efter att Apps Script fått sitt svar.
 *
 * `request` måste vara en oläst kopia — routen läser själv originalet.
 */
export function arendenEfterMejl(request: Request, response: Response): void {
  if (request.headers.get('x-inmail-secret') !== process.env.INMAIL_SECRET) return;
  const svar = response.clone();

  after(async () => {
    try {
      const body = await request.json() as {
        senderEmail?: string; messageId?: string; subject?: string; emailBody?: string; emailHistory?: string;
      };
      const email = body.senderEmail?.trim().toLowerCase();
      if (!email || !body.messageId || isNoReplyAddress(email)) return;
      if (!body.emailBody?.trim() && !body.subject?.trim()) return;

      const { replyBody } = await svar.json().catch(() => ({})) as { replyBody?: string };
      const supabase = createServerClient();
      const profil = await profilForAdress(supabase, email);

      await skapaArendenFranMeddelande({
        supabase,
        kanal: 'mejl',
        ref: body.messageId,
        personKey: email,
        personNamn: profil?.full_name?.trim() || null,
        meddelande: [body.subject ? `Ämne: ${body.subject}` : '', body.emailBody ?? ''].filter(Boolean).join('\n'),
        historik: body.emailHistory,
        vartSvar: replyBody ?? null,
      });

      // Mejlet kan också betyda att ett äldre ärende är gjort
      await kollaArenden({ supabase, personKey: email });
    } catch (err) {
      console.error('[arenden] efter mejl:', err instanceof Error ? err.message : err);
    }
  });
}
