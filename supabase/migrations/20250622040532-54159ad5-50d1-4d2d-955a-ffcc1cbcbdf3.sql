
-- Add agreement_id column to job_requests table to store reference to the job_request_agreements
ALTER TABLE public.job_requests 
ADD COLUMN agreement_id UUID REFERENCES public.job_request_agreements(id);

-- Add a comment to document the purpose of this column
COMMENT ON COLUMN public.job_requests.agreement_id IS 'References the job_request_agreements.id that was used when this job request was submitted';
