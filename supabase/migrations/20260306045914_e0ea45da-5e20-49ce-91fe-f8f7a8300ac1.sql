
-- Create enum type for job assignment roles
CREATE TYPE public.job_assignment_role AS ENUM ('recruiter', 'hiring_manager', 'interviewer');

-- Add role column to job_assignments with default 'recruiter'
ALTER TABLE public.job_assignments 
  ADD COLUMN role public.job_assignment_role NOT NULL DEFAULT 'recruiter';
