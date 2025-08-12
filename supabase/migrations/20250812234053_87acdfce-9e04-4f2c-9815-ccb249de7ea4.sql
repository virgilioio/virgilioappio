
-- Enable RLS (safe to run multiple times)
ALTER TABLE public.job_hiring_stages ENABLE ROW LEVEL SECURITY;

-- 1) SELECT policy: org members or job-assigned users can view hiring plan
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_hiring_stages' 
      AND polname = 'jhs_select_members_or_assigned'
  ) THEN
    EXECUTE $p$
      CREATE POLICY jhs_select_members_or_assigned
      ON public.job_hiring_stages
      FOR SELECT
      USING (
        -- Org members of the job's org
        EXISTS (
          SELECT 1
          FROM public.jobs j
          JOIN public.members m ON m.organization_id = j.organization_id
          WHERE j.id = job_hiring_stages.job_id
            AND m.user_id = auth.uid()
            AND m.user_status = 'active'
        )
        OR
        -- Or users assigned to that specific job
        EXISTS (
          SELECT 1
          FROM public.job_assignments ja
          WHERE ja.job_id = job_hiring_stages.job_id
            AND ja.user_id = auth.uid()
        )
      );
    $p$;
  END IF;
END$$;

-- 2) INSERT policy: recruiters/admins in org can create plan rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_hiring_stages' 
      AND polname = 'jhs_insert_recruiters_admins'
  ) THEN
    EXECUTE $q$
      CREATE POLICY jhs_insert_recruiters_admins
      ON public.job_hiring_stages
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.jobs j
          JOIN public.members m ON m.organization_id = j.organization_id
          WHERE j.id = job_hiring_stages.job_id
            AND m.user_id = auth.uid()
            AND m.user_status = 'active'
            AND m.member_role IN ('admin','recruiter')
        )
      );
    $q$;
  END IF;
END$$;

-- 3) UPDATE and DELETE policies: recruiters/admins in org can manage plan rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_hiring_stages' 
      AND polname = 'jhs_update_recruiters_admins'
  ) THEN
    EXECUTE $r$
      CREATE POLICY jhs_update_recruiters_admins
      ON public.job_hiring_stages
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.jobs j
          JOIN public.members m ON m.organization_id = j.organization_id
          WHERE j.id = job_hiring_stages.job_id
            AND m.user_id = auth.uid()
            AND m.user_status = 'active'
            AND m.member_role IN ('admin','recruiter')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.jobs j
          JOIN public.members m ON m.organization_id = j.organization_id
          WHERE j.id = job_hiring_stages.job_id
            AND m.user_id = auth.uid()
            AND m.user_status = 'active'
            AND m.member_role IN ('admin','recruiter')
        )
      );
    $r$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_hiring_stages' 
      AND polname = 'jhs_delete_recruiters_admins'
  ) THEN
    EXECUTE $s$
      CREATE POLICY jhs_delete_recruiters_admins
      ON public.job_hiring_stages
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.jobs j
          JOIN public.members m ON m.organization_id = j.organization_id
          WHERE j.id = job_hiring_stages.job_id
            AND m.user_id = auth.uid()
            AND m.user_status = 'active'
            AND m.member_role IN ('admin','recruiter')
        )
      );
    $s$;
  END IF;
END$$;
