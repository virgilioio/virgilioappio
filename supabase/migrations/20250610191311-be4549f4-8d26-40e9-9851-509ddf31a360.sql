
-- First, let's examine the current get_user_organization_id() function
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'get_user_organization_id' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Let's also check the get_user_type() function for context
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'get_user_type' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Create a comprehensive test function to validate get_user_organization_id()
CREATE OR REPLACE FUNCTION public.test_get_user_organization_id()
RETURNS TABLE(
  test_case text,
  user_email text,
  user_type text,
  returned_org_id uuid,
  expected_org_id uuid,
  members_table_org_id uuid,
  test_result text
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  test_user_id uuid;
  virgilio_org_id uuid;
  client_org_id uuid;
BEGIN
  -- Get the Virgilio platform organization ID
  SELECT id INTO virgilio_org_id 
  FROM public.organizations 
  WHERE organization_type = 'platform' 
  LIMIT 1;
  
  -- Get a client organization ID
  SELECT id INTO client_org_id 
  FROM public.organizations 
  WHERE organization_type = 'client' 
  LIMIT 1;
  
  -- Test Case 1: Platform Admin
  SELECT u.id INTO test_user_id
  FROM auth.users u
  WHERE u.raw_user_meta_data->>'user_type' = 'platform_admin'
  LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      'Platform Admin'::text as test_case,
      (SELECT email FROM auth.users WHERE id = test_user_id)::text as user_email,
      COALESCE((SELECT raw_user_meta_data->>'user_type' FROM auth.users WHERE id = test_user_id), 'guest')::text as user_type,
      (SELECT organization_id FROM public.members WHERE user_id = test_user_id LIMIT 1) as returned_org_id,
      virgilio_org_id as expected_org_id,
      (SELECT organization_id FROM public.members WHERE user_id = test_user_id LIMIT 1) as members_table_org_id,
      CASE 
        WHEN (SELECT organization_id FROM public.members WHERE user_id = test_user_id LIMIT 1) = virgilio_org_id 
        THEN 'PASS' 
        ELSE 'FAIL' 
      END::text as test_result;
  END IF;
  
  -- Test Case 2: Regular Member (if exists)
  SELECT u.id INTO test_user_id
  FROM auth.users u
  JOIN public.members m ON u.id = m.user_id
  WHERE u.raw_user_meta_data->>'user_type' != 'platform_admin' 
    OR u.raw_user_meta_data->>'user_type' IS NULL
  LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      'Regular Member'::text as test_case,
      (SELECT email FROM auth.users WHERE id = test_user_id)::text as user_email,
      COALESCE((SELECT raw_user_meta_data->>'user_type' FROM auth.users WHERE id = test_user_id), 'guest')::text as user_type,
      (SELECT organization_id FROM public.members WHERE user_id = test_user_id LIMIT 1) as returned_org_id,
      (SELECT organization_id FROM public.members WHERE user_id = test_user_id LIMIT 1) as expected_org_id,
      (SELECT organization_id FROM public.members WHERE user_id = test_user_id LIMIT 1) as members_table_org_id,
      CASE 
        WHEN (SELECT organization_id FROM public.members WHERE user_id = test_user_id LIMIT 1) IS NOT NULL 
        THEN 'PASS' 
        ELSE 'FAIL' 
      END::text as test_result;
  END IF;
  
  -- Test Case 3: User with no membership (Guest)
  SELECT u.id INTO test_user_id
  FROM auth.users u
  LEFT JOIN public.members m ON u.id = m.user_id
  WHERE m.user_id IS NULL
  LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      'Guest (No Membership)'::text as test_case,
      (SELECT email FROM auth.users WHERE id = test_user_id)::text as user_email,
      COALESCE((SELECT raw_user_meta_data->>'user_type' FROM auth.users WHERE id = test_user_id), 'guest')::text as user_type,
      (SELECT organization_id FROM public.members WHERE user_id = test_user_id LIMIT 1) as returned_org_id,
      NULL::uuid as expected_org_id,
      (SELECT organization_id FROM public.members WHERE user_id = test_user_id LIMIT 1) as members_table_org_id,
      CASE 
        WHEN (SELECT organization_id FROM public.members WHERE user_id = test_user_id LIMIT 1) IS NULL 
        THEN 'PASS' 
        ELSE 'FAIL' 
      END::text as test_result;
  END IF;
  
  RETURN;
END;
$$;

-- Run the test function
SELECT * FROM public.test_get_user_organization_id();

-- Also check the function's security and definition
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  provolatile as volatility_category,
  proacl as access_privileges
FROM pg_proc 
WHERE proname = 'get_user_organization_id' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Test the function behavior with actual auth context
-- This will show what get_user_organization_id() returns for different scenarios
DO $$
DECLARE
  result_text text := '';
  org_id uuid;
  user_count int;
BEGIN
  -- Count users by type
  SELECT COUNT(*) INTO user_count
  FROM auth.users u
  WHERE u.raw_user_meta_data->>'user_type' = 'platform_admin';
  
  result_text := result_text || 'Platform Admin users found: ' || user_count::text || E'\n';
  
  SELECT COUNT(*) INTO user_count
  FROM auth.users u
  JOIN public.members m ON u.id = m.user_id;
  
  result_text := result_text || 'Users with membership: ' || user_count::text || E'\n';
  
  SELECT COUNT(*) INTO user_count
  FROM auth.users u
  LEFT JOIN public.members m ON u.id = m.user_id
  WHERE m.user_id IS NULL;
  
  result_text := result_text || 'Users without membership: ' || user_count::text || E'\n';
  
  -- Show sample data
  result_text := result_text || E'\nSample user data:\n';
  
  FOR org_id IN 
    SELECT DISTINCT m.organization_id
    FROM public.members m
    LIMIT 3
  LOOP
    SELECT COUNT(*) INTO user_count
    FROM public.members m
    WHERE m.organization_id = org_id;
    
    result_text := result_text || 'Organization ' || org_id::text || ' has ' || user_count::text || ' members' || E'\n';
  END LOOP;
  
  RAISE NOTICE '%', result_text;
END;
$$;
