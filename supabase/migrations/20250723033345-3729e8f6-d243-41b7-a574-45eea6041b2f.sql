-- Add the missing employment_term column to workers table
ALTER TABLE public.workers 
ADD COLUMN employment_term TEXT CHECK (employment_term IN ('indefinite', 'definite'));