
-- Add a column to track which users have viewed each candidate
ALTER TABLE public.job_candidates 
ADD COLUMN first_viewed_by jsonb DEFAULT '{}'::jsonb;

-- Add an index for efficient querying of the JSONB column
CREATE INDEX idx_job_candidates_first_viewed_by ON public.job_candidates USING gin (first_viewed_by);

-- Add a comment to document the column usage
COMMENT ON COLUMN public.job_candidates.first_viewed_by IS 'JSONB object storing user IDs and timestamps when they first viewed this candidate. Format: {"user_id": "ISO_timestamp"}';
