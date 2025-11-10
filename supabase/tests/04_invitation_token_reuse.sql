-- =====================================================
-- Test: Invitation Token Reuse Prevention
-- =====================================================

BEGIN;

SELECT plan(3);

-- Setup
SELECT tests.cleanup_test_data();

-- Create test organization
INSERT INTO public.organizations (id, name, tenant_id, org_kind, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'TEST_Org', '22222222-2222-2222-2222-222222222222', 'client', 'active');

-- Create test invitation
INSERT INTO public.invitations (
  id,
  organization_id,
  email,
  member_role,
  invite_token,
  invite_expires_at
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'newuser@test.example.com',
  'recruiter',
  '44444444-4444-4444-4444-444444444444',
  now() + INTERVAL '7 days'
);

-- Test 1: Can mark invitation as used
SELECT lives_ok(
  $$
    UPDATE public.invitations 
    SET used_at = now() 
    WHERE id = '33333333-3333-3333-3333-333333333333';
  $$,
  'Should allow marking invitation as used (setting used_at)'
);

-- Test 2: Cannot modify invitation after it's been used
SELECT throws_ok(
  $$
    UPDATE public.invitations 
    SET email = 'different@test.example.com' 
    WHERE id = '33333333-3333-3333-3333-333333333333';
  $$,
  '23514',
  NULL,
  'Should NOT allow modifying invitation after it has been used'
);

-- Test 3: Verify invitation still has original email (not modified)
SELECT is(
  (SELECT email FROM public.invitations WHERE id = '33333333-3333-3333-3333-333333333333'),
  'newuser@test.example.com',
  'Invitation email should remain unchanged after failed update attempt'
);

-- Cleanup
SELECT tests.cleanup_test_data();

SELECT * FROM finish();

ROLLBACK;
