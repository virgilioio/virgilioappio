-- Drop 5 unused empty tables with zero dependencies
-- These tables have no data, no foreign key references, no triggers, and no code usage
-- Storage reclamation: ~152 kB

-- 1. Drop candidate_enrichment_logs (empty, never used)
DROP TABLE IF EXISTS public.candidate_enrichment_logs CASCADE;

-- 2. Drop library_enrichment_logs (empty, never used)  
DROP TABLE IF EXISTS public.library_enrichment_logs CASCADE;

-- 3. Drop email_suppression_list (empty, never used)
DROP TABLE IF EXISTS public.email_suppression_list CASCADE;

-- 4. Drop stripe_event_log (empty, never used)
DROP TABLE IF EXISTS public.stripe_event_log CASCADE;

-- 5. Drop tenant_metrics_daily (empty, never used)
DROP TABLE IF EXISTS public.tenant_metrics_daily CASCADE;