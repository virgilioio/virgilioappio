-- =====================================================
-- Test: Audit Log Immutability
-- =====================================================

BEGIN;

SELECT plan(4);

-- Setup: Insert test audit log entry
INSERT INTO audit.audit_logs (
  id,
  user_id,
  action,
  table_name,
  record_id,
  created_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'TEST_ACTION',
  'test_table',
  '33333333-3333-3333-3333-333333333333',
  now()
);

-- Test 1: Audit log entry exists
SELECT ok(
  EXISTS(SELECT 1 FROM audit.audit_logs WHERE id = '11111111-1111-1111-1111-111111111111'),
  'Audit log entry should exist after insert'
);

-- Test 2: Cannot UPDATE audit log
SELECT throws_ok(
  $$
    UPDATE audit.audit_logs 
    SET action = 'TAMPERED_ACTION' 
    WHERE id = '11111111-1111-1111-1111-111111111111';
  $$,
  '23514',
  NULL,
  'Should NOT allow updating audit log entries'
);

-- Test 3: Cannot DELETE audit log
SELECT throws_ok(
  $$
    DELETE FROM audit.audit_logs 
    WHERE id = '11111111-1111-1111-1111-111111111111';
  $$,
  '23514',
  NULL,
  'Should NOT allow deleting audit log entries'
);

-- Test 4: Verify audit log unchanged after tamper attempts
SELECT is(
  (SELECT action FROM audit.audit_logs WHERE id = '11111111-1111-1111-1111-111111111111'),
  'TEST_ACTION',
  'Audit log action should remain unchanged after update and delete attempts'
);

-- Note: No cleanup needed as ROLLBACK will handle it

SELECT * FROM finish();

ROLLBACK;
