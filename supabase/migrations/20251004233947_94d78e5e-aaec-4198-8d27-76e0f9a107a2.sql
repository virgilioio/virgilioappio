-- ============================================================
-- Phase 2 Cycle 1: DROP Legacy Table (FINAL STEP)
-- ============================================================
-- Remove job_candidates table and all dependencies
-- This is irreversible - ensure backups exist
-- ============================================================

-- Drop the read-only policy first
DROP POLICY IF EXISTS job_candidates_readonly ON job_candidates;

-- Drop the legacy table with CASCADE to remove all dependencies
DROP TABLE IF EXISTS job_candidates CASCADE;

-- Log the completion
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ LEGACY TABLE DROPPED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'job_candidates table has been permanently removed';
  RAISE NOTICE 'All code now uses: candidates + job_candidate_associations';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Regenerate Supabase types';
  RAISE NOTICE '2. Test pipeline functionality';
  RAISE NOTICE '3. Verify metrics in Admin view';
  RAISE NOTICE '========================================';
END $$;