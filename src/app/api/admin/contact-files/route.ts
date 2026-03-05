import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get('contact_id');
  if (!contactId) return NextResponse.json({ error: 'contact_id krävs' }, { status: 400 });
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('contact_files')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ files: data });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const contactId = formData.get('contact_id') as string;
    const stage = Number(formData.get('stage'));

    if (!file || !contactId || !stage) {
      return NextResponse.json({ error: 'file, contact_id och stage krävs' }, { status: 400 });
    }

    const supabase = getSupabase();
    const ext = file.name.split('.').pop();
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `contacts/${contactId}/${stage}/${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('order-files')
      .upload(filePath, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: urlData } = supabase.storage.from('order-files').getPublicUrl(filePath);

    const { data, error } = await supabase.from('contact_files').insert([{
      contact_id: contactId,
      stage,
      file_name: file.name,
      file_path: filePath,
      file_url: urlData.publicUrl,
      file_size: file.size,
      mime_type: file.type,
    }]).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ file: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, file_path } = await req.json();
    if (!id || !file_path) return NextResponse.json({ error: 'id och file_path krävs' }, { status: 400 });
    const supabase = getSupabase();
    await supabase.storage.from('order-files').remove([file_path]);
    const { error } = await supabase.from('contact_files').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
