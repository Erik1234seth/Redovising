import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { listaBanker } from '@/lib/bank/enablebanking';

/** Svenska banker som går att koppla, för valet på integrationssidan. */
export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  try {
    const banker = await listaBanker('SE');
    return NextResponse.json({
      banker: banker
        .map((b) => ({ name: b.name, psu_types: b.psu_types ?? [] }))
        .sort((a, b) => a.name.localeCompare(b.name, 'sv')),
    });
  } catch (err) {
    console.error('[bank/banker]', err);
    return NextResponse.json({ error: 'Kunde inte hämta bankerna' }, { status: 500 });
  }
}
