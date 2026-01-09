-- Create manual transactions table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS manual_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL,  -- Temporary order ID from sessionStorage
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Transaction details
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Guest user info (for non-authenticated users)
  guest_email TEXT,
  guest_name TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS manual_transactions_order_id_idx ON manual_transactions(order_id);
CREATE INDEX IF NOT EXISTS manual_transactions_user_id_idx ON manual_transactions(user_id);
CREATE INDEX IF NOT EXISTS manual_transactions_type_idx ON manual_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS manual_transactions_date_idx ON manual_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS manual_transactions_created_at_idx ON manual_transactions(created_at);

-- Add RLS policies
ALTER TABLE manual_transactions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert transactions
CREATE POLICY "Anyone can insert manual transactions"
ON manual_transactions
FOR INSERT
TO public
WITH CHECK (true);

-- Allow anyone to read their own transactions
CREATE POLICY "Users can read manual transactions"
ON manual_transactions
FOR SELECT
TO public
USING (
  auth.uid() = user_id
  OR auth.uid() IS NULL
);

-- Allow users to update their own transactions
CREATE POLICY "Users can update own transactions"
ON manual_transactions
FOR UPDATE
TO public
USING (
  auth.uid() = user_id
  OR auth.uid() IS NULL
);

-- Allow users to delete their own transactions
CREATE POLICY "Users can delete own transactions"
ON manual_transactions
FOR DELETE
TO public
USING (
  auth.uid() = user_id
  OR auth.uid() IS NULL
);

-- Create a helpful view for transaction summaries
CREATE OR REPLACE VIEW transaction_summary_view AS
SELECT
  order_id,
  user_id,
  guest_email,
  guest_name,
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN transaction_type = 'income' THEN 1 END) as income_count,
  COUNT(CASE WHEN transaction_type = 'expense' THEN 1 END) as expense_count,
  COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) as total_income,
  COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
  COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END), 0) as net_amount
FROM manual_transactions
GROUP BY order_id, user_id, guest_email, guest_name;

-- Grant access to the view
GRANT SELECT ON transaction_summary_view TO authenticated, anon;

COMMENT ON TABLE manual_transactions IS 'Stores manually added income and expense transactions';
COMMENT ON VIEW transaction_summary_view IS 'Summary view of transactions grouped by order';
