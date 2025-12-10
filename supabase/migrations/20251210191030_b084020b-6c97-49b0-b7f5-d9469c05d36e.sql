-- Create the missing increment_sourcing_usage function
CREATE OR REPLACE FUNCTION public.increment_sourcing_usage(
  p_tenant_id uuid, 
  p_billing_cycle_start timestamp with time zone, 
  p_credit_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_credit_type = 'search' THEN
    UPDATE sourcing_credits_usage
    SET 
      search_credits_used = search_credits_used + 1,
      last_search_at = NOW(),
      updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND billing_cycle_start = p_billing_cycle_start;
  ELSIF p_credit_type = 'collect' THEN
    UPDATE sourcing_credits_usage
    SET 
      collect_credits_used = collect_credits_used + 1,
      last_collect_at = NOW(),
      updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND billing_cycle_start = p_billing_cycle_start;
  END IF;
END;
$$;

-- Clear stale cache to force fresh Apollo searches with correct data mapping
UPDATE sourcing_projects 
SET sourcing_cache_expires_at = NULL, sourcing_candidate_count = 0;

-- Delete cached preview candidates (will be repopulated with correct location/linkedin data)
DELETE FROM sourcing_preview_candidates;