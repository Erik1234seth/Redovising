-- Migration to update manual_transactions.order_id to use UUID with foreign key
-- Run this in Supabase SQL Editor AFTER all existing orders have been created

-- Step 1: First, let's create a new column with UUID type
ALTER TABLE manual_transactions
ADD COLUMN IF NOT EXISTS order_uuid UUID;

-- Step 2: Update existing records to convert TEXT order_id to UUID
-- This will fail for records that don't have valid UUIDs, which is expected for temp IDs
UPDATE manual_transactions
SET order_uuid = order_id::uuid
WHERE order_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 3: Drop the old TEXT column
ALTER TABLE manual_transactions
DROP COLUMN IF EXISTS order_id;

-- Step 4: Rename the new UUID column to order_id
ALTER TABLE manual_transactions
RENAME COLUMN order_uuid TO order_id;

-- Step 5: Add NOT NULL constraint (after ensuring all records have order_id)
-- Commented out for now - uncomment after migration is complete
-- ALTER TABLE manual_transactions ALTER COLUMN order_id SET NOT NULL;

-- Step 6: Add foreign key constraint to orders table
ALTER TABLE manual_transactions
ADD CONSTRAINT manual_transactions_order_id_fkey
FOREIGN KEY (order_id)
REFERENCES orders(id)
ON DELETE CASCADE;

-- Step 7: Recreate the index
DROP INDEX IF EXISTS manual_transactions_order_id_idx;
CREATE INDEX manual_transactions_order_id_idx ON manual_transactions(order_id);

-- Step 8: Update the view to handle the new structure
DROP VIEW IF EXISTS transaction_summary_view;
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

GRANT SELECT ON transaction_summary_view TO authenticated, anon;

COMMENT ON TABLE manual_transactions IS 'Stores manually added income and expense transactions with proper foreign key to orders';
