-- Phase 2: Clean Up Existing Duplicates and Add Unique Constraint

-- Step 1: Consolidate duplicates for all tenants with duplicates
DO $$
DECLARE
  tenant_rec RECORD;
  result jsonb;
BEGIN
  -- Loop through all tenants that have duplicate coresignal_usage records
  FOR tenant_rec IN 
    SELECT tenant_id, COUNT(*) as duplicate_count
    FROM public.coresignal_usage
    GROUP BY tenant_id
    HAVING COUNT(*) > 1
  LOOP
    -- Call consolidation function for each tenant with duplicates
    SELECT public.consolidate_coresignal_usage(tenant_rec.tenant_id) INTO result;
    RAISE LOG 'Consolidated tenant %: %', tenant_rec.tenant_id, result;
  END LOOP;
END $$;

-- Step 2: Add unique constraint to prevent future duplicates
-- This ensures only one usage record per tenant per billing cycle
ALTER TABLE public.coresignal_usage
ADD CONSTRAINT coresignal_usage_tenant_cycle_unique 
UNIQUE (tenant_id, billing_cycle_start);

COMMENT ON CONSTRAINT coresignal_usage_tenant_cycle_unique ON public.coresignal_usage IS 
'Prevents duplicate credit usage records for the same tenant and billing cycle';
