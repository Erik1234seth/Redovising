import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET - Fetch all parsed transactions for an order
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const latest = searchParams.get('latest') === 'true';

    console.log('📋 Fetching parsed transactions for order:', orderId);
    console.log('📋 Latest only:', latest);

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let transactions;
    let error;

    if (latest) {
      // First, get the max created_at for this order
      const { data: maxData } = await supabase
        .from('parsed_transactions')
        .select('created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (maxData) {
        // Get all transactions within 5 seconds of the max created_at
        const maxTime = new Date(maxData.created_at);
        const minTime = new Date(maxTime.getTime() - 5000); // 5 seconds window

        const result = await supabase
          .from('parsed_transactions')
          .select('*')
          .eq('order_id', orderId)
          .gte('created_at', minTime.toISOString())
          .order('row_number', { ascending: true });

        transactions = result.data;
        error = result.error;
      } else {
        transactions = [];
      }
    } else {
      const result = await supabase
        .from('parsed_transactions')
        .select('*')
        .eq('order_id', orderId)
        .order('row_number', { ascending: true });

      transactions = result.data;
      error = result.error;
    }

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
