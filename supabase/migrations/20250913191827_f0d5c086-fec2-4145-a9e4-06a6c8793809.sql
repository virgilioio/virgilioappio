-- Remove job requests and agreements tables and related functionality

-- Drop dependent tables first
DROP TABLE IF EXISTS public.job_request_agreements CASCADE;
DROP TABLE IF EXISTS public.job_requests CASCADE;

-- Remove any custom enums that were used for job requests
DROP TYPE IF EXISTS public.job_request_status CASCADE;
DROP TYPE IF EXISTS public.job_request_level CASCADE;