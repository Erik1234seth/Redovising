import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { underlagAttKora } from '@/lib/kontering/omgang/prov';
import type { FlodeKund } from '@/lib/admin-types';

export const maxDuration = 60;

/**
 * Kunderna till Flöde i toppmenyn: alla med ett konto som skickat in underlag.
 *
 * GET → { kunder: FlodeKund[] }, de med nya underlag först. `nya` räknas som
 * knappen "Kör nya" i Flöde gör (`underlagAttKora`): filer som aldrig körts,
 * eller där kunden skickat något nytt sedan senaste körningen.
 */

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: rader, error } = await supabase
      .from('bokforing_underlag')
      .select('user_id, created_at')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20000);
    if (error) throw new Error(error.message);

    const perKund = new Map<string, { underlag: number; senast: string }>();
    for (const r of rader ?? []) {
      const k = perKund.get(r.user_id);
      if (k) k.underlag += 1;
      else perKund.set(r.user_id, { underlag: 1, senast: r.created_at });
    }
    const ids = [...perKund.keys()];
    if (!ids.length) return NextResponse.json({ kunder: [] });

    const [{ data: profiler }, nya] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, company_name').in('id', ids),
      Promise.all(ids.map((id) => underlagAttKora(supabase, id).then((l) => l.length).catch(() => 0))),
    ]);
    const profil = new Map((profiler ?? []).map((p) => [p.id, p]));

    const kunder: FlodeKund[] = ids.map((userId, i) => {
      const p = profil.get(userId);
      const epost = p?.email?.trim().toLowerCase() || null;
      return {
        userId,
        key: epost ? `e:${epost}` : null,
        namn: p?.full_name?.trim() || p?.company_name?.trim() || epost || 'Okänd kund',
        epost,
        underlag: perKund.get(userId)!.underlag,
        nya: nya[i],
        senast: perKund.get(userId)!.senast,
      };
    });
    kunder.sort((a, b) => Number(b.nya > 0) - Number(a.nya > 0) || b.senast.localeCompare(a.senast));
    return NextResponse.json({ kunder });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internt fel' }, { status: 500 });
  }
}
