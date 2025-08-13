-- Fix foreign key constraint on candidate_attachments to reference the correct candidates table
ALTER TABLE public.candidate_attachments 
DROP CONSTRAINT IF EXISTS candidate_attachments_candidate_id_fkey;

-- Add the correct foreign key constraint pointing to the candidates table
ALTER TABLE public.candidate_attachments 
ADD CONSTRAINT candidate_attachments_candidate_id_fkey 
FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;