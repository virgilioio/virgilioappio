-- ============================================================
-- Phase 2 Cycle 1: Lock Legacy Table (Read-Only)
-- ============================================================
-- Prevent any further writes to job_candidates before final drop
-- ============================================================

-- Enable RLS on job_candidates
ALTER TABLE job_candidates ENABLE ROW LEVEL SECURITY;

-- Create read-only policy (blocks all writes)
CREATE POLICY job_candidates_readonly
  ON job_candidates
  FOR ALL
  USING (true)      -- Allow reads
  WITH CHECK (false); -- Block all writes (INSERT/UPDATE/DELETE)

-- Log the lock
DO $$
BEGIN
  RAISE NOTICE '🔒 job_candidates table is now READ-ONLY';
  RAISE NOTICE '   All writes will be rejected';
  RAISE NOTICE '   Preparing for table drop after final verification';
END $$;