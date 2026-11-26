import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { synkaBank, valjKonto } from '@/lib/bank/sync';
import { bankFalt } from '@/lib/bank/falt';
import type { EbTransaktion } from '@/lib/bank/enablebanking';
import { HAMTA_FEL, kundfel } from '@/lib/bank/kundfel';

/**
 * GET: kundens bankkopplingar, konton och de senaste transaktionerna.
 * GET ?alla=1: alla kundens hämtade banktransaktioner, nyast först.
 * POST: hämta nu, i stället för att vänta på morgonens körning.
 */

export const maxDuration = 300;

/** Så långt bakåt Hämta nu går. */
const HAMTA_NU_DAGAR = 90;

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
  const { data: konton } = await supabase.from('bank_konton').select('konto_hash, iban, vald').eq('user_id', userId);
  const egna = egnaKonton(konton);
  // Bara valda konton, så ett bortvalt privatkonto inte syns hos kunden
  const valda = (konton ?? []).filter((k) => k.vald).map((k) => k.konto_hash);
  const out: ReturnType<typeof utRad>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('bank_transaktioner')
      .select(KOLUMNER)
      .eq('user_id', userId)
      .in('konto_hash', valda.length ? valda : [''])
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

  const [kopplingar, konton] = await Promise.all([
    supabase
      .from('bank_kopplingar')
      .select('session_id, aspsp_name, status, giltig_till, kopplad_at, senast_synkad_at, senaste_fel')
      .eq('user_id', user.id)
      .order('kopplad_at'),
    supabase.from('bank_konton').select('konto_hash, session_id, iban, namn, valuta, vald').eq('user_id', user.id).order('namn'),
  ]);
  // Bara valda konton, så ett bortvalt privatkonto inte syns här
  const valda = (konton.data ?? []).filter((k) => k.vald).map((k) => k.konto_hash);
  const senaste = await supabase
    .from('bank_transaktioner')
    .select(KOLUMNER)
    .eq('user_id', user.id)
    .in('konto_hash', valda.length ? valda : [''])
    .order('bokforingsdag', { ascending: false })
    .order('transaktion_id')
    .limit(10);
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

/** PATCH { konto_hash, vald, rensa? }: kunden väljer vilka konton vi läser. */
export async function PATCH(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.konto_hash !== 'string' || typeof body.vald !== 'boolean') {
    return NextResponse.json({ error: 'konto_hash och vald krävs' }, { status: 400 });
  }
  try {
    return NextResponse.json(await valjKonto(createServerClient(), user.id, body.konto_hash, body.vald, body.rensa === true));
  } catch (err) {
    console.error('[bank] välj konto', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Kunde inte spara valet' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  try {
    // Hämta nu går 90 dagar bakåt; morgonens synk bara några dagar före förra hämtningen
    const svar = await synkaBank(createServerClient(), user.id, { dagarBakat: HAMTA_NU_DAGAR });
    // Felen sparas i senaste_fel för byrån; kunden får en kort förklaring utan teknik
    if (svar.fel.length) console.error('[bank] synk', user.id, svar.fel);
    return NextResponse.json({ ...svar, fel: [...new Set(svar.fel.map(kundfel).filter(Boolean))] });
  } catch (err) {
    console.error('[bank] synk', err);
    return NextResponse.json({ error: HAMTA_FEL }, { status: 500 });
  }
}
