CREATE TYPE public.job_priority AS ENUM ('critical', 'high', 'standard', 'low');

ALTER TABLE public.jobs
ADD COLUMN priority public.job_priority NOT NULL DEFAULT 'standard';

CREATE INDEX jobs_priority_idx ON public.jobs (priority);