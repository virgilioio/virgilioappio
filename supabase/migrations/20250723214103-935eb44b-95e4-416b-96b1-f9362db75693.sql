-- Complete the workers table cleanup by removing remaining contract-related columns
-- These fields are contract-specific, not person-specific

ALTER TABLE public.workers 
DROP COLUMN IF EXISTS job_title,
DROP COLUMN IF EXISTS manager_id,
DROP COLUMN IF EXISTS department;