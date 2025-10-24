-- Phase 2: Drop Sourcing Tables
-- Remove unused sourcing database tables (archives remain)

-- Drop sourcing tables in dependency order
DROP TABLE IF EXISTS public.sourcing_events CASCADE;
DROP TABLE IF EXISTS public.external_candidate_matches CASCADE;
DROP TABLE IF EXISTS public.org_credit_usage CASCADE;

-- Log the cleanup
DO $$
BEGIN
  RAISE NOTICE 'Sourcing tables dropped successfully:';
  RAISE NOTICE '  - sourcing_events (CASCADE)';
  RAISE NOTICE '  - external_candidate_matches (CASCADE)';
  RAISE NOTICE '  - org_credit_usage (CASCADE)';
  RAISE NOTICE '';
  RAISE NOTICE 'Archive tables preserved:';
  RAISE NOTICE '  - _archived_sourcing_events';
  RAISE NOTICE '  - _archived_external_candidate_matches';
  RAISE NOTICE '  - _archived_org_credit_usage';
END $$;