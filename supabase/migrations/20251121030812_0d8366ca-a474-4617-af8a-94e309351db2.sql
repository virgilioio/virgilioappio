
-- Comprehensive cleanup for allan.bravo@gomotive.com and all Motive tenants
-- This removes all related data: members, subscriptions, organizations, tenants, and profile

DO $$
DECLARE
  v_user_id uuid := '849d4147-d5c8-4475-a45d-6c2b8c9a0781';
  v_tenant_ids uuid[] := ARRAY[
    'da714c28-57f4-44d9-97b4-8cb6b506479f',
    '7a78f1cd-764f-48d9-8fd8-d8dbb94a00bc',
    '41734dab-8df4-4f00-8d79-866e6fc69d22',
    'b2943bfe-9f0e-48ac-a8ea-43bdd5087c06'
  ]::uuid[];
  v_deleted_count int;
BEGIN
  -- Delete members (for both user and tenants)
  DELETE FROM public.members 
  WHERE user_id = v_user_id 
     OR tenant_id = ANY(v_tenant_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % member records', v_deleted_count;

  -- Delete tenant subscriptions
  DELETE FROM public.tenant_subscriptions
  WHERE tenant_id = ANY(v_tenant_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % subscription records', v_deleted_count;

  -- Delete coresignal usage
  DELETE FROM public.coresignal_usage
  WHERE tenant_id = ANY(v_tenant_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % coresignal usage records', v_deleted_count;

  -- Delete organizations
  DELETE FROM public.organizations
  WHERE tenant_id = ANY(v_tenant_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % organization records', v_deleted_count;

  -- Delete tenants
  DELETE FROM public.tenants
  WHERE id = ANY(v_tenant_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % tenant records', v_deleted_count;

  -- Delete profile
  DELETE FROM public.profiles
  WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % profile records', v_deleted_count;

  RAISE NOTICE 'Cleanup complete for allan.bravo@gomotive.com and all Motive tenants';
END $$;
