-- ============================================================================
-- Fix Seat Limit System: Use max_users, backfill data, fix trial initialization
-- ============================================================================

-- ============================================================================
-- PHASE 1: Fix check_seat_limit function to use max_users instead of seat_quantity
-- ============================================================================

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
  v_seat_limit INTEGER;
  v_is_trial BOOLEAN;
  v_billing_status TEXT;
  v_subscription_tier TEXT;
  v_trial_grace_multiplier NUMERIC := 1.2;
BEGIN
  -- Get current billable seat count
  SELECT COALESCE(get_tenant_billable_seat_count(p_tenant_id), 0) INTO v_current_seats;

  -- Get max_users (tier limit), subscription tier, and billing status
  SELECT 
    ts.max_users,
    ts.subscription_tier,
    (ts.billing_status = 'trialing'),
    COALESCE(ts.billing_status, 'trialing')
  INTO v_seat_limit, v_subscription_tier, v_is_trial, v_billing_status
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id;

  -- If max_users is NULL, derive from tier or use trial default
  IF v_seat_limit IS NULL THEN
    v_seat_limit := CASE v_subscription_tier
      WHEN 'solo' THEN 1
      WHEN 'launch' THEN 5
      WHEN 'growth' THEN 15
      WHEN 'business' THEN 50
      ELSE 5  -- Default for trials without tier
    END;
  END IF;

  -- If no subscription record, treat as trial
  IF v_billing_status IS NULL THEN
    v_seat_limit := 5;
    v_is_trial := TRUE;
    v_billing_status := 'trialing';
  END IF;

  -- Apply policies based on billing status
  IF v_is_trial THEN
    -- TRIAL: Soft limit with 20% grace
    RETURN QUERY SELECT 
      (v_current_seats < (v_seat_limit * v_trial_grace_multiplier)::INTEGER)::BOOLEAN,
      v_current_seats,
      v_seat_limit,
      GREATEST(0, v_current_seats - v_seat_limit),
      v_is_trial,
      v_billing_status;
  ELSE
    -- PAID: Hard limit
    RETURN QUERY SELECT 
      (v_current_seats < v_seat_limit)::BOOLEAN,
      v_current_seats,
      v_seat_limit,
      GREATEST(0, v_current_seats - v_seat_limit),
      v_is_trial,
      v_billing_status;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.check_seat_limit IS 
  'Fixed: Uses max_users (tier-based limit) instead of seat_quantity. Soft limits (20% grace) for trials, hard limits for paid plans';

-- ============================================================================
-- PHASE 2: Backfill max_users for existing tenants based on subscription_tier
-- ============================================================================

UPDATE tenant_subscriptions
SET max_users = CASE subscription_tier
  WHEN 'solo' THEN 1
  WHEN 'launch' THEN 5
  WHEN 'growth' THEN 15
  WHEN 'business' THEN 50
  ELSE 5  -- Default for NULL tier (trials)
END
WHERE max_users IS NULL;

-- ============================================================================
-- PHASE 3: Update init_trial_on_tenant_subscription to set default max_users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.init_trial_on_tenant_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only initialize if trial fields are NULL (allow explicit overrides)
  IF NEW.trial_started_at IS NULL THEN
    NEW.trial_started_at := now();
    NEW.trial_ends_at := now() + INTERVAL '14 days';
    NEW.trial_source := COALESCE(NEW.trial_source, 'self_signup');
    NEW.billing_status := 'trialing';
    
    RAISE LOG 'Trial initialized for tenant %: ends at %', 
      NEW.tenant_id, NEW.trial_ends_at;
  END IF;
  
  -- Set default max_users for trials if not already set
  IF NEW.max_users IS NULL THEN
    NEW.max_users := 5;  -- Default trial limit (Launch tier equivalent)
    RAISE LOG 'Default max_users (5) set for tenant %', NEW.tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.init_trial_on_tenant_subscription IS 
  'Auto-initialize 14-day trial with default max_users=5 when tenant_subscriptions row is created';