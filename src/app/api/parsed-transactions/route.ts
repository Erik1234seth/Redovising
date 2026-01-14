import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// GET - Fetch all parsed transactions for an order
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const supabase = createClient();

    const { data: transactions, error } = await supabase
      .from('parsed_transactions')
      .select('*')
      .eq('order_id', orderId)
      .order('row_number', { ascending: true });

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Calculate summary
    const summary = {
      totalCount: transactions?.length || 0,
      incomeCount: transactions?.filter(t => t.amount > 0).length || 0,
      expenseCount: transactions?.filter(t => t.amount < 0).length || 0,
      totalIncome: transactions?.filter(t => t.amount > 0).reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0,
      totalExpenses: Math.abs(transactions?.filter(t => t.amount < 0).reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0),
      netAmount: transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0,
      euTransactionCount: transactions?.filter(t => t.is_eu_transaction).length || 0,
      privateCount: transactions?.filter(t => t.is_private).length || 0,
      annotatedCount: transactions?.filter(t => t.note && t.note.trim() !== '').length || 0,
    };

    return NextResponse.json({
      transactions: transactions || [],
      summary,
    });

  } catch (error) {
    console.error('Error in GET parsed-transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
