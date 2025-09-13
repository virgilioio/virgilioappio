-- Remove CoreSignal integration from database
-- Remove coresignal_profile_id column from candidates table
ALTER TABLE public.candidates DROP COLUMN IF EXISTS coresignal_profile_id;

-- Clean up CoreSignal-related enrichment logs
DELETE FROM public.candidate_enrichment_logs WHERE enrichment_type = 'coresignal';

-- Clean up CoreSignal salary data
DELETE FROM public.salary_market_data WHERE data_source = 'coresignal';

-- Clean up library enrichment logs for CoreSignal
DELETE FROM public.library_enrichment_logs WHERE enrichment_type = 'coresignal';