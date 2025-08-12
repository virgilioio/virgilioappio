-- Fix RLS visibility and permissions for pipeline and hiring plan

-- 1) job_candidate_associations: replace restrictive SELECT policies with a single permissive OR policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_candidate_associations' 
      AND policyname = 'Organization members can view associations in their org'
  ) THEN
    EXECUTE 'DROP POLICY "Organization members can view associations in their org" ON public.job_candidate_associations';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_candidate_associations' 
      AND policyname = 'Users can view associations for jobs they are assigned to'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view associations for jobs they are assigned to" ON public.job_candidate_associations';
  END IF;
END$$;

-- Ensure RLS is enabled
ALTER TABLE public.job_candidate_associations ENABLE ROW LEVEL SECURITY;

-- Permissive SELECT: org member OR assigned to job
CREATE POLICY "View associations - org member or assigned"
ON public.job_candidate_associations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_candidate_associations.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.job_assignments ja
    WHERE ja.job_id = job_candidate_associations.job_id
      AND ja.user_id = auth.uid()
  )
);

-- Keep existing INSERT/UPDATE WITH CHECK policies (already present) and admin manage policy


-- 2) job_hiring_stages: allow recruiters/admins to view and manage hiring plan
-- Enable RLS (safe even if already enabled)
ALTER TABLE public.job_hiring_stages ENABLE ROW LEVEL SECURITY;

-- View policy: org member or assigned to job
CREATE POLICY IF NOT EXISTS "View job hiring stages - org member or assigned"
ON public.job_hiring_stages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.job_assignments ja
    WHERE ja.job_id = job_hiring_stages.job_id
      AND ja.user_id = auth.uid()
  )
);

-- Insert policy: recruiters/admins in org or assigned to job
CREATE POLICY IF NOT EXISTS "Manage job hiring stages - insert"
ON public.job_hiring_stages
FOR INSERT
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.members m ON j.organization_id = m.organization_id
      WHERE j.id = job_hiring_stages.job_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin','recruiter')
        AND m.user_status = 'active'
    )
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.job_assignments ja
      WHERE ja.job_id = job_hiring_stages.job_id
        AND ja.user_id = auth.uid()
    )
  )
);

-- Update policy: allow updating visible rows and ensure post-update row still allowed
CREATE POLICY IF NOT EXISTS "Manage job hiring stages - update"
ON public.job_hiring_stages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.member_role IN ('admin','recruiter')
      AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.job_assignments ja
    WHERE ja.job_id = job_hiring_stages.job_id
      AND ja.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.member_role IN ('admin','recruiter')
      AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.job_assignments ja
    WHERE ja.job_id = job_hiring_stages.job_id
      AND ja.user_id = auth.uid()
  )
);

-- Delete policy: recruiters/admins in org or assigned to job
CREATE POLICY IF NOT EXISTS "Manage job hiring stages - delete"
ON public.job_hiring_stages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.member_role IN ('admin','recruiter')
      AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.job_assignments ja
    WHERE ja.job_id = job_hiring_stages.job_id
      AND ja.user_id = auth.uid()
  )
);

-- 3) job_assignments: ensure recruiters/admins can insert; add WITH CHECK to be explicit
-- (Policy likely exists; add an explicit INSERT policy if missing)
CREATE POLICY IF NOT EXISTS "Manage job assignments - insert"
ON public.job_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.organization_id = job_assignments.organization_id
      AND m.user_id = auth.uid()
      AND m.member_role IN ('admin','recruiter')
      AND m.user_status = 'active'
  )
);
