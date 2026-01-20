import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 second timeout

export async function POST(request: NextRequest) {
  console.log('📤 Upload API: Request received');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orderId = formData.get('orderId') as string;
    const fileType = formData.get('fileType') as string;
    const userId = formData.get('userId') as string | null;

    console.log('📤 Upload API: File:', file?.name, 'Size:', file?.size);
    console.log('📤 Upload API: Order ID:', orderId);
    console.log('📤 Upload API: File type:', fileType);

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'No order ID provided' }, { status: 400 });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Filen är för stor (max 10MB)' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Ogiltigt filformat' }, { status: 400 });
    }

    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    console.log('📤 Upload API: Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate file path
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    const fileName = `${timestamp}_${sanitizedName}`;
    const filePath = `${orderId}/${fileType}s/${fileName}`;

    console.log('📤 Upload API: File path:', filePath);

    // Convert file to ArrayBuffer
    console.log('📤 Upload API: Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('📤 Upload API: Starting Supabase upload...');

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('order-files')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('📤 Upload API: Upload error:', uploadError);
      return NextResponse.json(
        { error: `Uppladdning misslyckades: ${uploadError.message}` },
        { status: 500 }
      );
    }

    console.log('📤 Upload API: Upload successful!', data);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('order-files')
      .getPublicUrl(filePath);

    console.log('📤 Upload API: Public URL:', urlData.publicUrl);

    // Save file metadata to database
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        order_id: null,
        user_id: userId || null,
        file_type: fileType,
        file_name: file.name,
        file_path: filePath,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('📤 Upload API: Database error:', dbError);
      // Continue anyway - file is uploaded
    }

    console.log('📤 Upload API: Complete! File ID:', fileRecord?.id);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
      fileId: fileRecord?.id,
    });

  } catch (error) {
    console.error('📤 Upload API: Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    );
  }
}
