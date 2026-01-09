import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// GET - Fetch all transactions for a specific order
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('manual_transactions')
      .select('*')
      .eq('order_id', orderId)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ transactions: data || [] });
  } catch (error) {
    console.error('Error in GET /api/transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new transaction
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      orderId,
      userId,
      guestEmail,
      guestName,
      transactionDate,
      description,
      amount,
      transactionType,
    } = body;

    // Validate required fields
    if (!orderId || !transactionDate || !description || !amount || !transactionType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate transaction type
    if (!['income', 'expense'].includes(transactionType)) {
      return NextResponse.json(
        { error: 'Invalid transaction type. Must be "income" or "expense"' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const transactionData = {
      order_id: orderId,
      user_id: userId || null,
      guest_email: guestEmail || null,
      guest_name: guestName || null,
      transaction_date: transactionDate,
      description,
      amount: parseFloat(amount),
      transaction_type: transactionType,
    };

    const { data, error } = await supabase
      .from('manual_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      return NextResponse.json(
        { error: 'Failed to create transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ transaction: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
