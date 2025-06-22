
-- Add a new column to store the processed agreement content with replaced placeholders
ALTER TABLE public.job_requests 
ADD COLUMN processed_agreement_content TEXT;

-- Add a comment to document the purpose of this column
COMMENT ON COLUMN public.job_requests.processed_agreement_content IS 'Stores the final agreement content with all placeholders replaced with actual organization and job data at the time of submission';
