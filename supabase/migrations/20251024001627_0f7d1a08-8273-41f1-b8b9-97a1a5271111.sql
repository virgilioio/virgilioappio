-- Phase 2: Archive Sourcing Tables
-- Create archive tables to preserve data before eventual deletion

-- ========================================
-- 1. Archive org_credit_usage
-- ========================================

-- Create archive table with all data
CREATE TABLE IF NOT EXISTS public._archived_org_credit_usage AS 
SELECT * FROM public.org_credit_usage;

-- Add metadata columns to track archival
ALTER TABLE public._archived_org_credit_usage 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add comment for documentation
COMMENT ON TABLE public._archived_org_credit_usage IS 
'ARCHIVE: Sourcing credit usage data archived on 2025-10-24 during sourcing feature removal';

-- ========================================
-- 2. Archive sourcing_events
-- ========================================

-- Create archive table with all data
CREATE TABLE IF NOT EXISTS public._archived_sourcing_events AS 
SELECT * FROM public.sourcing_events;

-- Add metadata columns to track archival
ALTER TABLE public._archived_sourcing_events 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add comment for documentation
COMMENT ON TABLE public._archived_sourcing_events IS 
'ARCHIVE: Sourcing events log archived on 2025-10-24 during sourcing feature removal';

-- ========================================
-- 3. Archive external_candidate_matches
-- ========================================

-- Create archive table with all data
CREATE TABLE IF NOT EXISTS public._archived_external_candidate_matches AS 
SELECT * FROM public.external_candidate_matches;

-- Add metadata columns to track archival
ALTER TABLE public._archived_external_candidate_matches 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add comment for documentation
COMMENT ON TABLE public._archived_external_candidate_matches IS 
'ARCHIVE: External candidate matches archived on 2025-10-24 during sourcing feature removal';

-- ========================================
-- Verification Queries
-- ========================================

-- Log archival summary
DO $$
DECLARE
  v_org_credit_count INTEGER;
  v_sourcing_events_count INTEGER;
  v_external_matches_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_org_credit_count FROM public._archived_org_credit_usage;
  SELECT COUNT(*) INTO v_sourcing_events_count FROM public._archived_sourcing_events;
  SELECT COUNT(*) INTO v_external_matches_count FROM public._archived_external_candidate_matches;
  
  RAISE NOTICE 'Archive Summary:';
  RAISE NOTICE '  - org_credit_usage: % rows archived', v_org_credit_count;
  RAISE NOTICE '  - sourcing_events: % rows archived', v_sourcing_events_count;
  RAISE NOTICE '  - external_candidate_matches: % rows archived', v_external_matches_count;
END $$;