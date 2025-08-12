-- Fix RLS visibility and permissions for pipeline and hiring plan (retry with tagged dollar-quoting)

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

-- Create new permissive SELECT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_candidate_associations' 
      AND policyname = 'View associations - org member or assigned'
  ) THEN
    EXECUTE $POLICY$
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
    $POLICY$;
  END IF;
END$$;

-- 2) job_hiring_stages: allow recruiters/admins to view and manage hiring plan
ALTER TABLE public.job_hiring_stages ENABLE ROW LEVEL SECURITY;

-- View policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_hiring_stages' 
      AND policyname = 'View job hiring stages - org member or assigned'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY "View job hiring stages - org member or assigned"
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
    $POLICY$;
  END IF;
END$$;

-- Insert policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_hiring_stages' 
      AND policyname = 'Manage job hiring stages - insert'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY "Manage job hiring stages - insert"
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
    $POLICY$;
  END IF;
END$$;

-- Update policy (USING + WITH CHECK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_hiring_stages' 
      AND policyname = 'Manage job hiring stages - update'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY "Manage job hiring stages - update"
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
    $POLICY$;
  END IF;
END$$;

-- Delete policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_hiring_stages' 
      AND policyname = 'Manage job hiring stages - delete'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY "Manage job hiring stages - delete"
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
    $POLICY$;
  END IF;
END$$;

-- 3) job_assignments: explicit INSERT policy for recruiters/admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_assignments' 
      AND policyname = 'Manage job assignments - insert'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY "Manage job assignments - insert"
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
    $POLICY$;
  END IF;
END$$;
