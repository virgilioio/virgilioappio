-- Phase 1-3: Billing-Cycle-Aligned Credit Architecture + Tier Limits + User Limits (Fixed v3)

-- ============= PHASE 1: CREDIT ARCHITECTURE =============

-- Step 1: Add tenant_id to coresignal_usage
ALTER TABLE coresignal_usage 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_coresignal_usage_tenant 
  ON coresignal_usage(tenant_id);

-- Step 2: Populate tenant_id from organization_id
UPDATE coresignal_usage cu
SET tenant_id = o.tenant_id
FROM organizations o
WHERE cu.organization_id = o.id
  AND cu.tenant_id IS NULL;

-- Step 3: Make tenant_id NOT NULL
ALTER TABLE coresignal_usage 
ALTER COLUMN tenant_id SET NOT NULL;

-- Step 4: Add billing_cycle_start to track billing period
ALTER TABLE coresignal_usage
ADD COLUMN IF NOT EXISTS billing_cycle_start TIMESTAMPTZ;

-- Step 5: Populate billing_cycle_start from month
UPDATE coresignal_usage
SET billing_cycle_start = month::timestamptz
WHERE billing_cycle_start IS NULL;

-- Step 6: Make billing_cycle_start NOT NULL
ALTER TABLE coresignal_usage
ALTER COLUMN billing_cycle_start SET NOT NULL;

-- Step 7: Create temporary aggregation table
CREATE TEMP TABLE IF NOT EXISTS coresignal_usage_consolidated AS
SELECT 
  tenant_id, 
  billing_cycle_start,
  SUM(search_credits_used) as total_search_used,
  SUM(collect_credits_used) as total_collect_used,
  MAX(search_credits_limit) as search_limit,
  MAX(collect_credits_limit) as collect_limit,
  MAX(last_search_at) as last_search,
  MAX(last_collect_at) as last_collect,
  (ARRAY_AGG(id ORDER BY created_at ASC))[1] as keep_id
FROM coresignal_usage
GROUP BY tenant_id, billing_cycle_start;

-- Step 8: Update the records we want to keep
UPDATE coresignal_usage cu
SET 
  search_credits_used = c.total_search_used,
  collect_credits_used = c.total_collect_used,
  search_credits_limit = c.search_limit,
  collect_credits_limit = c.collect_limit,
  last_search_at = c.last_search,
  last_collect_at = c.last_collect
FROM coresignal_usage_consolidated c
WHERE cu.id = c.keep_id;

-- Step 9: Delete duplicates
DELETE FROM coresignal_usage cu
WHERE cu.id NOT IN (SELECT keep_id FROM coresignal_usage_consolidated);

-- Step 10: Clean up temp table
DROP TABLE IF EXISTS coresignal_usage_consolidated;

-- Step 11: Drop old RLS policy that depends on organization_id
DROP POLICY IF EXISTS "Org members can view their org's CoreSignal usage" ON coresignal_usage;

-- Step 12: Drop old columns and constraints
ALTER TABLE coresignal_usage
DROP CONSTRAINT IF EXISTS coresignal_usage_organization_id_month_key;

ALTER TABLE coresignal_usage
DROP COLUMN IF EXISTS organization_id,
DROP COLUMN IF EXISTS month;

-- Step 13: Create new RLS policy using tenant_id
CREATE POLICY "Tenant members can view their tenant's CoreSignal usage" 
ON coresignal_usage
FOR SELECT 
USING (
  tenant_id IN (
    SELECT o.tenant_id 
    FROM organizations o
    JOIN members m ON m.organization_id = o.id
    WHERE m.user_id = auth.uid() 
      AND m.user_status = 'active'
  )
);

-- Step 14: Add new unique constraint
ALTER TABLE coresignal_usage
DROP CONSTRAINT IF EXISTS coresignal_usage_tenant_billing_cycle_key;

ALTER TABLE coresignal_usage
ADD CONSTRAINT coresignal_usage_tenant_billing_cycle_key 
UNIQUE (tenant_id, billing_cycle_start);

CREATE INDEX IF NOT EXISTS idx_coresignal_usage_tenant_cycle 
  ON coresignal_usage(tenant_id, billing_cycle_start DESC);

-- ============= PHASE 2: TIER-BASED CREDIT LIMITS =============

-- Function to get credit limits based on subscription tier
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
  
  IF v_billing_status = 'trialing' THEN
    RETURN QUERY SELECT 25::INT, 10::INT;
    RETURN;
  END IF;
  
  CASE v_tier
    WHEN 'launch' THEN
      RETURN QUERY SELECT 25::INT, 10::INT;
    WHEN 'growth' THEN
      RETURN QUERY SELECT 100::INT, 50::INT;
    WHEN 'business' THEN
      RETURN QUERY SELECT 250::INT, 125::INT;
    ELSE
      RETURN QUERY SELECT 25::INT, 10::INT;
  END CASE;
END;
$$;

-- Trigger to auto-set credit limits
CREATE OR REPLACE FUNCTION auto_set_coresignal_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_limits RECORD;
BEGIN
  IF NEW.search_credits_limit IS NULL OR NEW.collect_credits_limit IS NULL THEN
    SELECT * INTO v_limits FROM get_tenant_credit_limits(NEW.tenant_id);
    NEW.search_credits_limit := v_limits.search_limit;
    NEW.collect_credits_limit := v_limits.collect_limit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_coresignal_limits ON coresignal_usage;
CREATE TRIGGER trg_auto_set_coresignal_limits
BEFORE INSERT ON coresignal_usage
FOR EACH ROW
EXECUTE FUNCTION auto_set_coresignal_limits();

-- ============= PHASE 3: USER LIMIT ENFORCEMENT =============

-- Add max_users column to tenant_subscriptions
ALTER TABLE tenant_subscriptions
ADD COLUMN IF NOT EXISTS max_users INTEGER;

-- Populate based on tier (3 tiers only)
UPDATE tenant_subscriptions
SET max_users = CASE subscription_tier
  WHEN 'launch' THEN 5
  WHEN 'growth' THEN 15
  WHEN 'business' THEN 50
  ELSE 5
END
WHERE max_users IS NULL;

-- Function to check if tenant can add more users
CREATE OR REPLACE FUNCTION can_add_tenant_user(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_users INTEGER;
  v_current_count INTEGER;
BEGIN
  SELECT max_users INTO v_max_users
  FROM tenant_subscriptions
  WHERE tenant_id = p_tenant_id;
  
  IF v_max_users IS NULL THEN
    v_max_users := 5;
  END IF;
  
  SELECT COUNT(*) INTO v_current_count
  FROM members m
  JOIN organizations o ON m.organization_id = o.id
  WHERE o.tenant_id = p_tenant_id
    AND m.user_status = 'active';
  
  RETURN v_current_count < v_max_users;
END;
$$;

-- RPC for safe credit incrementing
CREATE OR REPLACE FUNCTION increment_coresignal_usage(
  p_tenant_id UUID,
  p_billing_cycle_start TIMESTAMPTZ,
  p_credit_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_credit_type = 'search' THEN
    UPDATE coresignal_usage
    SET 
      search_credits_used = search_credits_used + 1,
      last_search_at = NOW(),
      updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND billing_cycle_start = p_billing_cycle_start;
  ELSIF p_credit_type = 'collect' THEN
    UPDATE coresignal_usage
    SET 
      collect_credits_used = collect_credits_used + 1,
      last_collect_at = NOW(),
      updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND billing_cycle_start = p_billing_cycle_start;
  END IF;
END;
$$;