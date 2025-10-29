-- Migration: Fix Recruiter Job Visibility with Proper RLS
-- This migration ensures recruiters can only see jobs they're assigned to or part of the hiring team

-- Step 1: Add unique constraint to job_assignments to prevent duplicates (skip if already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'job_assignments_job_user_unique'
  ) THEN
    ALTER TABLE public.job_assignments 
    ADD CONSTRAINT job_assignments_job_user_unique 
    UNIQUE (job_id, user_id);
  END IF;
END $$;

-- Step 2: Drop and recreate the jobs_tenant_isolation policy to exclude recruiters
DROP POLICY IF EXISTS "jobs_tenant_isolation" ON public.jobs;

CREATE POLICY "jobs_tenant_isolation" ON public.jobs
FOR SELECT
USING (
  -- Platform admins can see all jobs
  (get_user_type_secure() = 'platform_admin')
  OR
  -- Regular users can see jobs in their organization hierarchy (but NOT recruiters)
  (
    jobs.organization_id IN (
      SELECT get_org_hierarchy(
        (SELECT organization_id FROM public.members 
         WHERE user_id = auth.uid() 
         AND user_status = 'active' 
         LIMIT 1)
      )
    )
    AND NOT (check_org_member_access(jobs.organization_id, 'recruiter'::member_role))
  )
);

-- Step 3: Create new recruiter-specific SELECT policy
CREATE POLICY "Recruiters can only view assigned jobs" ON public.jobs
FOR SELECT
USING (
  -- Must be a recruiter in this organization
  check_org_member_access(jobs.organization_id, 'recruiter'::member_role)
  AND (
    -- Assigned via job_assignments table
    EXISTS (
      SELECT 1 FROM public.job_assignments ja
      WHERE ja.job_id = jobs.id 
        AND ja.user_id = auth.uid()
    )
    OR
    -- Member of hiring_team JSONB array
    jobs.hiring_team @> to_jsonb(auth.uid()::text)
  )
);

-- Step 4: Create function to auto-assign job creators to job_assignments
CREATE OR REPLACE FUNCTION public.auto_assign_job_creator_to_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only auto-assign if creator is a recruiter
  IF public.check_org_member_access(NEW.organization_id, 'recruiter'::member_role) THEN
    INSERT INTO public.job_assignments (
      job_id,
      user_id,
      organization_id,
      assigned_by
    ) VALUES (
      NEW.id,
      auth.uid(),
      NEW.organization_id,
      auth.uid()
    )
    ON CONFLICT (job_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 5: Create trigger to automatically assign job creator
DROP TRIGGER IF EXISTS auto_assign_job_creator_after_insert ON public.jobs;

CREATE TRIGGER auto_assign_job_creator_after_insert
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_job_creator_to_assignments();