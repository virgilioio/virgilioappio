-- Update get_tenant_credit_limits function to support Solo tier
CREATE OR REPLACE FUNCTION get_tenant_credit_limits(p_tenant_id UUID)
RETURNS TABLE(search_limit INT, collect_limit INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier TEXT;
  v_billing_status TEXT;
BEGIN
  SELECT subscription_tier, billing_status
  INTO v_tier, v_billing_status
  FROM tenant_subscriptions
  WHERE tenant_id = p_tenant_id;
  
  -- Trial users get Launch tier limits
  IF v_billing_status = 'trialing' THEN
    RETURN QUERY SELECT 25::INT, 10::INT;
    RETURN;
  END IF;
  
  -- Return limits based on tier
  CASE v_tier
    WHEN 'solo' THEN
      RETURN QUERY SELECT 25::INT, 10::INT;
    WHEN 'launch' THEN
      RETURN QUERY SELECT 25::INT, 10::INT;
    WHEN 'growth' THEN
      RETURN QUERY SELECT 100::INT, 50::INT;
    WHEN 'business' THEN
      RETURN QUERY SELECT 250::INT, 125::INT;
    ELSE
      -- Default to Launch tier limits
      RETURN QUERY SELECT 25::INT, 10::INT;
  END CASE;
END;
$$;