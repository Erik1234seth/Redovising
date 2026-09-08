import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Extra mejladresser som kopplas till en person för hand.
 *
 * Panelen slår ihop rader som delar adress eller telefonnummer på egen hand.
 * En kund som svarar från en adress vi aldrig sett har ingenting gemensamt att
 * haka i — då blir svaret en egen person i listan, med sin egen tidslinje.
 * Den här routen är den manuella bryggan över det glappet.
 *
 * Ligger i en egen fil för att en `route.ts` bara får exportera HTTP-metoder:
 * GET, POST, PATCH och DELETE är redan upptagna av personerna själva.
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Panelens identitetsnyckel: "e:adress" eller "p:+46...". */
function looksLikeKey(value: unknown): value is string {
  return typeof value === 'string' && /^[ep]:.+/.test(value);
}

/**
 * Kopplar adressen till personen.
 *
 * `personKey` och `profileId` kommer från personen panelen redan visar — de
 * behöver inte slås upp på nytt här. Nyckeln är vilken som helst av personens
 * identiteter; sammanslagningen i GET är transitiv och hittar rätt ändå.
 */
export async function POST(request: NextRequest) {
  try {
    const { personKey, profileId, email, note } = await request.json();

    if (!looksLikeKey(personKey)) {
      return NextResponse.json({ error: 'personKey krävs' }, { status: 400 });
    }

    const alias = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!alias.includes('@') || /\s/.test(alias)) {
      return NextResponse.json({ error: 'Ange en giltig mejladress' }, { status: 400 });
    }
    if (personKey === `e:${alias}`) {
      return NextResponse.json(
        { error: 'Det är personens egen adress — den är redan kopplad' },
        { status: 400 },
      );
    }

    const { error } = await getSupabase().from('person_aliases').insert({
      alias_email: alias,
      person_key: personKey,
      // Finns konto skrivs det in: det är på user_id mail-AI:n slår upp
      // avsändaren, och utan den känner den inte igen adressen.
      user_id: profileId || null,
      note: typeof note === 'string' && note.trim() ? note.trim() : null,
    });

    if (error) {
      // 23505 = adressen är redan kopplad, till den här personen eller en annan
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Adressen är redan kopplad till någon. Ta bort den kopplingen först.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/people/alias POST]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Tar bort kopplingen. Bara kopplingen — mejlen och raderna som kom in på
 * adressen ligger kvar, de faller bara ut som en egen person igen.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'id krävs' }, { status: 400 });
    }
    const { error } = await getSupabase().from('person_aliases').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/people/alias DELETE]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
