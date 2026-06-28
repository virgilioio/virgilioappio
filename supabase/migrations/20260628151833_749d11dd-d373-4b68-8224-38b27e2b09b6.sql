
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS syndication jsonb NOT NULL DEFAULT '{"google_jobs": {"enabled": true}}'::jsonb;

UPDATE public.job_postings
SET syndication = jsonb_build_object(
  'google_jobs', jsonb_build_object(
    'enabled', COALESCE((details->'channels'->'google_jobs'->>'enabled')::boolean, true)
  )
)
WHERE syndication = '{"google_jobs": {"enabled": true}}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_job_postings_google_jobs_enabled
  ON public.job_postings ((syndication->'google_jobs'->>'enabled'))
  WHERE is_active = true;
