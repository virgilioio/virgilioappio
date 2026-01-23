-- =====================================================
-- GoGio ATS Per-Seat Pricing Model Migration
-- =====================================================
-- This migration updates the database for the new pricing model:
-- - $99/recruiter/month or $999/recruiter/year
-- - 100 credits/seat/month (monthly) or 120 credits/seat/month (annual)
-- - 14-day trial with 20 credits total (requires CC)
-- - Credit bundles as add-ons (never expire while subscribed)
-- =====================================================

-- 1. Add bonus credits tracking columns to tenant_subscriptions
ALTER TABLE tenant_subscriptions
ADD COLUMN IF NOT EXISTS bonus_credits_purchased INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_credits_used INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN tenant_subscriptions.bonus_credits_purchased IS 'Total one-time credit bundle purchases (500/1500/5000)';
COMMENT ON COLUMN tenant_subscriptions.bonus_credits_used IS 'Credits consumed from purchased bundles';

-- 2. Create credit_purchases table for tracking one-time bundle purchases
CREATE TABLE IF NOT EXISTS credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_payment_id TEXT,
  stripe_session_id TEXT,
  credits_purchased INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  bundle_type TEXT, -- '500', '1500', '5000'
  purchased_at TIMESTAMPTZ DEFAULT now(),
  purchased_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS to credit_purchases
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;

-- Tenant members can view their own purchases
CREATE POLICY "Tenant members can view credit purchases"
ON credit_purchases FOR SELECT
USING (
  tenant_id IN (
    SELECT m.tenant_id FROM members m 
    WHERE m.user_id = auth.uid() 
    AND m.user_status = 'active'
  )
);

-- Only admins can insert (handled via service role in edge function)
CREATE POLICY "Service role can insert credit purchases"
ON credit_purchases FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_credit_purchases_tenant_id ON credit_purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_stripe_session ON credit_purchases(stripe_session_id);

-- 3. Update get_tenant_credit_limits function for per-seat model
CREATE OR REPLACE FUNCTION get_tenant_credit_limits(p_tenant_id UUID)
RETURNS TABLE(search_limit INT, collect_limit INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seat_count INT;
  v_billing_interval TEXT;
  v_billing_status TEXT;
  v_credits_per_seat INT;
  v_total_credits INT;
  v_bonus_credits INT;
BEGIN
  -- Get subscription info
  SELECT 
    COALESCE(seat_quantity, 1),
    billing_interval,
    COALESCE(billing_status, 'trialing'),
    COALESCE(bonus_credits_purchased, 0) - COALESCE(bonus_credits_used, 0)
  INTO v_seat_count, v_billing_interval, v_billing_status, v_bonus_credits
  FROM tenant_subscriptions
  WHERE tenant_id = p_tenant_id;
  
  -- Handle no subscription record
  IF v_billing_status IS NULL THEN
    v_billing_status := 'pending_trial';
  END IF;
  
  -- Trial users get 20 total credits (15 search, 5 collect)
  IF v_billing_status = 'trialing' OR v_billing_status = 'pending_trial' THEN
    RETURN QUERY SELECT 15::INT, 5::INT;
    RETURN;
  END IF;
  
  -- Per-seat credits: 100/mo for monthly, 120/mo for annual (20% bonus)
  v_credits_per_seat := CASE 
    WHEN v_billing_interval = 'year' THEN 120
    ELSE 100
  END;
  
  -- Total pooled credits = seats × credits_per_seat
  -- Minimum 1 seat for calculation
  v_seat_count := GREATEST(v_seat_count, 1);
  v_total_credits := v_seat_count * v_credits_per_seat;
  
  -- Note: Bonus credits are tracked separately and don't affect limits
  -- They're consumed after regular credits are exhausted
  
  -- Split: 75% search, 25% collect
  RETURN QUERY SELECT 
    (v_total_credits * 0.75)::INT,
    (v_total_credits * 0.25)::INT;
END;
$$;

-- 4. Update check_seat_limit function - per-seat model has no hard limits
CREATE OR REPLACE FUNCTION public.check_seat_limit(p_tenant_id UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  current_seats INTEGER,
  seat_limit INTEGER,
  over_limit_count INTEGER,
  is_trial BOOLEAN,
  billing_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_seats INTEGER;
  v_is_trial BOOLEAN;
  v_billing_status TEXT;
BEGIN
  -- Get current billable seat count
  SELECT COALESCE(get_tenant_billable_seat_count(p_tenant_id), 0) INTO v_current_seats;

  -- Get billing status
  SELECT 
    (ts.billing_status IN ('trialing', 'pending_trial')),
    COALESCE(ts.billing_status, 'trialing')
  INTO v_is_trial, v_billing_status
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id;

  -- If no subscription record, treat as pending trial
  IF v_billing_status IS NULL THEN
    v_is_trial := TRUE;
    v_billing_status := 'pending_trial';
  END IF;

  -- Per-seat model: ALWAYS allow adding seats
  -- Billing is handled via Stripe proration
  -- Trial users can add seats freely (they'll be billed after trial)
  RETURN QUERY SELECT 
    TRUE::BOOLEAN,           -- Always allowed
    v_current_seats,         -- Current count
    NULL::INTEGER,           -- No limit (per-seat billing)
    0,                       -- Never over limit
    v_is_trial,
    v_billing_status;
END;
$$;

-- 5. Add function to consume bonus credits (FIFO from oldest purchase)
CREATE OR REPLACE FUNCTION consume_bonus_credits(
  p_tenant_id UUID,
  p_credits_to_consume INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_to_consume INT := p_credits_to_consume;
  v_purchase RECORD;
  v_credits_from_purchase INT;
BEGIN
  -- Consume from oldest purchases first (FIFO)
  FOR v_purchase IN 
    SELECT id, credits_remaining 
    FROM credit_purchases 
    WHERE tenant_id = p_tenant_id 
    AND credits_remaining > 0
    ORDER BY purchased_at ASC
  LOOP
    IF v_remaining_to_consume <= 0 THEN
      EXIT;
    END IF;
    
    v_credits_from_purchase := LEAST(v_purchase.credits_remaining, v_remaining_to_consume);
    
    UPDATE credit_purchases 
    SET credits_remaining = credits_remaining - v_credits_from_purchase
    WHERE id = v_purchase.id;
    
    v_remaining_to_consume := v_remaining_to_consume - v_credits_from_purchase;
  END LOOP;
  
  -- Update tenant_subscriptions tracking
  UPDATE tenant_subscriptions
  SET bonus_credits_used = COALESCE(bonus_credits_used, 0) + (p_credits_to_consume - v_remaining_to_consume)
  WHERE tenant_id = p_tenant_id;
  
  -- Return credits actually consumed
  RETURN p_credits_to_consume - v_remaining_to_consume;
END;
$$;

-- 6. Add function to get total available bonus credits
CREATE OR REPLACE FUNCTION get_tenant_bonus_credits(p_tenant_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_remaining INT;
BEGIN
  SELECT COALESCE(SUM(credits_remaining), 0)
  INTO v_total_remaining
  FROM credit_purchases
  WHERE tenant_id = p_tenant_id;
  
  RETURN v_total_remaining;
END;
$$;