import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

interface ParsedTransaction {
  rowNumber: number;
  bookingDate: string;
  transactionDate: string;
  valueDate: string;
  reference: string;
  description: string;
  amount: number;
  balance: number;
}

interface AccountInfo {
  accountHolder: string;
  currency: string;
  period: string;
  clearingNumber: string;
  accountNumber: string;
}

export async function POST(request: Request) {
  console.log('📊 Parse Statement API: Request received');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orderId = formData.get('orderId') as string;
    const userId = formData.get('userId') as string | null;

    console.log('📊 Parse Statement API: File:', file?.name, 'Size:', file?.size);
    console.log('📊 Parse Statement API: Order ID:', orderId);
    console.log('📊 Parse Statement API: User ID:', userId);

    if (!file) {
      console.error('📊 Parse Statement API: No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!orderId) {
      console.error('📊 Parse Statement API: No order ID provided');
      return NextResponse.json({ error: 'No order ID provided' }, { status: 400 });
    }

    // Read file as ArrayBuffer
    console.log('📊 Parse Statement API: Reading file...');
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    console.log('📊 Parse Statement API: File read, size:', data.length);

    // Parse Excel file
    console.log('📊 Parse Statement API: Parsing Excel...');
    const workbook = XLSX.read(data, {
      type: 'array',
      sheetRows: 0,  // Read all rows, ignore dimension
      cellDates: true,
    });
    const sheetName = workbook.SheetNames[0];
    console.log('📊 Parse Statement API: Sheet name:', sheetName);
    const sheet = workbook.Sheets[sheetName];

    // Fix: Some Excel files have wrong dimension, recalculate it
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    // Find actual last row by checking for data
    let maxRow = range.e.r;
    for (const cellRef in sheet) {
      if (cellRef[0] === '!') continue;
      const cellRow = XLSX.utils.decode_cell(cellRef).r;
      if (cellRow > maxRow) maxRow = cellRow;
    }
    // Update the range to include all rows
    range.e.r = maxRow;
    sheet['!ref'] = XLSX.utils.encode_range(range);
    console.log('📊 Parse Statement API: Fixed range:', sheet['!ref']);

    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    console.log('📊 Parse Statement API: Total rows:', rows.length);

    // Detect bank format and extract account info
    const accountInfo = extractAccountInfo(rows);

    // Find header row (usually row 7, index 7)
    console.log('📊 Parse Statement API: Looking for header row...');
    let headerRowIndex = 7;
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i];
      if (row && Array.isArray(row)) {
        const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
        // Check for common header keywords across different banks
        if (rowStr.includes('bokföringsdag') || rowStr.includes('bokföringsdatum') ||
            rowStr.includes('transaktionsdag') || rowStr.includes('belopp')) {
          headerRowIndex = i;
          console.log('📊 Parse Statement API: Found header at row:', i);
          break;
        }
      }
    }

    const headers = rows[headerRowIndex] as string[];
    console.log('📊 Parse Statement API: Headers:', headers);

    // Map column indices (supports multiple banks)
    const columnMap = {
      rowNumber: findColumnIndex(headers, ['Radnummer', 'Rad']),
      bookingDate: findColumnIndex(headers, ['Bokföringsdag', 'Bokfört datum', 'Bokföringsdatum']),
      transactionDate: findColumnIndex(headers, ['Transaktionsdag', 'Transaktionsdatum']),
      valueDate: findColumnIndex(headers, ['Valutadag', 'Valutadatum']),
      reference: findColumnIndex(headers, ['Referens', 'Ref', 'Verifikationsnummer']),
      description: findColumnIndex(headers, ['Beskrivning', 'Text', 'Meddelande']),
      amount: findColumnIndex(headers, ['Belopp', 'Summa']),
      balance: findColumnIndex(headers, ['Bokfört saldo', 'Saldo', 'Balans']),
    };
    console.log('📊 Parse Statement API: Column map:', columnMap);

    // Parse transactions
    const transactions: ParsedTransaction[] = [];
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i] as (string | number)[];
      if (!row || row.length === 0) continue;

      // Skip empty rows
      const amount = parseAmount(row[columnMap.amount]);
      if (isNaN(amount)) continue;

      transactions.push({
        rowNumber: parseInt(String(row[columnMap.rowNumber])) || i - headerRowIndex,
        bookingDate: parseDate(row[columnMap.bookingDate]),
        transactionDate: parseDate(row[columnMap.transactionDate]),
        valueDate: parseDate(row[columnMap.valueDate]),
        reference: String(row[columnMap.reference] || ''),
        description: String(row[columnMap.description] || ''),
        amount: amount,
        balance: parseAmount(row[columnMap.balance]) || 0,
      });
    }

    console.log('📊 Parse Statement API: Parsed', transactions.length, 'transactions');
    if (transactions.length > 0) {
      console.log('📊 Parse Statement API: First transaction:', transactions[0]);
    }

    // Save transactions to database
    console.log('📊 Parse Statement API: Connecting to Supabase...');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // First, delete any existing parsed transactions for this order
    console.log('📊 Parse Statement API: Deleting existing transactions for order:', orderId);
    const { error: deleteError } = await supabase
      .from('parsed_transactions')
      .delete()
      .eq('order_id', orderId);

    if (deleteError) {
      console.error('📊 Parse Statement API: Delete error:', deleteError);
    }

    // Insert new transactions
    if (transactions.length > 0) {
      console.log('📊 Parse Statement API: Inserting', transactions.length, 'transactions...');
      const transactionsToInsert = transactions.map(t => ({
        order_id: orderId,
        user_id: userId || null,
        row_number: t.rowNumber,
        booking_date: t.bookingDate || null,
        transaction_date: t.transactionDate || null,
        value_date: t.valueDate || null,
        reference: t.reference,
        description: t.description,
        amount: t.amount,
        balance: t.balance,
        is_business_expense: t.amount < 0, // Default: negative amounts are expenses
        is_private: false,
        is_eu_transaction: false,
      }));

      const { error: insertError } = await supabase
        .from('parsed_transactions')
        .insert(transactionsToInsert);

      if (insertError) {
        console.error('📊 Parse Statement API: Insert error:', insertError);
        // Continue anyway, return parsed data
      } else {
        console.log('📊 Parse Statement API: Successfully inserted transactions');
      }
    } else {
      console.log('📊 Parse Statement API: No transactions to insert');
    }

    return NextResponse.json({
      success: true,
      accountInfo,
      transactionCount: transactions.length,
      transactions,
      summary: {
        totalIncome: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
        totalExpenses: Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
        netAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
      }
    });

  } catch (error) {
    console.error('Error parsing statement:', error);
    return NextResponse.json(
      { error: 'Failed to parse statement file' },
      { status: 500 }
    );
  }
}

// Helper functions

// Detect bank and extract account info
function extractAccountInfo(rows: unknown[][]): AccountInfo {
  const firstRow = String(rows[0]?.[0] || '');

  // SEB format detection
  if (firstRow.includes('Export från internetbanken')) {
    console.log('📊 Parse Statement API: Detected SEB format');
    const accountRow = String(rows[4]?.[0] || '');
    // Parse "Privatkonto (5019 01 305 71)" format
    const accountMatch = accountRow.match(/(.+?)\s*\((\d{4})\s*(\d{2})\s*(\d+)\s*(\d+)\)/);

    return {
      accountHolder: accountMatch?.[1]?.trim() || accountRow,
      currency: 'SEK', // SEB doesn't show currency in export
      period: String(rows[2]?.[1] || ''),
      clearingNumber: accountMatch ? `${accountMatch[2]}-${accountMatch[3]}` : '',
      accountNumber: accountMatch ? `${accountMatch[4]} ${accountMatch[5]}` : '',
    };
  }

  // Handelsbanken format (default)
  console.log('📊 Parse Statement API: Detected Handelsbanken format');
  return {
    accountHolder: extractValue(firstRow, 'Transaktioner '),
    currency: extractValue(String(rows[3]?.[0] || ''), 'Valuta: '),
    period: String(rows[3]?.[3] || ''),
    clearingNumber: extractValue(String(rows[4]?.[0] || ''), 'Clearingnummer: '),
    accountNumber: extractValue(String(rows[5]?.[0] || ''), 'Kontonummer: '),
  };
}

function extractValue(text: string | undefined, prefix: string): string {
  if (!text) return '';
  if (text.startsWith(prefix)) {
    return text.substring(prefix.length).trim();
  }
  return text;
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  if (!headers) return -1;
  for (const name of possibleNames) {
    const index = headers.findIndex(h =>
      h && h.toLowerCase().includes(name.toLowerCase())
    );
    if (index !== -1) return index;
  }
  return -1;
}

function parseDate(value: unknown): string {
  if (!value) return '';

  // If it's already a string in YYYY-MM-DD format
  const strValue = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
    return strValue;
  }

  // If it's an Excel date number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }

  return strValue;
}

function parseAmount(value: unknown): number {
  if (value === undefined || value === null || value === '') return NaN;

  if (typeof value === 'number') return value;

  // Handle string amounts with Swedish formatting (1 234,56)
  let strValue = String(value)
    .replace(/\s/g, '')      // Remove spaces
    .replace(/,/g, '.');     // Replace comma with dot

  return parseFloat(strValue);
}
