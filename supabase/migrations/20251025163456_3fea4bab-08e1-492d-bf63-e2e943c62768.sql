-- ============================================================
-- REVERT: Drop Complex Hierarchy-Based Policies (WITH CASCADE)
-- ============================================================

-- Drop all existing jobs policies first (with CASCADE to handle dependencies)
DROP POLICY IF EXISTS "jobs_tenant_isolation" ON public.jobs CASCADE;
DROP POLICY IF EXISTS "jobs_temp_full_access_for_virgilio_staff" ON public.jobs CASCADE;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.jobs CASCADE;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.jobs CASCADE;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.jobs CASCADE;

-- Now drop hierarchy functions (safe after policies are gone)
DROP FUNCTION IF EXISTS public.get_org_hierarchy(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_org_hierarchy(uuid) CASCADE;

-- Drop the organizations read policy for staff
DROP POLICY IF EXISTS "organizations_read_for_staff" ON public.organizations CASCADE;

-- ============================================================
-- SIMPLE SOLUTION: Virgilio Staff Isolation
-- ============================================================

-- SELECT: Virgilio staff ONLY see Virgilio org jobs, everyone else sees their org
CREATE POLICY jobs_simple_virgilio_isolation ON public.jobs
FOR SELECT
USING (
  -- Virgilio staff (@virgilio.tech): ONLY see Virgilio org jobs (no child orgs)
  (
    lower(split_part(public.get_user_email(), '@', 2)) = 'virgilio.tech'
    AND jobs.organization_id = '5ba7b145-f251-4b18-8900-724cb06028ab'::uuid
  )
  OR
  -- Everyone else: see their own organization's jobs
  (
    lower(split_part(public.get_user_email(), '@', 2)) != 'virgilio.tech'
    AND jobs.organization_id = public.get_user_organization_id()
  )
);

-- INSERT: Users can create jobs in their organization
CREATE POLICY jobs_insert_policy ON public.jobs
FOR INSERT
WITH CHECK (
  jobs.organization_id = public.get_user_organization_id()
  AND public.check_org_member_access(jobs.organization_id, 'recruiter')
);

-- UPDATE: Users can update jobs in their organization
CREATE POLICY jobs_update_policy ON public.jobs
FOR UPDATE
USING (
  jobs.organization_id = public.get_user_organization_id()
  AND public.check_org_member_access(jobs.organization_id, 'recruiter')
);

-- DELETE: Users can delete jobs in their organization
CREATE POLICY jobs_delete_policy ON public.jobs
FOR DELETE
USING (
  jobs.organization_id = public.get_user_organization_id()
  AND public.check_org_member_access(jobs.organization_id, 'admin')
);

-- ============================================================
-- Documentation
-- ============================================================

COMMENT ON POLICY jobs_simple_virgilio_isolation ON public.jobs IS 
  'Simple isolation: Virgilio staff (@virgilio.tech) only see jobs from Virgilio org (5ba7b145-f251-4b18-8900-724cb06028ab). SaaS customers see their own org jobs only.';