import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const year = formData.get('year') as string | null;
    const file = formData.get('file') as File;

    if (!userId || !title || !file) {
      return NextResponse.json(
        { error: 'Saknade obligatoriska fält' },
        { status: 400 }
      );
    }

    // Validate PDF
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Endast PDF-filer är tillåtna' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Filen är för stor (max 10MB)' },
        { status: 400 }
      );
    }

    // Use service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Upload file to storage
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${sanitizedName}`;
    const filePath = `accounting/${userId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('order-files')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: `Uppladdning misslyckades: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 2. Get public URL
    const { data: urlData } = supabase.storage
      .from('order-files')
      .getPublicUrl(filePath);

    // 3. Insert record in user_accounting_documents (bypasses RLS with service role key)
    const { error: dbError } = await supabase
      .from('user_accounting_documents')
      .insert({
        user_id: userId,
        title: title,
        description: description || null,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: 'application/pdf',
        year: year ? parseInt(year) : null,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: `Databasfel: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'PDF uppladdad!',
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Ett oväntat fel uppstod' },
      { status: 500 }
    );
  }
}
