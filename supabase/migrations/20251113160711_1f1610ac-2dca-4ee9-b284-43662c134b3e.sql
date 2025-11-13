-- Cleanup orphaned records for user 7755f1be-4dce-4712-831c-b0241a3ef6e1 (comprehensive)
-- This user has partial signup data that needs to be removed before fresh signup

DO $$
DECLARE
  v_user_id UUID := '7755f1be-4dce-4712-831c-b0241a3ef6e1';
  v_tenant_ids UUID[];
BEGIN
  -- Collect all tenant IDs for this user
  SELECT ARRAY_AGG(DISTINCT tenant_id) INTO v_tenant_ids
  FROM members
  WHERE user_id = v_user_id;
  
  RAISE NOTICE 'Found tenant IDs: %', v_tenant_ids;
  
  -- Delete in order of dependencies
  
  -- 1. Delete candidates linked to organizations owned by these tenants
  DELETE FROM candidates 
  WHERE organization_id = ANY(v_tenant_ids);
  RAISE NOTICE 'Deleted candidates';
  
  -- 2. Delete tenant subscriptions
  DELETE FROM tenant_subscriptions 
  WHERE tenant_id = ANY(v_tenant_ids);
  RAISE NOTICE 'Deleted tenant_subscriptions';
  
  -- 3. Delete member records
  DELETE FROM members WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted members';
  
  -- 4. Delete profile
  DELETE FROM profiles WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted profiles';
  
  -- 5. Delete organizations (root orgs with same ID as tenant)
  DELETE FROM organizations 
  WHERE id = ANY(v_tenant_ids);
  RAISE NOTICE 'Deleted organizations';
  
  -- 6. Delete tenant records
  DELETE FROM tenants WHERE id = ANY(v_tenant_ids);
  RAISE NOTICE 'Deleted tenants';
  
  RAISE NOTICE '✅ Comprehensive cleanup complete for user 7755f1be-4dce-4712-831c-b0241a3ef6e1';
END $$;