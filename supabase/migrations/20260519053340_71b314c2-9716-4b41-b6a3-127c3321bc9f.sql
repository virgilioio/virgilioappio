-- Enums for work mode and employment type
DO $$ BEGIN
  CREATE TYPE public.job_work_mode AS ENUM ('remote','hybrid','onsite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_employment_type AS ENUM ('full_time','part_time','contract','internship','temporary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS internal_title text,
  ADD COLUMN IF NOT EXISTS job_level text,
  ADD COLUMN IF NOT EXISTS work_mode public.job_work_mode,
  ADD COLUMN IF NOT EXISTS employment_type public.job_employment_type,
  ADD COLUMN IF NOT EXISTS additional_locations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS show_salary_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_equity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_signing_bonus boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_years_experience integer,
  ADD COLUMN IF NOT EXISTS max_years_experience integer;