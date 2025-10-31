-- ========================================
-- TENANT ISOLATION FOR PLATFORM ADMINS
-- Restricts platform admins to Virgilio org only
-- Removes cross-tenant access to SaaS customer data
-- ========================================

-- ========================================
-- STEP 1: Update user_has_org_hierarchy_access
-- Remove platform admin bypass
-- ========================================

CREATE OR REPLACE FUNCTION public.user_has_org_hierarchy_access(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  member_org_id uuid;
  org_tree_ids uuid[];
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- ✅ REMOVED: Platform admin bypass (was lines 20-23)
  -- Platform admins now follow the same organization hierarchy rules
  -- They must be members of an organization to access its data
  -- This enforces true multi-tenant isolation
  
  -- Check each organization the user is a member of
  FOR member_org_id IN 
    SELECT organization_id 
    FROM public.members 
    WHERE user_id = current_user_id 
      AND user_status = 'active'
  LOOP
    -- Get the full organization tree for this membership
    SELECT ARRAY_AGG(id) INTO org_tree_ids
    FROM (
      -- Start with the member's org
      SELECT member_org_id as id
      
      UNION
      
      -- Add parent org if exists
      SELECT parent_organization_id as id
      FROM public.organizations
      WHERE id = member_org_id
        AND parent_organization_id IS NOT NULL
      
      UNION
      
      -- Add all siblings (children of the same parent)
      SELECT o.id
      FROM public.organizations o
      WHERE o.parent_organization_id = (
        SELECT parent_organization_id 
        FROM public.organizations 
        WHERE id = member_org_id
      )
      AND o.parent_organization_id IS NOT NULL
      
      UNION
      
      -- Add all children of the member's org
      SELECT o.id
      FROM public.organizations o
      WHERE o.parent_organization_id = member_org_id
    ) tree;
    
    -- Check if target org is in this tree
    IF target_org_id = ANY(org_tree_ids) THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.user_has_org_hierarchy_access IS 
'Checks if user has access to an organization based on membership and hierarchy. Platform admins must be members of an organization to access its data (tenant isolation).';

-- ========================================
-- STEP 2: Simplify Jobs RLS Policies
-- Remove redundant platform admin checks
-- ========================================

-- Drop existing jobs policies
DROP POLICY IF EXISTS "jobs_select_consolidated" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_consolidated" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_consolidated" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_consolidated" ON public.jobs;

-- POLICY 1: jobs_select_consolidated
CREATE POLICY "jobs_select_consolidated"
ON public.jobs
FOR SELECT
USING (
  user_has_org_hierarchy_access(organization_id)
  OR
  is_user_assigned_to_job(id)
);

COMMENT ON POLICY "jobs_select_consolidated" ON public.jobs IS 
'Consolidated SELECT: Users see jobs in their org hierarchy or jobs they are assigned to. Platform admins only see Virgilio org data.';

-- POLICY 2: jobs_insert_consolidated
CREATE POLICY "jobs_insert_consolidated"
ON public.jobs
FOR INSERT
WITH CHECK (
  user_has_org_hierarchy_access(organization_id)
  AND check_org_member_access(organization_id, 'recruiter'::member_role)
);

COMMENT ON POLICY "jobs_insert_consolidated" ON public.jobs IS 
'Consolidated INSERT: Admins and recruiters can insert in their org. Platform admins only in Virgilio org.';

-- POLICY 3: jobs_update_consolidated
CREATE POLICY "jobs_update_consolidated"
ON public.jobs
FOR UPDATE
USING (
  (
    user_has_org_hierarchy_access(organization_id)
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  )
  OR
  is_user_assigned_to_job(id)
)
WITH CHECK (
  (
    user_has_org_hierarchy_access(organization_id)
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  )
  OR
  is_user_assigned_to_job(id)
);

COMMENT ON POLICY "jobs_update_consolidated" ON public.jobs IS 
'Consolidated UPDATE: Admins/recruiters in org or users assigned to job can update. Platform admins only in Virgilio org.';

-- POLICY 4: jobs_delete_consolidated
CREATE POLICY "jobs_delete_consolidated"
ON public.jobs
FOR DELETE
USING (
  user_has_org_hierarchy_access(organization_id)
  AND user_is_workspace_owner(organization_id)
);

COMMENT ON POLICY "jobs_delete_consolidated" ON public.jobs IS 
'Consolidated DELETE: Workspace owners can delete jobs. Platform admins only in Virgilio org.';

-- ========================================
-- STEP 3: Simplify Candidates RLS Policies
-- Remove redundant platform admin checks
-- ========================================

-- Drop existing candidates policies
DROP POLICY IF EXISTS "candidates_select_consolidated" ON public.candidates;
DROP POLICY IF EXISTS "candidates_insert_consolidated" ON public.candidates;
DROP POLICY IF EXISTS "candidates_update_consolidated" ON public.candidates;
DROP POLICY IF EXISTS "candidates_delete_consolidated" ON public.candidates;

-- POLICY 1: candidates_select_consolidated
CREATE POLICY "candidates_select_consolidated"
ON public.candidates
FOR SELECT
USING (
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
'Consolidated SELECT: Users see candidates in their org hierarchy or for jobs they are assigned to. Platform admins only see Virgilio org data.';

-- POLICY 2: candidates_insert_consolidated
CREATE POLICY "candidates_insert_consolidated"
ON public.candidates
FOR INSERT
WITH CHECK (
  user_has_org_hierarchy_access(organization_id)
  AND check_org_member_access(organization_id, 'recruiter'::member_role)
);

COMMENT ON POLICY "candidates_insert_consolidated" ON public.candidates IS 
'Consolidated INSERT: Admins and recruiters can insert in their org. Platform admins only in Virgilio org.';

-- POLICY 3: candidates_update_consolidated
CREATE POLICY "candidates_update_consolidated"
ON public.candidates
FOR UPDATE
USING (
  user_has_org_hierarchy_access(organization_id)
  AND check_org_member_access(organization_id, 'recruiter'::member_role)
)
WITH CHECK (
  user_has_org_hierarchy_access(organization_id)
  AND check_org_member_access(organization_id, 'recruiter'::member_role)
);

COMMENT ON POLICY "candidates_update_consolidated" ON public.candidates IS 
'Consolidated UPDATE: Admins and recruiters in org can update candidates. Platform admins only in Virgilio org.';

-- POLICY 4: candidates_delete_consolidated
CREATE POLICY "candidates_delete_consolidated"
ON public.candidates
FOR DELETE
USING (
  user_has_org_hierarchy_access(organization_id)
  AND user_is_workspace_owner(organization_id)
);

COMMENT ON POLICY "candidates_delete_consolidated" ON public.candidates IS 
'Consolidated DELETE: Workspace owners can delete candidates. Platform admins only in Virgilio org.';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- Summary:
-- ✅ Removed platform admin bypass from user_has_org_hierarchy_access()
-- ✅ Platform admins now restricted to Virgilio org only (tenant isolation)
-- ✅ Simplified all 8 RLS policies (removed redundant checks)
-- ✅ SaaS customer data fully isolated from Virgilio team
-- ✅ Code is simpler, more maintainable, and more secure
-- ========================================