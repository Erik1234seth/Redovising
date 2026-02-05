import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

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

type BankType = 'swedbank' | 'seb' | 'nordea' | 'handelsbanken';

export async function POST(request: Request) {
  console.log('📊 Parse Statement API: Request received');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orderId = formData.get('orderId') as string;
    const userId = formData.get('userId') as string | null;
    const bank = formData.get('bank') as BankType | null;

    console.log('📊 Parse Statement API: File:', file?.name, 'Size:', file?.size);
    console.log('📊 Parse Statement API: Order ID:', orderId);
    console.log('📊 Parse Statement API: User ID:', userId);
    console.log('📊 Parse Statement API: Bank:', bank);

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

    let rows: unknown[][];

    // Check if it's a CSV file (Nordea uses CSV)
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv') || file.type === 'text/csv';

    if (isCSV) {
      // Parse CSV file
      console.log('📊 Parse Statement API: Parsing CSV...');
      const textDecoder = new TextDecoder('utf-8');
      const csvText = textDecoder.decode(data);
      rows = parseCSV(csvText);
      console.log('📊 Parse Statement API: CSV rows:', rows.length);
    } else if (bank === 'handelsbanken') {
      // Use ExcelJS for Handelsbanken (xlsx library has issues with their format)
      console.log('📊 Parse Statement API: Parsing Handelsbanken Excel with ExcelJS...');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const sheet = workbook.worksheets[0];
      console.log('📊 Parse Statement API: Sheet name:', sheet.name);

      rows = [];
      sheet.eachRow((row, rowNum) => {
        // ExcelJS uses 1-indexed rows, convert to 0-indexed
        // row.values has null at index 0, so we slice from 1
        const values = row.values as (string | number | null)[];
        // Place row at correct 0-based index (rowNum - 1)
        rows[rowNum - 1] = values.slice(1).map(v => v ?? '');
      });
      // Fill any gaps with empty arrays
      for (let i = 0; i < rows.length; i++) {
        if (!rows[i]) rows[i] = [];
      }
      console.log('📊 Parse Statement API: ExcelJS rows:', rows.length);
    } else {
      // Parse Excel file with xlsx library
      console.log('📊 Parse Statement API: Parsing Excel...');
      try {
        const workbook = XLSX.read(data, {
          type: 'array',
          sheetRows: 0,  // Read all rows, ignore dimension
          cellDates: true,
          WTF: true, // Throw errors for debugging
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

        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      } catch (xlsxError) {
        console.error('📊 Parse Statement API: XLSX parsing failed, trying raw parse...', xlsxError);
        // Fallback: Try with different options for problematic files
        const workbook = XLSX.read(data, {
          type: 'array',
          raw: true,
          dense: true,
        });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      }
    }
    console.log('📊 Parse Statement API: Total rows:', rows.length);

    // Detect bank format and extract account info
    const accountInfo = extractAccountInfo(rows, bank);

    // Find header row based on bank type
    console.log('📊 Parse Statement API: Looking for header row...');
    let headerRowIndex = 0;

    // Nordea CSV has headers on first row
    if (bank === 'nordea') {
      headerRowIndex = 0;
      console.log('📊 Parse Statement API: Nordea - header at row 0');
    }
    // Handelsbanken has headers on row 9 (index 8)
    else if (bank === 'handelsbanken') {
      headerRowIndex = 8;
      console.log('📊 Parse Statement API: Handelsbanken - header at row 8');
    }
    // For other banks, search for header row
    else {
      headerRowIndex = 7;
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
    }

    const headers = rows[headerRowIndex] as string[];
    console.log('📊 Parse Statement API: Headers:', headers);

    // Get bank-specific column mapping
    const columnMap = getColumnMapping(headers, bank);
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
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Generate a unique batch timestamp for this parse session
    const parseTimestamp = new Date().toISOString();
    console.log('📊 Parse Statement API: Parse timestamp:', parseTimestamp);

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
      parseTimestamp, // Return timestamp so frontend can filter by it
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
function extractAccountInfo(rows: unknown[][], bank: BankType | null): AccountInfo {
  console.log('📊 Parse Statement API: Extracting account info for bank:', bank);

  // SEB format
  if (bank === 'seb') {
    console.log('📊 Parse Statement API: Using SEB parser');
    const accountRow = String(rows[4]?.[0] || '');
    // Parse "Privatkonto (5019 01 305 71)" format
    const accountMatch = accountRow.match(/(.+?)\s*\((\d{4})\s*(\d{2})\s*(\d+)\s*(\d+)\)/);

    return {
      accountHolder: accountMatch?.[1]?.trim() || accountRow,
      currency: 'SEK',
      period: String(rows[2]?.[1] || ''),
      clearingNumber: accountMatch ? `${accountMatch[2]}-${accountMatch[3]}` : '',
      accountNumber: accountMatch ? `${accountMatch[4]} ${accountMatch[5]}` : '',
    };
  }

  // Nordea format (CSV - no account info in file, just transactions)
  if (bank === 'nordea') {
    console.log('📊 Parse Statement API: Using Nordea parser');
    // Nordea CSV doesn't include account metadata, just transactions
    // Currency is in the Valuta column of each row
    return {
      accountHolder: '',
      currency: 'SEK',
      period: '',
      clearingNumber: '',
      accountNumber: '',
    };
  }

  // Handelsbanken format
  if (bank === 'handelsbanken') {
    console.log('📊 Parse Statement API: Using Handelsbanken parser');
    // Row 4 (index 3): "Sparkonto 473 778 548"
    const accountRow = String(rows[3]?.[0] || '');
    // Row 6 (index 5): Kontoform, Clearingnummer, Saldo, etc.
    const detailsRow = rows[5] as string[] || [];
    const clearingStr = String(detailsRow[1] || '');
    const clearingMatch = clearingStr.match(/Clearingnummer:\s*(\d+)/);
    // Row 7 (index 6): Period
    const periodRow = String(rows[6]?.[0] || '');
    const periodMatch = periodRow.match(/Period:\s*(.+?)(?:\s+-|$)/);

    return {
      accountHolder: accountRow,
      currency: 'SEK',
      period: periodMatch?.[1]?.trim() || '',
      clearingNumber: clearingMatch?.[1] || '',
      accountNumber: accountRow.match(/\d[\d\s]+/)?.[0]?.trim() || '',
    };
  }

  // Swedbank format (default)
  console.log('📊 Parse Statement API: Using Swedbank parser');
  const firstRow = String(rows[0]?.[0] || '');
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

// Get bank-specific column mapping
function getColumnMapping(headers: string[], bank: BankType | null) {
  // SEB columns
  if (bank === 'seb') {
    return {
      rowNumber: -1, // SEB doesn't have row numbers
      bookingDate: findColumnIndex(headers, ['Bokföringsdatum']),
      transactionDate: -1, // SEB uses Valutadatum instead
      valueDate: findColumnIndex(headers, ['Valutadatum']),
      reference: findColumnIndex(headers, ['Verifikationsnummer']),
      description: findColumnIndex(headers, ['Text']),
      amount: findColumnIndex(headers, ['Belopp']),
      balance: findColumnIndex(headers, ['Saldo']),
    };
  }

  // Nordea columns (CSV format)
  // Headers: Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta;
  if (bank === 'nordea') {
    return {
      rowNumber: -1,
      bookingDate: findColumnIndex(headers, ['Bokföringsdag']),
      transactionDate: -1, // Nordea doesn't have separate transaction date
      valueDate: -1,
      reference: findColumnIndex(headers, ['Avsändare', 'Mottagare']),
      description: findColumnIndex(headers, ['Rubrik', 'Namn']),
      amount: findColumnIndex(headers, ['Belopp']),
      balance: findColumnIndex(headers, ['Saldo']),
    };
  }

  // Handelsbanken columns
  // Headers: Reskontradatum, Transaktionsdatum, Text, Belopp, Saldo
  if (bank === 'handelsbanken') {
    return {
      rowNumber: -1,
      bookingDate: findColumnIndex(headers, ['Reskontradatum']),
      transactionDate: findColumnIndex(headers, ['Transaktionsdatum']),
      valueDate: -1,
      reference: -1,
      description: findColumnIndex(headers, ['Text']),
      amount: findColumnIndex(headers, ['Belopp']),
      balance: findColumnIndex(headers, ['Saldo']),
    };
  }

  // Swedbank columns (default)
  return {
    rowNumber: findColumnIndex(headers, ['Radnummer', 'Rad']),
    bookingDate: findColumnIndex(headers, ['Bokföringsdag', 'Bokfört datum']),
    transactionDate: findColumnIndex(headers, ['Transaktionsdag', 'Transaktionsdatum']),
    valueDate: findColumnIndex(headers, ['Valutadag', 'Valutadatum']),
    reference: findColumnIndex(headers, ['Referens', 'Ref']),
    description: findColumnIndex(headers, ['Beskrivning', 'Text', 'Meddelande']),
    amount: findColumnIndex(headers, ['Belopp', 'Summa']),
    balance: findColumnIndex(headers, ['Bokfört saldo', 'Saldo', 'Balans']),
  };
}

// Parse CSV with semicolon separator (Nordea format)
function parseCSV(csvText: string): string[][] {
  // Remove BOM if present
  const text = csvText.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  const rows: string[][] = [];

  for (const line of lines) {
    if (line.trim() === '') continue;
    // Split by semicolon (Nordea uses semicolon separator)
    const cells = line.split(';').map(cell => cell.trim());
    rows.push(cells);
  }

  return rows;
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

  const strValue = String(value);

  // If it's already a string in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
    return strValue;
  }

  // Nordea format: YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(strValue)) {
    return strValue.replace(/\//g, '-');
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
