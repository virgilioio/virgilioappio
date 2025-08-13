-- Now add the correct foreign key constraint to reference the global candidates table
ALTER TABLE public.candidate_attachments 
ADD CONSTRAINT candidate_attachments_candidate_id_fkey 
FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;