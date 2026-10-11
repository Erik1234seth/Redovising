import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProfilForAdress {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

/**
 * Kontot bakom en mejladress: profilen med adressen, annars den profil som
 * adressen kopplats till för hand i personvyn (person_aliases).
 *
 * Alla vägar som tar emot mejl ska slå upp avsändaren här. Förut gjorde bara
 * /api/inmail det med kopplingen, medan /api/inmail/reply bara sökte på
 * adressen — så en kund som svarade från sin andra adress fick "vi kunde
 * inte hitta något konto" fast adressen var kopplad.
 */
export async function profilForAdress(supabase: SupabaseClient, email: string): Promise<ProfilForAdress | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;

  const { data: direkt } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .ilike('email', e)
    .limit(1)
    .maybeSingle();
  if (direkt) return direkt;

  const { data: alias } = await supabase
    .from('person_aliases')
    .select('user_id')
    .eq('alias_email', e)
    .not('user_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (!alias?.user_id) return null;

  const { data: kopplad } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('id', alias.user_id)
    .maybeSingle();
  if (kopplad) console.log(`[inmail] ${e} är en kopplad adress till ${kopplad.email}`);
  return kopplad ?? null;
}
