import type { SupabaseClient } from '@supabase/supabase-js';
import type { InlamningKund } from '@/lib/admin-types';

/**
 * Lägger till flaggor om bokföringen i varje period: ingen bokföring alls,
 * verifikationer som inte går jämnt ut, och transaktioner som inte bokförts.
 */
export async function flaggaBokforing(supabase: SupabaseClient, kunder: InlamningKund[]) {
  const alla = kunder.flatMap((k) => k.perioder);
  if (!alla.length) return;
  const fran = alla.reduce((m, p) => (p.fran < m ? p.fran : m), alla[0].fran);
  const tom = alla.reduce((m, p) => (p.tom > m ? p.tom : m), alla[0].tom);
  const ids = kunder.map((k) => k.profileId);
  const mejl = kunder.map((k) => k.email?.toLowerCase()).filter((e): e is string => !!e);

  const agare = (rad: { user_id: string | null; customer_email: string | null }) =>
    kunder.find((k) => k.profileId === rad.user_id || (!!rad.customer_email && k.email?.toLowerCase() === rad.customer_email.toLowerCase()));
  const filter = [
    `user_id.in.(${ids.join(',')})`,
    ...(mejl.length ? [`customer_email.in.(${mejl.map((e) => `"${e}"`).join(',')})`] : []),
  ].join(',');

  const ver: { user_id: string | null; customer_email: string | null; datum: string | null; balanserad: boolean; transaktion_id: string | null }[] = [];
  const tr: { id: string; user_id: string | null; customer_email: string | null; datum: string | null; dublett_av: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('verifikationer')
      .select('user_id, customer_email, datum, balanserad, transaktion_id')
      .or(filter).gte('datum', fran).lte('datum', tom).range(from, from + 999);
    if (error) throw new Error(`Kunde inte läsa verifikationer: ${error.message}`);
    ver.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('transaktioner')
      .select('id, user_id, customer_email, datum, dublett_av')
      .or(filter).gte('datum', fran).lte('datum', tom).range(from, from + 999);
    if (error) throw new Error(`Kunde inte läsa transaktioner: ${error.message}`);
    tr.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const bokforda = new Set(ver.map((v) => v.transaktion_id).filter(Boolean));

  for (const k of kunder) {
    const minaV = ver.filter((v) => agare(v) === k);
    const minaT = tr.filter((t) => agare(t) === k && !t.dublett_av);
    for (const p of k.perioder) {
      const iP = <T extends { datum: string | null }>(r: T) => !!r.datum && r.datum >= p.fran && r.datum <= p.tom;
      const v = minaV.filter(iP);
      const t = minaT.filter(iP);
      p.antalVerifikationer = v.length;
      p.antalTransaktioner = t.length;
      if (!v.length) p.flaggor.push('Ingen bokföring i perioden');
      const obal = v.filter((x) => !x.balanserad).length;
      if (obal) p.flaggor.push(`${obal} ${obal === 1 ? 'verifikation går' : 'verifikationer går'} inte jämnt ut`);
      // Jämförelsen håller bara när perioden bokförs via konteringen, som
      // kopplar verifikationen till transaktionen. Verifikationer ur SIE eller
      // den äldre AI-inläsningen saknar kopplingen och hade gett falskt larm.
      const viaKontering = v.some((x) => x.transaktion_id);
      const ej = viaKontering || !v.length ? t.filter((x) => !bokforda.has(x.id)).length : 0;
      if (ej) p.flaggor.push(`${ej} ${ej === 1 ? 'transaktion' : 'transaktioner'} inte bokförda`);
    }
  }
}
