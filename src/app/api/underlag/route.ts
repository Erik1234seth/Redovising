import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { arVarAdress } from '@/lib/underlag/var-fil';

/**
 * GET: kundens alla underlag, nyast först, för sidan Underlag.
 *
 * Ett dokument som skickats som flera bilder (del_av) visas som ett, med
 * antal sidor. Sparade mejl (message/rfc822) är byråns kontext och visas inte.
 * Varje fil får en signerad länk som gäller en timme, så att bilderna går att
 * visa direkt och PDF:erna att öppna utan att gå via servern.
 *
 * Belopp, datum och motpart kommer från transaktionerna vi läst ur filen.
 * Status: Bokförd när det finns en verifikation, annars Mottaget.
 */
export const maxDuration = 60;

const BUCKET = 'bokforing-underlag';
const LANK_GILTIG_S = 60 * 60;

interface Fil {
  id: string;
  file_name: string;
  file_path: string | null;
  mime_type: string | null;
  created_at: string;
  source: string | null;
  sortering: string | null;
  del_av: string | null;
  sender_email: string | null;
}

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const supabase = createServerClient();
  try {
    const filer: Fil[] = [];
    for (let fran = 0; ; fran += 1000) {
      const { data, error } = await supabase.from('bokforing_underlag')
        .select('id, file_name, file_path, mime_type, created_at, source, sortering, del_av, sender_email')
        .eq('user_id', user.id).order('created_at', { ascending: false }).order('id').range(fran, fran + 999);
      if (error) throw new Error(error.message);
      filer.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
    // Sparade mejl och bilagor i mejl vi själva skickat är inte kundens underlag
    const synliga = filer.filter((f) => !(f.mime_type ?? '').startsWith('message/') && !arVarAdress(f.sender_email));
    const huvud = synliga.filter((f) => !f.del_av);
    const sidor = new Map<string, number>();
    for (const f of synliga) if (f.del_av) sidor.set(f.del_av, (sidor.get(f.del_av) ?? 0) + 1);

    // Transaktionerna ur varje fil, och om de är bokförda
    const idn = huvud.map((f) => f.id);
    const transaktioner: {
      id: string; underlag_id: string; datum: string | null; belopp: number; valuta: string | null; riktning: string;
      motpart: string | null; beskrivning: string | null; uppgifter: Record<string, unknown> | null;
    }[] = [];
    const bokfordaFiler = new Set<string>();
    for (let i = 0; i < idn.length; i += 200) {
      const del = idn.slice(i, i + 200);
      const [t, v] = await Promise.all([
        supabase.from('transaktioner').select('id, underlag_id, datum, belopp, valuta, riktning, motpart, beskrivning, uppgifter').in('underlag_id', del).is('dublett_av', null),
        supabase.from('verifikationer').select('underlag_id').in('underlag_id', del),
      ]);
      transaktioner.push(...(t.data ?? []));
      for (const r of v.data ?? []) if (r.underlag_id) bokfordaFiler.add(r.underlag_id);
    }
    const tIdn = transaktioner.map((t) => t.id);
    for (let i = 0; i < tIdn.length; i += 200) {
      const { data } = await supabase.from('verifikationer').select('transaktion_id').in('transaktion_id', tIdn.slice(i, i + 200));
      const bokforda = new Set((data ?? []).map((r) => r.transaktion_id));
      for (const t of transaktioner) if (bokforda.has(t.id)) bokfordaFiler.add(t.underlag_id);
    }

    const bank = await bankrader(supabase, user.id, idn, transaktioner);

    // Alla sidor får en länk, så att detaljvyn kan bläddra mellan dem
    const sokvagar = synliga.map((f) => f.file_path).filter((p): p is string => !!p);
    const lankar = new Map<string, string>();
    for (let i = 0; i < sokvagar.length; i += 500) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(sokvagar.slice(i, i + 500), LANK_GILTIG_S);
      for (const l of data ?? []) if (l.path && l.signedUrl) lankar.set(l.path, l.signedUrl);
    }

    const underlag = huvud.map((f) => {
      const egna = transaktioner.filter((t) => t.underlag_id === f.id);
      const valutor = new Set(egna.map((t) => t.valuta || 'SEK'));
      const summa = valutor.size === 1 ? egna.reduce((s, t) => s + Number(t.belopp) * (t.riktning === 'in' ? 1 : -1), 0) : null;
      const forsta = egna[0];
      const u = forsta?.uppgifter ?? {};
      const datumUr = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
      const sidlankar = [f, ...synliga.filter((s) => s.del_av === f.id).sort((a, b) => a.file_name.localeCompare(b.file_name, 'sv', { numeric: true }))]
        .map((s) => (s.file_path ? lankar.get(s.file_path) : undefined))
        .filter((x): x is string => !!x);
      const koppling = bank.get(f.id) ?? [];
      return {
        id: f.id,
        namn: f.file_name,
        typ: f.mime_type,
        skapad: f.created_at,
        kalla: f.source === 'mejl' ? 'mejl' : 'uppladdat',
        ovrigt: f.sortering === 'ovrigt',
        sidor: 1 + (sidor.get(f.id) ?? 0),
        url: f.file_path ? lankar.get(f.file_path) ?? null : null,
        transaktioner: egna.length,
        datum: forsta?.datum ?? null,
        motpart: forsta?.motpart ?? null,
        beskrivning: egna.length === 1 ? forsta?.beskrivning ?? null : null,
        belopp: egna.length && summa !== null ? Math.round(summa * 100) / 100 : null,
        valuta: valutor.size === 1 ? [...valutor][0] : null,
        bokford: bokfordaFiler.has(f.id),
        /** Dagen den betalades: bankraden om den är kopplad, annars det underlaget säger. */
        betaldatum: koppling[0]?.datum ?? datumUr(u.betaldatum),
        forfallodatum: datumUr(u.forfallodatum),
        fakturanummer: typeof u.fakturanummer === 'string' ? u.fakturanummer : null,
        ocr: typeof u.ocr === 'string' || typeof u.ocr === 'number' ? String(u.ocr) : null,
        sidlankar,
        bank: koppling,
      };
    });
    return NextResponse.json({ underlag });
  } catch (err) {
    console.error('[underlag]', err);
    return NextResponse.json({ error: 'Kunde inte hämta dina underlag' }, { status: 500 });
  }
}

/** En bankrad som ett underlag är kopplat till, som kunden ser den. */
interface Bankkoppling {
  datum: string;
  belopp: number;
  valuta: string;
  text: string;
  konto: string | null;
  kontoHash: string;
}

/**
 * Bankraderna som kundens underlag är kopplade till, per underlag:
 * - bankraden är en dubblett av en transaktion ur underlaget (dublett_av)
 * - Flöde har kopplat filen till bankraden (underlag_kopplingar)
 * - bankraden betalar fakturan i underlaget (betalningskopplingar)
 */
async function bankrader(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  underlagIdn: string[],
  transaktioner: { id: string; underlag_id: string }[],
): Promise<Map<string, Bankkoppling[]>> {
  const underlagFor = new Map(transaktioner.map((t) => [t.id, t.underlag_id]));
  const par: { underlagId: string; kontoHash: string; bankId: string }[] = [];
  const tIdn = transaktioner.map((t) => t.id);

  for (let i = 0; i < tIdn.length; i += 200) {
    const del = tIdn.slice(i, i + 200);
    const [dubbletter, betalningar] = await Promise.all([
      supabase.from('transaktioner').select('dublett_av, bank_konto_hash, bank_transaktion_id').eq('user_id', userId).eq('kalla', 'bank').in('dublett_av', del),
      supabase.from('betalningskopplingar').select('transaktion_id, konto_hash, bank_transaktion_id').eq('user_id', userId).neq('status', 'avvisad').in('transaktion_id', del),
    ]);
    for (const d of dubbletter.data ?? []) par.push({ underlagId: underlagFor.get(d.dublett_av)!, kontoHash: d.bank_konto_hash, bankId: d.bank_transaktion_id });
    for (const b of betalningar.data ?? []) par.push({ underlagId: underlagFor.get(b.transaktion_id)!, kontoHash: b.konto_hash, bankId: b.bank_transaktion_id });
  }
  for (let i = 0; i < underlagIdn.length; i += 200) {
    const { data } = await supabase.from('underlag_kopplingar')
      .select('underlag_id, transaktioner!inner(kalla, bank_konto_hash, bank_transaktion_id)')
      .eq('user_id', userId).in('underlag_id', underlagIdn.slice(i, i + 200)).not('transaktion_id', 'is', null);
    for (const k of (data ?? []) as unknown as { underlag_id: string; transaktioner: { kalla: string; bank_konto_hash: string | null; bank_transaktion_id: string | null } }[]) {
      const t = k.transaktioner;
      if (t?.kalla === 'bank' && t.bank_konto_hash && t.bank_transaktion_id) par.push({ underlagId: k.underlag_id, kontoHash: t.bank_konto_hash, bankId: t.bank_transaktion_id });
    }
  }
  if (!par.length) return new Map();

  const [{ data: rader }, { data: konton }] = await Promise.all([
    supabase.from('bank_transaktioner').select('konto_hash, transaktion_id, bokforingsdag, belopp_ore, valuta, text, motpart')
      .eq('user_id', userId).in('transaktion_id', [...new Set(par.map((p) => p.bankId))]),
    supabase.from('bank_konton').select('konto_hash, namn').eq('user_id', userId),
  ]);
  const rad = new Map((rader ?? []).map((r) => [`${r.konto_hash}|${r.transaktion_id}`, r]));
  const kontonamn = new Map((konton ?? []).map((k) => [k.konto_hash, k.namn]));

  const ut = new Map<string, Bankkoppling[]>();
  const sedda = new Set<string>();
  for (const p of par) {
    const nyckel = `${p.kontoHash}|${p.bankId}`;
    const r = rad.get(nyckel);
    if (!r || sedda.has(`${p.underlagId}|${nyckel}`)) continue;
    sedda.add(`${p.underlagId}|${nyckel}`);
    const lista = ut.get(p.underlagId) ?? [];
    lista.push({
      datum: r.bokforingsdag,
      belopp: r.belopp_ore / 100,
      valuta: r.valuta,
      text: r.motpart || r.text || 'Banktransaktion',
      konto: kontonamn.get(p.kontoHash) ?? null,
      kontoHash: p.kontoHash,
    });
    ut.set(p.underlagId, lista.sort((a, b) => a.datum.localeCompare(b.datum)));
  }
  return ut;
}

/**
 * DELETE ?id=…: kunden tar bort ett underlag, med dess sidor och det vi läst
 * ur det. Ett bokfört underlag går inte att ta bort här — då skulle
 * verifikationerna försvinna ur bokföringen — så kunden får höra av sig.
 */
export async function DELETE(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  // id:t går in i ett filter nedan, så bara ett riktigt uuid släpps igenom
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Underlaget saknas' }, { status: 400 });
  }

  const supabase = createServerClient();
  try {
    const { data: filer } = await supabase.from('bokforing_underlag')
      .select('id, file_path').eq('user_id', user.id).or(`id.eq.${id},del_av.eq.${id}`);
    if (!filer?.some((f) => f.id === id)) return NextResponse.json({ error: 'Underlaget finns inte' }, { status: 404 });
    const idn = filer.map((f) => f.id);

    const { data: t } = await supabase.from('transaktioner').select('id').in('underlag_id', idn);
    const tIdn = (t ?? []).map((r) => r.id);
    const [v1, v2] = await Promise.all([
      supabase.from('verifikationer').select('id', { count: 'exact', head: true }).in('underlag_id', idn),
      tIdn.length
        ? supabase.from('verifikationer').select('id', { count: 'exact', head: true }).in('transaktion_id', tIdn)
        : Promise.resolve({ count: 0 }),
    ]);
    if ((v1.count ?? 0) + (v2.count ?? 0) > 0) {
      return NextResponse.json({ error: 'Underlaget är redan bokfört och kan inte tas bort här. Hör av dig till oss om det ska bort.' }, { status: 409 });
    }

    const sokvagar = filer.map((f) => f.file_path).filter((p): p is string => !!p);
    if (sokvagar.length) {
      const { error } = await supabase.storage.from(BUCKET).remove(sokvagar);
      if (error) throw new Error(error.message);
    }
    // Transaktionerna och kopplingarna följer med i kaskaden; bankrader som
    // pekade på dem som dubbletter blir okopplade (dublett_av sätts till null)
    const { error } = await supabase.from('bokforing_underlag').delete().in('id', idn).eq('user_id', user.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[underlag DELETE]', err);
    return NextResponse.json({ error: 'Det gick inte att ta bort underlaget. Försök igen om en stund.' }, { status: 500 });
  }
}
