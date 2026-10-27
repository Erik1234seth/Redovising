import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { handleNewLead } from '@/lib/sms/lead';
import { ringlistaInfoEmail } from '@/lib/emails/lead-welcome';

/**
 * Ringlistan: firmorna från Excel-filen som ringas upp en i taget.
 *
 * GET              → hela listan, utan personnummer
 * POST spara       → ändra mejl, anteckning eller status på en rad
 * POST skicka-info → infomejl + välkomst-SMS, och personen blir lead
 *
 * "Skicka info" går genom samma väg som Facebook-leads (handleNewLead): en rad
 * i contact_requests, mejlet loggat som lead_valkomst och samma SMS. Därför
 * syns de under Leads i inkorgen och får påminnelsen efter två veckor som alla
 * andra. Bara efter att personen sagt ja i telefon — enskilda firmor räknas
 * som privatpersoner, och reklam på mejl och SMS kräver samtycke.
 */

// Att infon skickats syns på info_skickad_at, inte i statusen
const STATUSAR = ['ej_ringd', 'ringd', 'ej_intresserad'] as const;

const fel = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** "Kuckovic, Nedzad" → "Nedzad Kuckovic", som man skriver ett namn i ett mejl. */
function fornamnForst(namn: string): string {
  const [efter, fore] = namn.split(',').map((s) => s.trim());
  return fore ? `${fore} ${efter}` : namn;
}

export async function GET() {
  const supabase = createServerClient();
  const rader = [];
  // Supabase ger högst 1 000 rader per fråga
  for (let fran = 0; ; fran += 1000) {
    const { data, error } = await supabase.from('ringlista')
      .select('id, namn, bransch, email, telefon, postnr, ort, registrerad, anteckning, status, info_skickad_at, updated_at')
      .order('id').range(fran, fran + 999);
    if (error) return fel(error.message, 500);
    rader.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  // Samma ordning som de utskrivna listorna: bransch (kolumn C), sedan
  // mobilnumret från störst till minst. Sorteras här och inte i databasen,
  // som lägger Å, Ä och Ö bland A och O.
  const sv = new Intl.Collator('sv');
  const siffror = (t: string | null) => Number((t ?? '').replace(/\D/g, '')) || 0;
  rader.sort((a, b) => sv.compare(a.bransch ?? '', b.bransch ?? '') || siffror(b.telefon) - siffror(a.telefon));
  return NextResponse.json({ rader });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '');
  if (!id) return fel('id krävs');

  switch (body.action) {
    case 'spara': {
      const andring: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ('email' in body) {
        const email = String(body.email ?? '').trim().toLowerCase();
        if (email && !email.includes('@')) return fel('Ogiltig mejladress');
        andring.email = email || null;
      }
      if ('anteckning' in body) andring.anteckning = String(body.anteckning ?? '').trim() || null;
      if ('status' in body) {
        if (!STATUSAR.includes(body.status)) return fel('Okänd status');
        andring.status = body.status;
      }
      const { error } = await supabase.from('ringlista').update(andring).eq('id', id);
      return error ? fel(error.message, 500) : NextResponse.json({ ok: true });
    }

    case 'skicka-info': {
      // Raden låses först, så att två klick inte ger två mejl
      const nu = new Date().toISOString();
      const { data: rad, error } = await supabase.from('ringlista')
        .update({ info_skickad_at: nu, updated_at: nu })
        .eq('id', id).is('info_skickad_at', null)
        .select('namn, email, telefon, anteckning').maybeSingle();
      if (error) return fel(error.message, 500);
      if (!rad) return fel('Infon är redan skickad till den här personen', 409);
      if (!rad.email) {
        await supabase.from('ringlista').update({ info_skickad_at: null }).eq('id', id);
        return fel('Lägg in en mejladress först');
      }

      const resultat = await handleNewLead(supabase, {
        name: fornamnForst(rad.namn),
        email: rad.email,
        phone: rad.telefon,
        ref: 'ringlista',
        notes: ['Från ringlistan', rad.anteckning].filter(Boolean).join(': '),
        welcomeEmail: ringlistaInfoEmail(),
      });

      if (!resultat.emailed) {
        // Gick inte mejlet går det att försöka igen
        await supabase.from('ringlista').update({ info_skickad_at: null }).eq('id', id);
        return fel('Mejlet kunde inte skickas. Försök igen om en stund.', 502);
      }
      // Har man skickat info har man ringt — att infon gått iväg syns på info_skickad_at
      await supabase.from('ringlista').update({ status: 'ringd' }).eq('id', id);
      return NextResponse.json({
        ok: true,
        sms: resultat.outcome === 'sent',
        smsFel: resultat.outcome === 'failed' ? resultat.error : undefined,
      });
    }

    default:
      return fel('Okänd action');
  }
}
