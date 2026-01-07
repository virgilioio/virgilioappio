-- Add ingest email tracking to job_candidate_associations
ALTER TABLE public.job_candidate_associations
ADD COLUMN IF NOT EXISTS email_ingest_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS email_ingest_address TEXT;

-- Index for fast lookup by ingest code
CREATE INDEX IF NOT EXISTS idx_jca_email_ingest_code 
ON public.job_candidate_associations(email_ingest_code) 
WHERE email_ingest_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.job_candidate_associations.email_ingest_code IS 'Unique 8-character code for inbound email routing';
COMMENT ON COLUMN public.job_candidate_associations.email_ingest_address IS 'Full ingest email address (jc_{code}@ingest.gogio.io)';