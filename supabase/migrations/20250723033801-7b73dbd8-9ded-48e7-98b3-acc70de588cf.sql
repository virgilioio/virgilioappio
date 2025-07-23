-- Fix the employment enum issue step by step

-- Step 1: Drop the existing incorrect enum and recreate with proper values
DROP TYPE IF EXISTS employment_terms_enum CASCADE;
CREATE TYPE employment_terms_enum AS ENUM ('full_time', 'part_time', 'temporary', 'internship');

-- Step 2: Make employment_terms column use the correct enum 
-- (since it's currently text, we can convert it safely)
ALTER TABLE public.workers 
ALTER COLUMN employment_terms TYPE employment_terms_enum 
USING employment_terms::text::employment_terms_enum;

-- Step 3: Create enum for employment_term (indefinite/definite)
CREATE TYPE employment_duration_enum AS ENUM ('indefinite', 'definite');

-- Step 4: Make employment_term column use the duration enum
ALTER TABLE public.workers 
ALTER COLUMN employment_term TYPE employment_duration_enum 
USING employment_term::text::employment_duration_enum;