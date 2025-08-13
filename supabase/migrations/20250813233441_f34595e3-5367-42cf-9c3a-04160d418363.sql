-- Fix candidate_attachments foreign key constraint to reference candidates table instead of job_candidates
-- First, drop the existing foreign key constraint if it exists
ALTER TABLE public.candidate_attachments 
DROP CONSTRAINT IF EXISTS candidate_attachments_candidate_id_fkey;

-- Add the correct foreign key constraint to reference the global candidates table
ALTER TABLE public.candidate_attachments 
ADD CONSTRAINT candidate_attachments_candidate_id_fkey 
FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;