import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
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
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orderId = formData.get('orderId') as string;
    const userId = formData.get('userId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'No order ID provided' }, { status: 400 });
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Parse Excel file
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Extract account info from metadata rows
    const accountInfo: AccountInfo = {
      accountHolder: extractValue(rows[0]?.[0] as string, 'Transaktioner '),
      currency: extractValue(rows[3]?.[0] as string, 'Valuta: '),
      period: rows[3]?.[3] as string || '',
      clearingNumber: extractValue(rows[4]?.[0] as string, 'Clearingnummer: '),
      accountNumber: extractValue(rows[5]?.[0] as string, 'Kontonummer: '),
    };

    // Find header row (usually row 7, index 7)
    let headerRowIndex = 7;
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i];
      if (row && Array.isArray(row) &&
          (row.includes('Bokföringsdag') || row.includes('Transaktionsdag') || row.includes('Belopp'))) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = rows[headerRowIndex] as string[];

    // Map column indices
    const columnMap = {
      rowNumber: findColumnIndex(headers, ['Radnummer', 'Rad']),
      bookingDate: findColumnIndex(headers, ['Bokföringsdag', 'Bokfört datum']),
      transactionDate: findColumnIndex(headers, ['Transaktionsdag', 'Transaktionsdatum']),
      valueDate: findColumnIndex(headers, ['Valutadag', 'Valutadatum']),
      reference: findColumnIndex(headers, ['Referens', 'Ref']),
      description: findColumnIndex(headers, ['Beskrivning', 'Text', 'Meddelande']),
      amount: findColumnIndex(headers, ['Belopp', 'Summa']),
      balance: findColumnIndex(headers, ['Bokfört saldo', 'Saldo', 'Balans']),
    };

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

    // Save transactions to database
    const supabase = createClient();

    // First, delete any existing parsed transactions for this order
    await supabase
      .from('parsed_transactions')
      .delete()
      .eq('order_id', orderId);

    // Insert new transactions
    if (transactions.length > 0) {
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
        console.error('Error inserting transactions:', insertError);
        // Continue anyway, return parsed data
      }
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
