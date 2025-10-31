-- ========================================
-- RLS CONSOLIDATION MIGRATION
-- Consolidates Jobs and Candidates RLS policies
-- Reduces from 14+ policies to 8 policies total
-- ========================================

-- ========================================
-- STEP 1: Create new helper function
-- ========================================

CREATE OR REPLACE FUNCTION public.user_is_workspace_owner(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
    AND m.organization_id = org_id
    AND m.user_status = 'active'
    AND m.user_type = 'workspace_owner'
  );
$function$;

-- ========================================
-- STEP 2: JOBS TABLE - Drop old policies
-- ========================================

DROP POLICY IF EXISTS "Users can view jobs in their organization" ON public.jobs;
DROP POLICY IF EXISTS "jobs_virgilio_hierarchy_exclude_saas" ON public.jobs;
DROP POLICY IF EXISTS "jobs_platform_admin_insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs_platform_admin_update" ON public.jobs;
DROP POLICY IF EXISTS "jobs_platform_admin_delete" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert jobs in their organization" ON public.jobs;
DROP POLICY IF EXISTS "Users can update jobs in their organization" ON public.jobs;
DROP POLICY IF EXISTS "Users can delete jobs in their organization" ON public.jobs;

-- ========================================
-- STEP 3: JOBS TABLE - Create consolidated policies
-- ========================================

-- POLICY 1: jobs_select_consolidated
-- Who can VIEW jobs?
-- - Platform admins: all jobs
-- - Users: jobs in their org hierarchy
-- - Users: jobs they're assigned to
CREATE POLICY "jobs_select_consolidated"
ON public.jobs
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  user_has_org_hierarchy_access(organization_id)
  OR
  is_user_assigned_to_job(id)
);

COMMENT ON POLICY "jobs_select_consolidated" ON public.jobs IS 
'Consolidated SELECT policy: Platform admins see all, users see jobs in their org hierarchy or jobs they are assigned to';

-- POLICY 2: jobs_insert_consolidated
-- Who can CREATE jobs?
-- - Platform admins: anywhere
-- - Admins + Recruiters: in their org
CREATE POLICY "jobs_insert_consolidated"
ON public.jobs
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    user_has_org_hierarchy_access(organization_id)
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  )
);

COMMENT ON POLICY "jobs_insert_consolidated" ON public.jobs IS 
'Consolidated INSERT policy: Platform admins can insert anywhere, admins and recruiters can insert in their org';

-- POLICY 3: jobs_update_consolidated
-- Who can UPDATE jobs?
-- - Platform admins: all jobs
-- - Admins + Recruiters: jobs in their org
-- - Users: jobs they're assigned to
CREATE POLICY "jobs_update_consolidated"
ON public.jobs
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    user_has_org_hierarchy_access(organization_id)
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  )
  OR
  is_user_assigned_to_job(id)
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    user_has_org_hierarchy_access(organization_id)
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  )
  OR
  is_user_assigned_to_job(id)
);

COMMENT ON POLICY "jobs_update_consolidated" ON public.jobs IS 
'Consolidated UPDATE policy: Platform admins, admins/recruiters in org, or users assigned to the job can update';

-- POLICY 4: jobs_delete_consolidated
-- Who can DELETE jobs?
-- - Platform admins: all jobs
-- - Workspace owners: jobs in their org
CREATE POLICY "jobs_delete_consolidated"
ON public.jobs
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    user_has_org_hierarchy_access(organization_id)
    AND user_is_workspace_owner(organization_id)
  )
);

COMMENT ON POLICY "jobs_delete_consolidated" ON public.jobs IS 
'Consolidated DELETE policy: Platform admins and workspace owners can delete jobs';

-- ========================================
-- STEP 4: CANDIDATES TABLE - Drop old policies
-- ========================================

DROP POLICY IF EXISTS "Users can view candidates in their organization" ON public.candidates;
DROP POLICY IF EXISTS "Job assigned users can view candidates" ON public.candidates;
DROP POLICY IF EXISTS "candidates_virgilio_hierarchy_exclude_saas" ON public.candidates;
DROP POLICY IF EXISTS "Users can insert candidates in their organization" ON public.candidates;
DROP POLICY IF EXISTS "Users can update candidates in their organization" ON public.candidates;
DROP POLICY IF EXISTS "Platform admins can manage all candidates" ON public.candidates;

-- ========================================
-- STEP 5: CANDIDATES TABLE - Create consolidated policies
-- ========================================

-- POLICY 1: candidates_select_consolidated
-- Who can VIEW candidates?
-- - Platform admins: all candidates
-- - Users: candidates in their org hierarchy
-- - Users: candidates for jobs they're assigned to
CREATE POLICY "candidates_select_consolidated"
ON public.candidates
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  user_has_org_hierarchy_access(organization_id)
  OR
  EXISTS (
    SELECT 1 
    FROM job_candidate_associations jca
    WHERE jca.candidate_id = candidates.id
    AND is_user_assigned_to_job(jca.job_id)
  )
);

COMMENT ON POLICY "candidates_select_consolidated" ON public.candidates IS 
'Consolidated SELECT policy: Platform admins see all, users see candidates in their org hierarchy or for jobs they are assigned to';

-- POLICY 2: candidates_insert_consolidated
-- Who can CREATE candidates?
-- - Platform admins: anywhere
-- - Admins + Recruiters: in their org
CREATE POLICY "candidates_insert_consolidated"
ON public.candidates
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    user_has_org_hierarchy_access(organization_id)
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  )
);

COMMENT ON POLICY "candidates_insert_consolidated" ON public.candidates IS 
'Consolidated INSERT policy: Platform admins can insert anywhere, admins and recruiters can insert in their org';

-- POLICY 3: candidates_update_consolidated
-- Who can UPDATE candidates?
-- - Platform admins: all candidates
-- - Admins + Recruiters: candidates in their org
CREATE POLICY "candidates_update_consolidated"
ON public.candidates
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    user_has_org_hierarchy_access(organization_id)
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  )
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    user_has_org_hierarchy_access(organization_id)
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  )
);

COMMENT ON POLICY "candidates_update_consolidated" ON public.candidates IS 
'Consolidated UPDATE policy: Platform admins and admins/recruiters in org can update candidates';

-- POLICY 4: candidates_delete_consolidated
-- Who can DELETE candidates?
-- - Platform admins: all candidates
-- - Workspace owners: candidates in their org
CREATE POLICY "candidates_delete_consolidated"
ON public.candidates
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    user_has_org_hierarchy_access(organization_id)
    AND user_is_workspace_owner(organization_id)
  )
);

COMMENT ON POLICY "candidates_delete_consolidated" ON public.candidates IS 
'Consolidated DELETE policy: Platform admins and workspace owners can delete candidates';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- Summary:
-- - Created user_is_workspace_owner() helper function
-- - Jobs: 8 policies → 4 policies (50% reduction)
-- - Candidates: 6 policies → 4 policies (33% reduction)
-- - Total: 14+ policies → 8 policies (43% reduction)
-- - Fixed: Recruiters can now see jobs in their org
-- - Removed: Hardcoded Virgilio business logic
-- ========================================