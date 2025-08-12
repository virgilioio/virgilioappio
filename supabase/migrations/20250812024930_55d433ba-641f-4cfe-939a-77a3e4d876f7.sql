-- Add auto-generated skills storage for jobs
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS auto_generated_skills jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS last_skills_generation timestamp with time zone NULL;