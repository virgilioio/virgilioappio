ALTER TABLE public.job_pipeline_shares ADD COLUMN IF NOT EXISTS visible_stage_ids uuid[];

-- Backfill: from_stage_id + all later recruiting stages of the same job.
UPDATE public.job_pipeline_shares ps
SET visible_stage_ids = (
  SELECT COALESCE(array_agg(jhs.id ORDER BY jhs.position), '{}')
  FROM public.job_hiring_stages jhs
  JOIN public.job_stages js ON js.id = jhs.stage_id
  WHERE jhs.job_id = ps.job_id
    AND js.stage_type NOT IN ('application', 'application_review', 'offer', 'onboarding')
    AND jhs.position >= COALESCE((
      SELECT jhs2.position FROM public.job_hiring_stages jhs2 WHERE jhs2.id = ps.from_stage_id
    ), 0)
)
WHERE ps.visible_stage_ids IS NULL;