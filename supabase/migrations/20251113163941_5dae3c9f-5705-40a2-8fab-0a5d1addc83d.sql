-- Cleanup orphaned profile and failed signup artifacts
-- for allan.bravo@gomotive.com

DO $$
DECLARE
  v_user_id UUID := '6320175e-e8b9-4bf2-a420-a16cff7cf3e8';
  v_failed_tenant_id UUID := 'a72e9a48-b441-4567-b1ea-fbd0a336760c';
BEGIN
  -- Delete failed signup organization
  DELETE FROM organizations 
  WHERE id = v_failed_tenant_id;
  RAISE NOTICE 'Deleted failed signup organization: %', v_failed_tenant_id;
  
  -- Delete failed signup tenant
  DELETE FROM tenants 
  WHERE id = v_failed_tenant_id;
  RAISE NOTICE 'Deleted failed signup tenant: %', v_failed_tenant_id;
  
  -- Delete orphaned profile (THE KEY FIX)
  DELETE FROM profiles 
  WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted orphaned profile for user: %', v_user_id;
  
  RAISE NOTICE '✅ Complete cleanup finished for allan.bravo@gomotive.com';
  RAISE NOTICE '✅ User can now sign up fresh with no conflicts';
END $$;