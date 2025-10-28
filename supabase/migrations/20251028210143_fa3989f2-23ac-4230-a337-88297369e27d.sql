-- Update RLS policies for job_candidate_associations to support org hierarchy

-- SELECT policy
DROP POLICY IF EXISTS "Users can view associations for accessible jobs" ON public.job_candidate_associations;
DROP POLICY IF EXISTS "Platform admins can manage all associations" ON public.job_candidate_associations;

CREATE POLICY "Users can view associations for accessible jobs"
ON public.job_candidate_associations
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(job_id)
  OR user_has_org_hierarchy_access((SELECT organization_id FROM public.jobs WHERE id = job_id))
);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert associations for accessible jobs" ON public.job_candidate_associations;

CREATE POLICY "Users can insert associations for accessible jobs"
ON public.job_candidate_associations
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(job_id)
  OR user_has_org_hierarchy_access((SELECT organization_id FROM public.jobs WHERE id = job_id))
);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update associations for accessible jobs" ON public.job_candidate_associations;

CREATE POLICY "Users can update associations for accessible jobs"
ON public.job_candidate_associations
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(job_id)
  OR user_has_org_hierarchy_access((SELECT organization_id FROM public.jobs WHERE id = job_id))
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(job_id)
  OR user_has_org_hierarchy_access((SELECT organization_id FROM public.jobs WHERE id = job_id))
);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete associations for accessible jobs" ON public.job_candidate_associations;

CREATE POLICY "Users can delete associations for accessible jobs"
ON public.job_candidate_associations
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(job_id)
  OR user_has_org_hierarchy_access((SELECT organization_id FROM public.jobs WHERE id = job_id))
);

-- Recreate platform admin policy for completeness
CREATE POLICY "Platform admins can manage all associations"
ON public.job_candidate_associations
FOR ALL
USING (get_user_type_secure() = 'platform_admin');