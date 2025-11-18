-- Phase 1: Fix CoreSignal Credit Duplication Bug

-- Step 1: Add RPC to consolidate duplicate credit usage records
CREATE OR REPLACE FUNCTION public.consolidate_coresignal_usage(p_tenant_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  duplicate_count INTEGER;
  consolidated_record RECORD;
  result jsonb;
BEGIN
  -- Count duplicates for this tenant
  SELECT COUNT(*) INTO duplicate_count
  FROM public.coresignal_usage
  WHERE tenant_id = p_tenant_id;
  
  IF duplicate_count <= 1 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'No duplicates found',
      'duplicates_removed', 0
    );
  END IF;
  
  -- Get the most recent record with highest usage (keep this one)
  SELECT * INTO consolidated_record
  FROM public.coresignal_usage
  WHERE tenant_id = p_tenant_id
  ORDER BY 
    billing_cycle_start DESC,
    (search_credits_used + collect_credits_used) DESC,
    created_at DESC
  LIMIT 1;
  
  -- Delete all other records for this tenant
  DELETE FROM public.coresignal_usage
  WHERE tenant_id = p_tenant_id
    AND id != consolidated_record.id;
  
  GET DIAGNOSTICS duplicate_count = ROW_COUNT;
  
  result := jsonb_build_object(
    'success', true,
    'message', format('Consolidated %s duplicate records', duplicate_count),
    'duplicates_removed', duplicate_count,
    'kept_record_id', consolidated_record.id,
    'search_credits_used', consolidated_record.search_credits_used,
    'collect_credits_used', consolidated_record.collect_credits_used
  );
  
  RAISE LOG 'Consolidated CoreSignal usage for tenant %: removed % duplicates', p_tenant_id, duplicate_count;
  
  RETURN result;
END;
$$;

-- Step 2: Add unique constraint to prevent future duplicates
-- First, we need to consolidate existing duplicates before adding the constraint
-- The constraint will be added after cleanup in Phase 2

COMMENT ON FUNCTION public.consolidate_coresignal_usage(UUID) IS 
'Consolidates duplicate CoreSignal usage records for a tenant, keeping the most recent record with highest usage';
