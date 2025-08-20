-- Fix offer letters foreign key constraint by migrating orphaned records properly

-- Step 1: Delete offer letters that reference non-existent candidates
-- These appear to be referencing job_candidates IDs that don't exist in either table
DELETE FROM public.offer_letters 
WHERE candidate_id NOT IN (SELECT id FROM public.candidates);

-- Step 2: Drop the existing foreign key constraint that references job_candidates
ALTER TABLE public.offer_letters 
DROP CONSTRAINT IF EXISTS offer_letters_candidate_id_fkey;

-- Step 3: Add new foreign key constraint that references candidates table
ALTER TABLE public.offer_letters 
ADD CONSTRAINT offer_letters_candidate_id_fkey 
FOREIGN KEY (candidate_id) 
REFERENCES public.candidates(id) 
ON DELETE CASCADE;

-- Step 4: Add an index for better performance on candidate_id lookups
CREATE INDEX IF NOT EXISTS idx_offer_letters_candidate_id 
ON public.offer_letters(candidate_id);