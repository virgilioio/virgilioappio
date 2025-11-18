-- One-time cleanup for allan.bravo@gomotive.com
-- This will allow a fresh signup test

DO $$
DECLARE
  v_user_id uuid := '37c89e3f-2ec9-4492-8200-0f495b93b08d';
  v_tenant_id uuid := '448919c9-15df-4b32-9ba2-ad5edbe0c786';
BEGIN
  RAISE NOTICE 'Starting cleanup for allan.bravo@gomotive.com';
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Tenant ID: %', v_tenant_id;

  -- Delete tenant_subscriptions (if any)
  DELETE FROM tenant_subscriptions WHERE tenant_id = v_tenant_id;
  RAISE NOTICE 'Deleted tenant_subscriptions';

  -- Delete members (if any)
  DELETE FROM members WHERE tenant_id = v_tenant_id OR user_id = v_user_id;
  RAISE NOTICE 'Deleted members';

  -- Delete organizations (if any)
  DELETE FROM organizations WHERE tenant_id = v_tenant_id OR owner_id = v_user_id;
  RAISE NOTICE 'Deleted organizations';

  -- Delete tenant
  DELETE FROM tenants WHERE id = v_tenant_id;
  RAISE NOTICE 'Deleted tenant';

  -- Delete profile
  DELETE FROM profiles WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted profile';

  -- Note: auth.users deletion requires admin API, cannot be done in migration
  -- User can be deleted manually from Supabase Dashboard or via cleanup edge function
  
  RAISE NOTICE 'Cleanup complete! Auth user must be deleted manually from dashboard.';
  RAISE NOTICE 'Navigate to: https://supabase.com/dashboard/project/etrxjxstjfcozdjumfsj/auth/users';
  RAISE NOTICE 'Search for: allan.bravo@gomotive.com';
END $$;