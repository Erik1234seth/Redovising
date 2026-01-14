-- Create parsed_transactions table for bank statement transactions
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS parsed_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL,  -- Temporary order ID, updated when order is created
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Transaction data from bank statement
  row_number INTEGER,
  booking_date DATE,
  transaction_date DATE,
  value_date DATE,
  reference TEXT,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  balance DECIMAL(12, 2),

  -- User annotations
  note TEXT,                        -- User's custom note
  category TEXT,                    -- e.g., 'office_supplies', 'travel', 'services'
  is_eu_transaction BOOLEAN DEFAULT FALSE,
  is_business_expense BOOLEAN DEFAULT TRUE,
  is_private BOOLEAN DEFAULT FALSE, -- Mark as private (not for accounting)
  vat_rate DECIMAL(5, 2),           -- VAT rate if applicable (6, 12, 25)

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Guest info
  guest_email TEXT,
  guest_name TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS parsed_transactions_order_id_idx ON parsed_transactions(order_id);
CREATE INDEX IF NOT EXISTS parsed_transactions_user_id_idx ON parsed_transactions(user_id);
CREATE INDEX IF NOT EXISTS parsed_transactions_booking_date_idx ON parsed_transactions(booking_date);
CREATE INDEX IF NOT EXISTS parsed_transactions_amount_idx ON parsed_transactions(amount);

-- Add RLS policies
ALTER TABLE parsed_transactions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert transactions
CREATE POLICY "Anyone can insert parsed transactions"
ON parsed_transactions
FOR INSERT
TO public
WITH CHECK (true);

-- Allow anyone to read transactions
CREATE POLICY "Anyone can read parsed transactions"
ON parsed_transactions
FOR SELECT
TO public
USING (true);

-- Allow users to update transactions
CREATE POLICY "Users can update parsed transactions"
ON parsed_transactions
FOR UPDATE
TO public
USING (true);

-- Allow users to delete transactions
CREATE POLICY "Users can delete parsed transactions"
ON parsed_transactions
FOR DELETE
TO public
USING (true);

-- Create a view for transaction summaries by order
CREATE OR REPLACE VIEW parsed_transaction_summary AS
SELECT
  order_id,
  user_id,
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN amount > 0 THEN 1 END) as income_count,
  COUNT(CASE WHEN amount < 0 THEN 1 END) as expense_count,
  COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
  COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expenses,
  COALESCE(SUM(amount), 0) as net_amount,
  COUNT(CASE WHEN is_eu_transaction = true THEN 1 END) as eu_transaction_count,
  COUNT(CASE WHEN is_private = true THEN 1 END) as private_count,
  COUNT(CASE WHEN note IS NOT NULL AND note != '' THEN 1 END) as annotated_count,
  MIN(booking_date) as earliest_date,
  MAX(booking_date) as latest_date
FROM parsed_transactions
GROUP BY order_id, user_id;

GRANT SELECT ON parsed_transaction_summary TO authenticated, anon;

COMMENT ON TABLE parsed_transactions IS 'Stores parsed transactions from bank statements with user annotations';
