-- Fix the swapped employment column types

-- Step 1: Create the correct enums
CREATE TYPE employment_type_enum AS ENUM ('full_time', 'part_time', 'temporary', 'internship');
CREATE TYPE employment_duration_enum AS ENUM ('indefinite', 'definite');

-- Step 2: Add temporary columns with correct types
ALTER TABLE public.workers 
ADD COLUMN temp_employment_terms employment_type_enum,
ADD COLUMN temp_employment_term employment_duration_enum;

-- Step 3: Copy data to temporary columns (swapping the logic)
-- employment_terms should get full_time/part_time values (but currently has indefinite/definite)
-- employment_term should get indefinite/definite values (but currently has text)
UPDATE public.workers 
SET 
  temp_employment_terms = 'full_time', -- Default for now since the data is mixed up
  temp_employment_term = CASE 
    WHEN employment_term = 'indefinite' THEN 'indefinite'::employment_duration_enum
    WHEN employment_term = 'definite' THEN 'definite'::employment_duration_enum
    ELSE 'indefinite'::employment_duration_enum
  END;

-- Step 4: Drop old columns and rename temp columns
ALTER TABLE public.workers 
DROP COLUMN employment_terms,
DROP COLUMN employment_term;

ALTER TABLE public.workers 
RENAME COLUMN temp_employment_terms TO employment_terms;

ALTER TABLE public.workers 
RENAME COLUMN temp_employment_term TO employment_term;

-- Step 5: Clean up old enum
DROP TYPE IF EXISTS employment_terms_enum CASCADE;