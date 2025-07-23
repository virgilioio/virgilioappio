-- Fix the employment terms enum issue

-- First, create the correct enum for employment terms (full_time, part_time, etc.)
CREATE TYPE employment_type_enum AS ENUM ('full_time', 'part_time', 'temporary', 'internship');

-- Create the correct enum for employment term duration (indefinite, definite)  
CREATE TYPE employment_duration_enum AS ENUM ('indefinite', 'definite');

-- Update the employment_terms column to use the correct enum
ALTER TABLE public.workers 
ALTER COLUMN employment_terms TYPE employment_type_enum 
USING employment_terms::text::employment_type_enum;

-- Update the employment_term column to use the correct enum
ALTER TABLE public.workers 
ALTER COLUMN employment_term TYPE employment_duration_enum 
USING employment_term::text::employment_duration_enum;