-- Lägg till prenumerationsfält på profiles så appen vet vem som betalat.
-- Webhooken (/api/stripe/webhook) sätter dessa när betalningen går igenom.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Snabb uppslagning från webhooken vid subscription.updated/deleted
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id
  ON profiles (stripe_subscription_id);
