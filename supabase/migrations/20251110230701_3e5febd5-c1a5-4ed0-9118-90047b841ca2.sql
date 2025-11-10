-- Phase 2: Seat Limit Enforcement - Hybrid Approach
-- Soft limits for trials (20% grace), hard limits for paid plans

-- Function to check if tenant can add more billable seats
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
  v_trial_grace_multiplier NUMERIC := 1.2; -- 20% overage allowed for trials
BEGIN
  -- Get current billable seat count
  SELECT COALESCE(get_tenant_billable_seat_count(p_tenant_id), 0) INTO v_current_seats;

  -- Get seat limit and billing status from subscription
  SELECT 
    COALESCE(ts.seat_quantity, 5),  -- Default to 5 for new tenants
    (ts.billing_status = 'trialing'),
    COALESCE(ts.billing_status, 'trialing')
  INTO v_seat_limit, v_is_trial, v_billing_status
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id;

  -- If no subscription record exists, treat as trial with 5 seats
  IF v_seat_limit IS NULL THEN
    v_seat_limit := 5;
    v_is_trial := TRUE;
    v_billing_status := 'trialing';
  END IF;

  -- Apply different policies based on billing status
  IF v_is_trial THEN
    -- TRIAL: Soft limit with 20% grace (e.g., 5 seats = allow up to 6)
    RETURN QUERY SELECT 
      (v_current_seats < (v_seat_limit * v_trial_grace_multiplier)::INTEGER)::BOOLEAN,
      v_current_seats,
      v_seat_limit,
      GREATEST(0, v_current_seats - v_seat_limit),
      v_is_trial,
      v_billing_status;
  ELSE
    -- PAID: Hard limit (no overage allowed)
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.check_seat_limit(UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.check_seat_limit IS 
  'Hybrid seat limit enforcement: Soft limits (20% grace) for trials, hard limits for paid plans';