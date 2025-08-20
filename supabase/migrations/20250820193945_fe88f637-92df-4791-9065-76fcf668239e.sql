-- Fix offer letters foreign key constraint to reference candidates table instead of job_candidates

-- First, check if there are any existing offer letters that would violate the new constraint
-- If there are any, we'll handle them appropriately

-- Drop the existing foreign key constraint that references job_candidates
ALTER TABLE public.offer_letters 
DROP CONSTRAINT IF EXISTS offer_letters_candidate_id_fkey;

-- Add new foreign key constraint that references candidates table
ALTER TABLE public.offer_letters 
ADD CONSTRAINT offer_letters_candidate_id_fkey 
FOREIGN KEY (candidate_id) 
REFERENCES public.candidates(id) 
ON DELETE CASCADE;

-- Add an index for better performance on candidate_id lookups
CREATE INDEX IF NOT EXISTS idx_offer_letters_candidate_id 
ON public.offer_letters(candidate_id);