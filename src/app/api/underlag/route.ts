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
    const transaktioner: { id: string; underlag_id: string; datum: string | null; belopp: number; valuta: string | null; riktning: string; motpart: string | null; beskrivning: string | null }[] = [];
    const bokfordaFiler = new Set<string>();
    for (let i = 0; i < idn.length; i += 200) {
      const del = idn.slice(i, i + 200);
      const [t, v] = await Promise.all([
        supabase.from('transaktioner').select('id, underlag_id, datum, belopp, valuta, riktning, motpart, beskrivning').in('underlag_id', del).is('dublett_av', null),
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

    const sokvagar = huvud.map((f) => f.file_path).filter((p): p is string => !!p);
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
      };
    });
    return NextResponse.json({ underlag });
  } catch (err) {
    console.error('[underlag]', err);
    return NextResponse.json({ error: 'Kunde inte hämta dina underlag' }, { status: 500 });
  }
}
