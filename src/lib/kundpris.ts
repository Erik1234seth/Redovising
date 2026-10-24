import type { SupabaseClient } from '@supabase/supabase-js';
import { packages } from '@/data/packages';

/**
 * Kundens eget pris. Priset låses i subscriptions.pris_kr när kunden skriver
 * upp sig, så att en prishöjning bara gäller nya kunder. Månadskunder ligger
 * kvar på sitt gamla Stripe-pris, årskunder faktureras med beloppet här.
 */
export interface Kundpris {
  pris_kr: number;
  billing_period: 'monthly' | 'yearly';
}

/** "399 kr/mån" eller "4 788 kr/år". Alla priser är exklusive moms. */
export function formateraPris(pris_kr: number, billing_period: string): string {
  const belopp = pris_kr.toLocaleString('sv-SE').replace(/\s/g, ' ');
  return billing_period === 'yearly' ? `${belopp} kr/år` : `${belopp} kr/mån`;
}

/** Kundens låsta pris, eller dagens pris om abonnemanget saknar ett. */
export function kundensPris(sub: { pris_kr: number | null; billing_period: string }): number {
  return sub.pris_kr ?? (sub.billing_period === 'yearly' ? packages[0].yearlyPrice : packages[0].price);
}

/**
 * Hämtar kundens pris. Månadskunden hittas via Stripe-prenumerationen på
 * profilen, årskunden via det syntetiska id:t som yearly-signup skapar.
 */
export async function hamtaKundpris(supabase: SupabaseClient, userId: string): Promise<Kundpris | null> {
  const { data: p } = await supabase
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .single();

  const ids = [`yearly_${userId}`, p?.stripe_subscription_id].filter(Boolean) as string[];
  const { data } = await supabase
    .from('subscriptions')
    .select('pris_kr, billing_period')
    .in('stripe_subscription_id', ids)
    .not('pris_kr', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? { pris_kr: data.pris_kr, billing_period: data.billing_period } : null;
}

/** Raden om priset i AI:ns kunduppgifter, eller null om kunden saknar abonnemang. */
export function kundprisRad(kundpris: Kundpris | null): string | null {
  if (!kundpris) return null;
  const period = kundpris.billing_period === 'yearly' ? 'årsvis' : 'månadsvis';
  return `- Kundens pris: ${formateraPris(kundpris.pris_kr, kundpris.billing_period)} exkl. moms (betalar ${period}). Det här är priset kunden har, även om det skiljer sig från priset i Del 1.`;
}
