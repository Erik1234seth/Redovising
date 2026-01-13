import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const supabase = createClient();

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Fetch associated files
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('order_id', orderId)
      .order('uploaded_at', { ascending: true });

    if (filesError) {
      console.error('Error fetching files:', filesError);
    }

    // Fetch manual transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('manual_transactions')
      .select('*')
      .eq('order_id', orderId)
      .order('transaction_date', { ascending: false });

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
    }

    // Calculate transaction summaries
    const transactionSummary = {
      totalCount: transactions?.length || 0,
      incomeCount: transactions?.filter(t => t.transaction_type === 'income').length || 0,
      expenseCount: transactions?.filter(t => t.transaction_type === 'expense').length || 0,
      totalIncome: transactions
        ?.filter(t => t.transaction_type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0,
      totalExpenses: transactions
        ?.filter(t => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0,
    };

    transactionSummary.netAmount = transactionSummary.totalIncome - transactionSummary.totalExpenses;

    // Organize files by type
    const filesByType = {
      statement: files?.find(f => f.file_type === 'statement') || null,
      previous: files?.find(f => f.file_type === 'previous') || null,
    };

    // Build complete order data
    const completeOrderData = {
      order: {
        id: order.id,
        userId: order.user_id,
        guestEmail: order.guest_email,
        guestName: order.guest_name,
        guestPhone: order.guest_phone,
        guestCompany: order.guest_company,
        packageType: order.package_type,
        bank: order.bank,
        status: order.status,
        createdAt: order.created_at,
      },
      files: filesByType,
      transactions: transactions || [],
      transactionSummary,
      stats: {
        totalFiles: files?.length || 0,
        hasStatementFile: !!filesByType.statement,
        hasPreviousFile: !!filesByType.previous,
        hasTransactions: (transactions?.length || 0) > 0,
      },
    };

    return NextResponse.json(completeOrderData);
  } catch (error) {
    console.error('Error fetching complete order data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order data' },
      { status: 500 }
    );
  }
}
