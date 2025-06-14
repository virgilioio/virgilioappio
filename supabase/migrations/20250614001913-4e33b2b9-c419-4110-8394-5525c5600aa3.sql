
-- Create job_assignments table to store explicit guest-job relationships
CREATE TABLE public.job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  organization_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, user_id)
);

-- Enable RLS on job_assignments
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.job_assignments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- RLS policies for job_assignments table
CREATE POLICY "job_assignments_select" ON public.job_assignments FOR SELECT
USING (
  get_user_type() = 'platform_admin' OR
  organization_id = get_user_organization_id()
);

CREATE POLICY "job_assignments_insert" ON public.job_assignments FOR INSERT
WITH CHECK (
  get_user_type() = 'platform_admin' OR
  (get_member_role() IN ('admin', 'recruiter') AND organization_id = get_user_organization_id())
);

CREATE POLICY "job_assignments_update" ON public.job_assignments FOR UPDATE
USING (
  get_user_type() = 'platform_admin' OR
  (get_member_role() IN ('admin', 'recruiter') AND organization_id = get_user_organization_id())
);

CREATE POLICY "job_assignments_delete" ON public.job_assignments FOR DELETE
USING (
  get_user_type() = 'platform_admin' OR
  (get_member_role() IN ('admin', 'recruiter') AND organization_id = get_user_organization_id())
);

-- Drop existing RLS policies on jobs table to replace them
DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete" ON public.jobs;

-- Updated RLS policies for jobs table with guest assignment access
CREATE POLICY "jobs_select_with_assignments" ON public.jobs FOR SELECT
USING (
  get_user_type() = 'platform_admin' OR
  organization_id = get_user_organization_id() OR
  (get_member_role() = 'client' AND EXISTS (
    SELECT 1 FROM public.job_assignments 
    WHERE job_id = jobs.id AND user_id = auth.uid()
  ))
);

CREATE POLICY "jobs_insert" ON public.jobs FOR INSERT
WITH CHECK (
  get_user_type() = 'platform_admin' OR
  (get_member_role() = 'admin' AND organization_id = get_user_organization_id())
);

CREATE POLICY "jobs_update" ON public.jobs FOR UPDATE
USING (
  get_user_type() = 'platform_admin' OR
  (get_member_role() IN ('admin', 'recruiter') AND organization_id = get_user_organization_id())
);

CREATE POLICY "jobs_delete" ON public.jobs FOR DELETE
USING (
  get_user_type() = 'platform_admin' OR
  (get_member_role() = 'admin' AND organization_id = get_user_organization_id())
);

-- Drop existing RLS policies on job_candidates table to replace them
DROP POLICY IF EXISTS "job_candidates_select" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_insert" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_update" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_delete" ON public.job_candidates;

-- Updated RLS policies for job_candidates table with guest assignment access
CREATE POLICY "job_candidates_select_with_assignments" ON public.job_candidates FOR SELECT
USING (
  get_user_type() = 'platform_admin' OR
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND (
      organization_id = get_user_organization_id() OR
      (get_member_role() = 'client' AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_id = jobs.id AND user_id = auth.uid()
      ))
    )
  )
);

CREATE POLICY "job_candidates_insert" ON public.job_candidates FOR INSERT
WITH CHECK (
  get_user_type() = 'platform_admin' OR
  (get_member_role() IN ('admin', 'recruiter') AND EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND organization_id = get_user_organization_id()
  ))
);

CREATE POLICY "job_candidates_update" ON public.job_candidates FOR UPDATE
USING (
  get_user_type() = 'platform_admin' OR
  (get_member_role() IN ('admin', 'recruiter') AND EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND organization_id = get_user_organization_id()
  ))
);

CREATE POLICY "job_candidates_delete" ON public.job_candidates FOR DELETE
USING (
  get_user_type() = 'platform_admin' OR
  (get_member_role() = 'admin' AND EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND organization_id = get_user_organization_id()
  ))
);

-- Create helper function to check job assignment
CREATE OR REPLACE FUNCTION public.is_user_assigned_to_job(job_id_param UUID, user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_assignments
    WHERE job_id = job_id_param AND user_id = user_id_param
  );
$$;

-- Add comments for documentation
COMMENT ON TABLE public.job_assignments IS 'Maps guests/clients to specific jobs they can access';
COMMENT ON COLUMN public.job_assignments.job_id IS 'Job the user is assigned to';
COMMENT ON COLUMN public.job_assignments.user_id IS 'User assigned to the job (typically client/guest)';
COMMENT ON COLUMN public.job_assignments.assigned_by IS 'Admin or recruiter who made the assignment';
COMMENT ON COLUMN public.job_assignments.organization_id IS 'Organization context for security';
