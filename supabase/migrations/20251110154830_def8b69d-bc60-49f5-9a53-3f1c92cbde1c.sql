-- =====================================================
-- Phase 1.5: Install pgTAP Testing Framework
-- =====================================================

-- Install pgTAP extension
CREATE EXTENSION IF NOT EXISTS pgtap SCHEMA extensions;

-- Create schema for test helpers
CREATE SCHEMA IF NOT EXISTS tests;

-- Test helper: simulate authenticated user context
CREATE OR REPLACE FUNCTION tests.set_test_user(
  p_user_id uuid,
  p_user_type text DEFAULT 'workspace_owner',
  p_member_role text DEFAULT 'admin'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', p_user_id,
    'role', 'authenticated',
    'user_type', p_user_type
  )::text, true);
END;
$$;

-- Test helper: create test organizations
CREATE OR REPLACE FUNCTION tests.create_test_org(
  p_name text,
  p_tenant_id uuid DEFAULT NULL,
  p_is_parent boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_tenant_id uuid;
BEGIN
  v_tenant_id := COALESCE(p_tenant_id, gen_random_uuid());
  
  INSERT INTO public.organizations (
    name, tenant_id, parent_organization_id, org_kind, status, tenant_type
  ) VALUES (
    p_name, v_tenant_id,
    CASE WHEN p_is_parent THEN NULL ELSE p_tenant_id END,
    'client', 'active', 'enterprise'
  )
  RETURNING id INTO v_org_id;
  
  RETURN v_org_id;
END;
$$;

-- Test helper: create test members
CREATE OR REPLACE FUNCTION tests.create_test_member(
  p_user_id uuid,
  p_org_id uuid,
  p_user_type text DEFAULT 'workspace_owner',
  p_member_role text DEFAULT 'admin',
  p_email text DEFAULT 'test@example.com'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.organizations WHERE id = p_org_id;
  
  INSERT INTO public.members (
    user_id, organization_id, tenant_id, user_type, member_role, user_status, user_email
  ) VALUES (
    p_user_id, p_org_id, v_tenant_id,
    p_user_type::public.user_type_enum,
    p_member_role::public.member_role,
    'active', p_email
  )
  RETURNING id INTO v_member_id;
  
  RETURN v_member_id;
END;
$$;

-- Test helper: cleanup test data
CREATE OR REPLACE FUNCTION tests.cleanup_test_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.job_assignments WHERE job_id IN (SELECT id FROM public.jobs WHERE title LIKE 'TEST_%');
  DELETE FROM public.jobs WHERE title LIKE 'TEST_%';
  DELETE FROM public.members WHERE user_email LIKE '%@test.example.com';
  DELETE FROM public.organizations WHERE name LIKE 'TEST_%';
  DELETE FROM public.candidates WHERE candidate_name LIKE 'TEST_%';
  DELETE FROM public.invitations WHERE email LIKE '%@test.example.com';
END;
$$;