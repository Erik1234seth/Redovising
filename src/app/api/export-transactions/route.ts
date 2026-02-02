import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// POST - Export all transactions (parsed + manual) to Excel and save to Supabase
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch parsed transactions
    const { data: parsedTransactions, error: parsedError } = await supabase
      .from('parsed_transactions')
      .select('*')
      .eq('order_id', orderId)
      .order('booking_date', { ascending: true });

    if (parsedError) {
      console.error('Error fetching parsed transactions:', parsedError);
    }

    // Fetch manual transactions
    const { data: manualTransactions, error: manualError } = await supabase
      .from('manual_transactions')
      .select('*')
      .eq('order_id', orderId)
      .order('transaction_date', { ascending: true });

    if (manualError) {
      console.error('Error fetching manual transactions:', manualError);
    }

    // Prepare data for Excel
    const excelData: any[] = [];

    // Add parsed transactions
    if (parsedTransactions && parsedTransactions.length > 0) {
      parsedTransactions.forEach((t) => {
        excelData.push({
          'Datum': t.booking_date || t.transaction_date || '',
          'Beskrivning': t.description || t.reference || '',
          'Belopp': t.amount,
          'Saldo': t.balance || '',
          'Typ': t.amount >= 0 ? 'Inkomst' : 'Utgift',
          'Källa': 'Kontoutdrag',
          'EU-transaktion': t.is_eu_transaction ? 'Ja' : 'Nej',
          'Privat': t.is_private ? 'Ja' : 'Nej',
          'Anteckning': t.note || '',
        });
      });
    }

    // Add manual transactions
    if (manualTransactions && manualTransactions.length > 0) {
      manualTransactions.forEach((t) => {
        const amount = t.transaction_type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount);
        excelData.push({
          'Datum': t.transaction_date || '',
          'Beskrivning': t.description || '',
          'Belopp': amount,
          'Saldo': '',
          'Typ': t.transaction_type === 'income' ? 'Inkomst' : 'Utgift',
          'Källa': 'Manuellt tillagd',
          'EU-transaktion': 'Nej',
          'Privat': 'Nej',
          'Anteckning': '',
        });
      });
    }

    // If no transactions, return early
    if (excelData.length === 0) {
      return NextResponse.json({ message: 'No transactions to export' }, { status: 200 });
    }

    // Sort by date
    excelData.sort((a, b) => {
      const dateA = new Date(a['Datum']).getTime() || 0;
      const dateB = new Date(b['Datum']).getTime() || 0;
      return dateA - dateB;
    });

    // Calculate totals
    const totalIncome = excelData
      .filter(t => t['Typ'] === 'Inkomst')
      .reduce((sum, t) => sum + (parseFloat(t['Belopp']) || 0), 0);
    const totalExpenses = excelData
      .filter(t => t['Typ'] === 'Utgift')
      .reduce((sum, t) => sum + Math.abs(parseFloat(t['Belopp']) || 0), 0);

    // Add summary rows
    excelData.push({});
    excelData.push({
      'Datum': 'SAMMANFATTNING',
      'Beskrivning': '',
      'Belopp': '',
      'Saldo': '',
      'Typ': '',
      'Källa': '',
      'EU-transaktion': '',
      'Privat': '',
      'Anteckning': '',
    });
    excelData.push({
      'Datum': 'Totala inkomster:',
      'Beskrivning': '',
      'Belopp': totalIncome,
      'Saldo': '',
      'Typ': '',
      'Källa': '',
      'EU-transaktion': '',
      'Privat': '',
      'Anteckning': '',
    });
    excelData.push({
      'Datum': 'Totala utgifter:',
      'Beskrivning': '',
      'Belopp': -totalExpenses,
      'Saldo': '',
      'Typ': '',
      'Källa': '',
      'EU-transaktion': '',
      'Privat': '',
      'Anteckning': '',
    });
    excelData.push({
      'Datum': 'Netto:',
      'Beskrivning': '',
      'Belopp': totalIncome - totalExpenses,
      'Saldo': '',
      'Typ': '',
      'Källa': '',
      'EU-transaktion': '',
      'Privat': '',
      'Anteckning': '',
    });

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transaktioner');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 },  // Datum
      { wch: 40 },  // Beskrivning
      { wch: 12 },  // Belopp
      { wch: 12 },  // Saldo
      { wch: 10 },  // Typ
      { wch: 15 },  // Källa
      { wch: 14 },  // EU-transaktion
      { wch: 8 },   // Privat
      { wch: 30 },  // Anteckning
    ];

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Save to Supabase Storage
    const fileName = `transaktioner_komplett_${orderId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = `exports/${orderId}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('order-files')
      .upload(filePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading to Supabase:', uploadError);
      return NextResponse.json({ error: 'Failed to save export file' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('order-files')
      .getPublicUrl(filePath);

    // Update order with export file reference
    await supabase
      .from('orders')
      .update({
        export_file_path: filePath,
        export_file_url: urlData.publicUrl,
        exported_at: new Date().toISOString()
      })
      .eq('id', orderId);

    return NextResponse.json({
      success: true,
      filePath,
      fileUrl: urlData.publicUrl,
      transactionCount: excelData.length - 5, // Subtract summary rows
    });

  } catch (error) {
    console.error('Error exporting transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
