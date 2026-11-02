import { handleCallback } from '@vercel/queue';
import { createClient } from '@supabase/supabase-js';
import { korUnderlagsomgang, type UnderlagsMeddelande } from '@/lib/underlag-kontroll';

/**
 * Kör en omgång av underlagsflödet ur kön (ämnet underlagsflode, kopplat i
 * vercel.json). Varje omgång lägger själv nästa i kön, så att ingen funktion
 * anropar en annan i kedja — det stoppar Vercel efter några led.
 *
 * korUnderlagsomgang kastar inte: går något fel skriver den ett reservutkast i
 * inkorgen. Ett undantag här betyder alltså att funktionen dog (t.ex. tog
 * slut på tid), och då försöker vi en gång till. Mer än så ger dubbla utkast
 * snarare än ett bättre resultat.
 */
export const maxDuration = 300;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export const POST = handleCallback<UnderlagsMeddelande>(
  async ({ bas, jobb }) => {
    await korUnderlagsomgang(getSupabase(), bas, jobb);
  },
  {
    retry: (_err, metadata) => (metadata.deliveryCount >= 2 ? { acknowledge: true } : { afterSeconds: 30 }),
  },
);
