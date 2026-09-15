import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prepareMailUpload, confirmMailUpload } from '@/lib/inmail/save-attachments';

/**
 * Tar emot bilagor från Apps Script (save-attachments.gs), en fil i taget.
 *
 *   action: 'prepare' → { status: 'exists' } eller { status: 'upload', path, signedUrl }
 *   (scriptet laddar upp filen med PUT direkt till signedUrl)
 *   action: 'confirm' → { status: 'saved' | 'exists' }
 *
 * Själva filen går aldrig genom den här routen — Vercel tar max 4,5 MB per
 * anrop, och ett mejl med några foton är större än så.
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  if (request.headers.get('x-inmail-secret') !== process.env.INMAIL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = getSupabase();

    if (body.action === 'prepare') {
      return NextResponse.json(await prepareMailUpload(supabase, body));
    }
    if (body.action === 'confirm') {
      const result = await confirmMailUpload(supabase, body);
      if (result.status === 'saved') {
        console.log(`[inmail/underlag] ${body.fileName} från ${body.senderEmail} sparad som underlag`);
      }
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "action måste vara 'prepare' eller 'confirm'" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[inmail/underlag]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
