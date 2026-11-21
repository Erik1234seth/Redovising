import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { synkaBank } from '@/lib/bank/sync';
import { bankFalt } from '@/lib/bank/falt';
import type { EbTransaktion } from '@/lib/bank/enablebanking';
import { HAMTA_FEL, kundfel } from '@/lib/bank/kundfel';

/**
 * GET: kundens bankkopplingar, konton och de senaste transaktionerna.
 * GET ?alla=1: alla kundens hämtade banktransaktioner, nyast först.
 * POST: hämta nu, i stället för att vänta på morgonens körning.
 */

export const maxDuration = 300;

const KOLUMNER = 'transaktion_id, konto_hash, bokforingsdag, belopp_ore, valuta, text, motpart, data';

interface Rad {
  transaktion_id: string;
  konto_hash: string;
  bokforingsdag: string;
  belopp_ore: number;
  valuta: string;
  text: string | null;
  motpart: string | null;
  data: EbTransaktion | null;
}

type EgnaKonton = Map<string, string | null>;

/** Raden utan bankens råsvar, med det banken skickat utöver det vanliga i egna fält. */
function utRad({ data, ...r }: Rad, egna: EgnaKonton) {
  const falt = data ? bankFalt(data, egna.get(r.konto_hash)) : {};
  return { ...r, motpart: r.motpart ?? falt.motpart_namn ?? null, falt };
}

function egnaKonton(konton: { konto_hash: string; iban: string | null }[] | null): EgnaKonton {
  return new Map((konton ?? []).map((k) => [k.konto_hash, k.iban]));
}

async function allaTransaktioner(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data: konton } = await supabase.from('bank_konton').select('konto_hash, iban').eq('user_id', userId);
  const egna = egnaKonton(konton);
  const out: ReturnType<typeof utRad>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('bank_transaktioner')
      .select(KOLUMNER)
      .eq('user_id', userId)
      .order('bokforingsdag', { ascending: false })
      .order('transaktion_id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data as Rad[]).map((r) => utRad(r, egna)));
    if (data.length < 1000) return out;
  }
}

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const supabase = createServerClient();
  if (new URL(request.url).searchParams.get('alla')) {
    try {
      return NextResponse.json({ transaktioner: await allaTransaktioner(supabase, user.id) });
    } catch (err) {
      console.error('[bank] alla transaktioner', err);
      return NextResponse.json({ error: 'Kunde inte läsa transaktionerna' }, { status: 500 });
    }
  }

  const [kopplingar, konton, senaste] = await Promise.all([
    supabase
      .from('bank_kopplingar')
      .select('session_id, aspsp_name, status, giltig_till, kopplad_at, senast_synkad_at, senaste_fel')
      .eq('user_id', user.id)
      .order('kopplad_at'),
    supabase.from('bank_konton').select('konto_hash, session_id, iban, namn, valuta').eq('user_id', user.id),
    supabase
      .from('bank_transaktioner')
      .select(KOLUMNER)
      .eq('user_id', user.id)
      .order('bokforingsdag', { ascending: false })
      .order('transaktion_id')
      .limit(10),
  ]);
  if (kopplingar.error || konton.error || senaste.error) {
    return NextResponse.json({ error: 'Kunde inte läsa bankkopplingen' }, { status: 500 });
  }

  return NextResponse.json({
    kopplingar: (kopplingar.data ?? []).map((k) => ({
      ...k,
      senaste_fel: kundfel(k.senaste_fel),
      konton: (konton.data ?? []).filter((a) => a.session_id === k.session_id),
    })),
    senaste: ((senaste.data ?? []) as Rad[]).map((r) => utRad(r, egnaKonton(konton.data))),
  });
}

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  try {
    const svar = await synkaBank(createServerClient(), user.id);
    // Felen sparas i senaste_fel för byrån; kunden får en kort förklaring utan teknik
    if (svar.fel.length) console.error('[bank] synk', user.id, svar.fel);
    return NextResponse.json({ ...svar, fel: [...new Set(svar.fel.map(kundfel).filter(Boolean))] });
  } catch (err) {
    console.error('[bank] synk', err);
    return NextResponse.json({ error: HAMTA_FEL }, { status: 500 });
  }
}
