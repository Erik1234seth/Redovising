import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// PATCH - Update a single parsed transaction
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const body = await request.json();

    const supabase = createClient();

    // Only allow updating specific fields
    const allowedFields = [
      'note',
      'category',
      'is_eu_transaction',
      'is_business_expense',
      'is_private',
      'vat_rate',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('parsed_transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating transaction:', error);
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    return NextResponse.json({ transaction: data });

  } catch (error) {
    console.error('Error in PATCH parsed-transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a parsed transaction
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const supabase = createClient();

    const { error } = await supabase
      .from('parsed_transactions')
      .delete()
      .eq('id', transactionId);

    if (error) {
      console.error('Error deleting transaction:', error);
      return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in DELETE parsed-transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
