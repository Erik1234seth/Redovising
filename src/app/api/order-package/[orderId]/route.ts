import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import archiver from 'archiver';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface OrderData {
  id: string;
  user_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_company: string | null;
  package_type: string;
  bank: string;
  status: string;
  created_at: string;
  statement_files: string[] | null;
  previous_file: string | null;
  export_file_path: string | null;
  export_file_url: string | null;
  exported_at: string | null;
}

interface ProfileData {
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
}

// Extract storage path from Supabase public URL
function extractStoragePath(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/public\/order-files\/(.+)$/);
  return match ? match[1] : null;
}

// Get filename from URL or path
function getFileName(urlOrPath: string): string {
  const parts = urlOrPath.split('/');
  const fileName = parts[parts.length - 1];
  // Remove timestamp prefix if present (e.g., "1767021982396_filename.xlsx" -> "filename.xlsx")
  const withoutTimestamp = fileName.replace(/^\d+_/, '');
  return withoutTimestamp || fileName;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  if (!orderId) {
    return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // Fetch order data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = order as OrderData;

    // Fetch user profile if user_id exists
    let profile: ProfileData | null = null;
    if (orderData.user_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email, full_name, phone, company_name')
        .eq('id', orderData.user_id)
        .single();
      profile = profileData as ProfileData | null;
    }

    // Build metadata object
    const statementFileNames = (orderData.statement_files || []).map(url => getFileName(url));
    const previousFileName = orderData.previous_file ? getFileName(orderData.previous_file) : null;

    const metadata = {
      orderId: orderData.id,
      orderType: orderData.package_type,
      bank: orderData.bank,
      status: orderData.status,
      createdAt: orderData.created_at,
      exportedAt: orderData.exported_at,
      user: profile ? {
        email: profile.email,
        name: profile.full_name,
        phone: profile.phone,
        company: profile.company_name,
      } : {
        email: orderData.guest_email,
        name: orderData.guest_name,
        phone: orderData.guest_phone,
        company: orderData.guest_company,
      },
      files: {
        statements: statementFileNames,
        previous: previousFileName,
        export: orderData.export_file_path ? true : false,
      }
    };

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('error', (err) => {
      throw err;
    });

    // Add metadata.json
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    // Download and add original statement files from URLs in orders table
    if (orderData.statement_files && orderData.statement_files.length > 0) {
      for (let i = 0; i < orderData.statement_files.length; i++) {
        const url = orderData.statement_files[i];
        const storagePath = extractStoragePath(url);

        if (storagePath) {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('order-files')
            .download(storagePath);

          if (!downloadError && fileData) {
            const buffer = Buffer.from(await fileData.arrayBuffer());
            const fileName = getFileName(url);
            archive.append(buffer, { name: `original/${fileName}` });
          }
        }
      }
    }

    // Download and add previous file (old NE-bilaga) from URL in orders table
    if (orderData.previous_file) {
      const storagePath = extractStoragePath(orderData.previous_file);

      if (storagePath) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('order-files')
          .download(storagePath);

        if (!downloadError && fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          const fileName = getFileName(orderData.previous_file);
          archive.append(buffer, { name: `previous/${fileName}` });
        }
      }
    }

    // Download and add export file (processed transactions)
    if (orderData.export_file_path) {
      const { data: exportData, error: exportError } = await supabase.storage
        .from('order-files')
        .download(orderData.export_file_path);

      if (!exportError && exportData) {
        const buffer = Buffer.from(await exportData.arrayBuffer());
        const exportFileName = getFileName(orderData.export_file_path);
        archive.append(buffer, { name: `processed/${exportFileName}` });
      }
    }

    // Finalize the archive
    await archive.finalize();

    // Wait for all data
    const zipBuffer = Buffer.concat(chunks);

    // Return ZIP file
    const fileName = `order_${orderId}_${new Date().toISOString().split('T')[0]}.zip`;

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error creating order package:', error);
    return NextResponse.json({ error: 'Failed to create order package' }, { status: 500 });
  }
}
