-- Clean up all Motive and allan.bravo@gomotive.com data
DO $$
DECLARE
  v_user_id uuid;
  v_tenant_ids uuid[];
  v_deleted_count int;
BEGIN
  -- Get user_id for allan.bravo@gomotive.com
  SELECT user_id INTO v_user_id 
  FROM public.profiles 
  WHERE email = 'allan.bravo@gomotive.com';

  -- Get all tenant IDs related to Motive
  SELECT ARRAY_AGG(DISTINCT id) INTO v_tenant_ids
  FROM public.tenants
  WHERE name ILIKE '%motive%';

  -- If user exists, add their tenant_id from members
  IF v_user_id IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT tenant_id) INTO v_tenant_ids
    FROM (
      SELECT unnest(v_tenant_ids) as tenant_id
      UNION
      SELECT tenant_id FROM public.members WHERE user_id = v_user_id
    ) t;
  END IF;

  RAISE NOTICE 'Cleaning up user_id: %, tenant_ids: %', v_user_id, v_tenant_ids;

  -- Delete members
  DELETE FROM public.members 
  WHERE (v_user_id IS NOT NULL AND user_id = v_user_id)
     OR (v_tenant_ids IS NOT NULL AND tenant_id = ANY(v_tenant_ids))
     OR invited_email = 'allan.bravo@gomotive.com';
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % member records', v_deleted_count;

  -- Delete tenant subscriptions
  IF v_tenant_ids IS NOT NULL THEN
    DELETE FROM public.tenant_subscriptions WHERE tenant_id = ANY(v_tenant_ids);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % subscription records', v_deleted_count;

    -- Delete coresignal usage
    DELETE FROM public.coresignal_usage WHERE tenant_id = ANY(v_tenant_ids);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % coresignal usage records', v_deleted_count;

    -- Delete organizations
    DELETE FROM public.organizations WHERE tenant_id = ANY(v_tenant_ids);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % organization records', v_deleted_count;

    -- Delete tenants
    DELETE FROM public.tenants WHERE id = ANY(v_tenant_ids);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % tenant records', v_deleted_count;
  END IF;

  -- Delete profile
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % profile records', v_deleted_count;
  END IF;

  RAISE NOTICE 'Cleanup complete';
END $$;
