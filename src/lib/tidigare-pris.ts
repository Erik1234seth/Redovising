import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Det tidigare priset, för dem som hade kontakt med oss innan priset höjdes.
 *
 * Det finns en enda länk och den gäller för alltid. Den skickas aldrig ut
 * automatiskt — mail- och SMS-AI:n lägger med den när någon med tidigare
 * kontakt frågar om pris. Den som registrerar sig utan länken får dagens pris.
 *
 * Koden i länken är ingen hemlighet, bara svår att gissa. Priset bestäms
 * alltid av servern utifrån profiles.tidigare_pris, aldrig av webbläsaren.
 */
export const TIDIGARE_PRIS_KOD = 'tp7q';

export const TIDIGARE_PRIS = { price: 299, yearlyPrice: 3999 };

export const TIDIGARE_PRIS_LANK = `https://app.enklabokslut.se/auth/signup?p=${TIDIGARE_PRIS_KOD}`;

/** Kontakt före den här dagen ger rätt till det tidigare priset. */
export const PRISHOJNING_DATUM = '2026-10-24';

/** Nyckeln i localStorage på app-subdomänen, från signup fram till betalningen. */
export const TIDIGARE_PRIS_STORAGE = 'tidigarePris';

/**
 * Första gången vi hade kontakt med någon av adresserna: ett mejl åt något
 * håll, formuläret på sajten eller ett utskick. Null om ingen kontakt finns.
 */
export async function forstaKontakt(supabase: SupabaseClient, emails: string[]): Promise<string | null> {
  const adresser = [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
  if (!adresser.length) return null;

  const [mejl, formular, utskick] = await Promise.all([
    supabase.from('mail_messages').select('sent_at, created_at').in('customer_email', adresser)
      .order('sent_at', { ascending: true, nullsFirst: false }).limit(1),
    supabase.from('contact_requests').select('created_at').in('email', adresser)
      .order('created_at', { ascending: true }).limit(1),
    supabase.from('email_log').select('created_at').in('to_email', adresser).neq('status', 'failed')
      .order('created_at', { ascending: true }).limit(1),
  ]);

  const datum = [
    mejl.data?.[0]?.sent_at ?? mejl.data?.[0]?.created_at,
    formular.data?.[0]?.created_at,
    utskick.data?.[0]?.created_at,
  ].filter(Boolean) as string[];
  if (!datum.length) return null;
  return datum.reduce((a, b) => (new Date(a) < new Date(b) ? a : b));
}

/**
 * Regeln till AI:n för en person utan abonnemang. Tom sträng om personen
 * inte hade kontakt före prishöjningen — då nämns varken priset eller länken.
 */
export async function tidigarePrisRegel(supabase: SupabaseClient, emails: string[]): Promise<string> {
  const forsta = await forstaKontakt(supabase, emails).catch(() => null);
  if (!forsta || new Date(forsta) >= new Date(PRISHOJNING_DATUM)) return '';
  return `- Tidigare pris gäller: personen hade kontakt med oss redan ${forsta.slice(0, 10)}, innan priset höjdes ${PRISHOJNING_DATUM}. För personen gäller därför ${TIDIGARE_PRIS.price} kr/mån eller ${TIDIGARE_PRIS.yearlyPrice.toLocaleString('sv-SE').replace(/\s/g, ' ')} kr/år exkl. moms, inte priserna i Del 1. Bara när ett pris är relevant för svaret: ange det här priset, förklara att vi har höjt priset men att det tidigare priset självklart gäller för personen, och att hen behöver registrera sig via den här länken för att få det: ${TIDIGARE_PRIS_LANK} . Använd den länken i stället för den vanliga registreringslänken.`;
}
