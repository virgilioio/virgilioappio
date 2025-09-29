-- Make the level field nullable since it's no longer used for job creation
ALTER TABLE public.jobs ALTER COLUMN level DROP NOT NULL;