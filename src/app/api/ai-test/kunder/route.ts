import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { KUND_KOLUMNER, byggKundkontext, type Kund } from '@/lib/ai-test/kundkontext';

/**
 * Kundlistan till AI-testsidan: profiler med sin verksamhetsbeskrivning, så
 * du kan välja vilken kund analysen ska köras "som".
 *
 * Endast dev — listan innehåller kunduppgifter.
 */

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'AI-testet är bara tillgängligt lokalt' }, { status: 404 });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('profiles')
      .select(KUND_KOLUMNER)
      .order('company_name', { ascending: true, nullsFirst: false });

    if (error) throw new Error(error.message);

    const kunder = ((data ?? []) as unknown as Kund[]).map((k) => ({
      ...k,
      kontext: byggKundkontext(k),
    }));

    return NextResponse.json({ kunder });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ett oväntat fel inträffade';
    console.error('Error in GET /api/ai-test/kunder:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
