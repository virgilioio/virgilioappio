-- =====================================================
-- Test: Recruiters Cannot Delete Jobs
-- =====================================================

BEGIN;

SELECT plan(3);

-- Setup
SELECT tests.cleanup_test_data();

-- Create test organization and users
INSERT INTO public.organizations (id, name, tenant_id, org_kind, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'TEST_Org', '22222222-2222-2222-2222-222222222222', 'client', 'active');

-- Create workspace owner
INSERT INTO public.members (user_id, organization_id, tenant_id, user_type, member_role, user_status)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'workspace_owner',
  'admin',
  'active'
);

-- Create recruiter
INSERT INTO public.members (user_id, organization_id, tenant_id, user_type, member_role, user_status)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'workspace_owner',
  'recruiter',
  'active'
);

-- Create test job
INSERT INTO public.jobs (id, title, level, status, organization_id, created_by)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  'TEST_Senior_Engineer',
  'L2 - Managers',
  'open',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333'
);

-- Test 1: Workspace owner CAN delete jobs
SELECT tests.set_test_user('33333333-3333-3333-3333-333333333333', 'workspace_owner', 'admin');
SELECT lives_ok(
  $$
    DELETE FROM public.jobs WHERE id = '55555555-5555-5555-5555-555555555555';
  $$,
  'Workspace owner should be able to delete jobs'
);

-- Recreate job for recruiter test
INSERT INTO public.jobs (id, title, level, status, organization_id, created_by)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  'TEST_Product_Manager',
  'L2 - Managers',
  'open',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333'
);

-- Test 2: Recruiter CANNOT delete jobs
SELECT tests.set_test_user('44444444-4444-4444-4444-444444444444', 'workspace_owner', 'recruiter');
SELECT throws_ok(
  $$
    DELETE FROM public.jobs WHERE id = '66666666-6666-6666-6666-666666666666';
  $$,
  NULL,
  'Recruiter should NOT be able to delete jobs'
);

-- Test 3: Job still exists after recruiter delete attempt
SELECT ok(
  EXISTS(SELECT 1 FROM public.jobs WHERE id = '66666666-6666-6666-6666-666666666666'),
  'Job should still exist after recruiter delete attempt'
);

-- Cleanup
SELECT tests.cleanup_test_data();

SELECT * FROM finish();

ROLLBACK;
