-- =====================================================
-- Test: Members Can Only Belong to Parent Organizations
-- =====================================================

BEGIN;

SELECT plan(4);

-- Setup: Create parent and child organizations
SELECT tests.cleanup_test_data();

INSERT INTO public.organizations (id, name, tenant_id, parent_organization_id, org_kind, status)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'TEST_Parent_Org', '22222222-2222-2222-2222-222222222222', NULL, 'client', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'TEST_Child_Org', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'client', 'active');

-- Test 1: Can insert member into parent organization
SELECT lives_ok(
  $$
    INSERT INTO public.members (user_id, organization_id, tenant_id, user_type, member_role, user_status)
    VALUES (
      '44444444-4444-4444-4444-444444444444',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      'workspace_owner',
      'admin',
      'active'
    );
  $$,
  'Should allow inserting member into parent organization'
);

-- Test 2: Cannot insert member into child organization
SELECT throws_ok(
  $$
    INSERT INTO public.members (user_id, organization_id, tenant_id, user_type, member_role, user_status)
    VALUES (
      '55555555-5555-5555-5555-555555555555',
      '33333333-3333-3333-3333-333333333333',
      '22222222-2222-2222-2222-222222222222',
      'workspace_owner',
      'admin',
      'active'
    );
  $$,
  NULL,
  'Cannot insert member into child organization (trigger should prevent)'
);

-- Test 3: Cannot update member to child organization
SELECT throws_ok(
  $$
    UPDATE public.members 
    SET organization_id = '33333333-3333-3333-3333-333333333333'
    WHERE user_id = '44444444-4444-4444-4444-444444444444';
  $$,
  NULL,
  'Cannot update member to child organization (trigger should prevent)'
);

-- Test 4: Member organization_id must not be null for active members
SELECT col_not_null(
  'public',
  'members',
  'organization_id',
  'organization_id column should be NOT NULL'
);

-- Cleanup
SELECT tests.cleanup_test_data();

SELECT * FROM finish();

ROLLBACK;
