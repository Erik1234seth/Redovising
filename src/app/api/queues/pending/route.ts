import { handleCallback, send } from '@vercel/queue';
import { createClient } from '@supabase/supabase-js';
import { PENDING_AMNE, korOmPending, type PendingMeddelande } from '@/lib/kontering/pending';

/**
 * Konterar om en kunds pending transaktioner ur kön (ämnet pending, kopplat i
 * vercel.json). Kvällsjobbet /api/cron/pending lägger en kund i taget här.
 * Får inte alla plats i ett anrop läggs resten i kön igen, med sina id, så
 * att ingen funktion anropar en annan i kedja.
 *
 * Ett undantag betyder att funktionen dog (t.ex. tog slut på tid). Då
 * försöker vi en gång till. De som redan konterats om har ny provad_at och
 * tas inte igen.
 */
export const maxDuration = 300;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export const POST = handleCallback<PendingMeddelande>(
  async ({ userId, ids }) => {
    const utfall = await korOmPending(getSupabase(), userId, { startad: Date.now(), ids });
    console.log('[queues/pending]', userId, JSON.stringify({ ...utfall, rest: utfall.rest.length }));
    if (utfall.rest.length) await send<PendingMeddelande>(PENDING_AMNE, { userId, ids: utfall.rest });
  },
  {
    retry: (_err, metadata) => (metadata.deliveryCount >= 2 ? { acknowledge: true } : { afterSeconds: 30 }),
  },
);
