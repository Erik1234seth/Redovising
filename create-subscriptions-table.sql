-- Skapa subscriptions-tabellen för Stripe-prenumerationer
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  email TEXT,
  status TEXT NOT NULL,
  price_id TEXT,
  billing_period TEXT,
  current_period_end TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Bara service role kan skriva (webhook)
CREATE POLICY "Service role full access" ON subscriptions
  USING (true)
  WITH CHECK (true);
