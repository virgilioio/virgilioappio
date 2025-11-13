
-- Comprehensive Motive account deletion (cleanup #5)
-- Tenant/Org ID: d2d290c9-36fd-44d9-a8ae-9a16723fd1bc
-- User ID: 91a123a4-af84-48d0-8edb-13e44c2fbb4a

DO $$
DECLARE
  v_tenant_id UUID := 'd2d290c9-36fd-44d9-a8ae-9a16723fd1bc';
  v_user_id UUID := '91a123a4-af84-48d0-8edb-13e44c2fbb4a';
BEGIN
  -- Delete in order of dependencies
  
  -- 1. Delete tenant subscription
  DELETE FROM tenant_subscriptions WHERE tenant_id = v_tenant_id;
  RAISE NOTICE 'Deleted tenant_subscriptions';
  
  -- 2. Delete member record
  DELETE FROM members WHERE user_id = v_user_id AND tenant_id = v_tenant_id;
  RAISE NOTICE 'Deleted members';
  
  -- 3. Delete profile
  DELETE FROM profiles WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted profiles';
  
  -- 4. Delete root organization (FK dependency on tenant)
  DELETE FROM organizations 
  WHERE id = v_tenant_id 
    AND name = 'Motive' 
    AND org_kind = 'root';
  RAISE NOTICE 'Deleted organizations';
  
  -- 5. Delete tenant (final step)
  DELETE FROM tenants 
  WHERE id = v_tenant_id 
    AND name = 'Motive';
  RAISE NOTICE 'Deleted tenants';
  
  -- Verification
  IF EXISTS (SELECT 1 FROM tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Tenant deletion failed';
  END IF;
  
  IF EXISTS (SELECT 1 FROM organizations WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Organization deletion failed';
  END IF;
  
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Profile deletion failed';
  END IF;
  
  RAISE NOTICE '✅ Motive database cleanup successful - ready for fresh signup';
END $$;
