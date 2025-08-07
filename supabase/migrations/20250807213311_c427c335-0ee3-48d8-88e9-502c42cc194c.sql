
-- 1) Table to persist job-specific hiring plans
CREATE TABLE public.job_hiring_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.job_stages(id),
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Prevent duplicate stage selection per job
ALTER TABLE public.job_hiring_stages
  ADD CONSTRAINT job_hiring_stages_job_stage_unique
  UNIQUE (job_id, stage_id);

-- Prevent two stages from sharing the same position in a job
ALTER TABLE public.job_hiring_stages
  ADD CONSTRAINT job_hiring_stages_job_position_unique
  UNIQUE (job_id, position);

-- Helpful indexes
CREATE INDEX job_hiring_stages_job_id_idx ON public.job_hiring_stages(job_id);
CREATE INDEX job_hiring_stages_stage_id_idx ON public.job_hiring_stages(stage_id);

-- Keep updated_at fresh on updates
CREATE TRIGGER set_job_hiring_stages_updated_at
BEFORE UPDATE ON public.job_hiring_stages
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 2) Row Level Security
ALTER TABLE public.job_hiring_stages ENABLE ROW LEVEL SECURITY;

-- View policy: org members (same org as job), job-assigned users, or platform admins
CREATE POLICY "Users can view hiring stages for jobs they can access"
ON public.job_hiring_stages
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    WHERE ja.job_id = job_hiring_stages.job_id
      AND ja.user_id = auth.uid()
  )
);

-- Manage policies: org admins/recruiters in same org as job, or platform admins
CREATE POLICY "Organization recruiters can insert hiring stages"
ON public.job_hiring_stages
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.member_role IN ('admin','recruiter')
      AND m.user_status = 'active'
  )
);

CREATE POLICY "Organization recruiters can update hiring stages"
ON public.job_hiring_stages
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.member_role IN ('admin','recruiter')
      AND m.user_status = 'active'
  )
);

CREATE POLICY "Organization recruiters can delete hiring stages"
ON public.job_hiring_stages
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.member_role IN ('admin','recruiter')
      AND m.user_status = 'active'
  )
);
