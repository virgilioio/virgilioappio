-- ============================================================
-- JWT Helper Functions for Organization Hierarchy Security
-- ============================================================

-- Get user's email from JWT
CREATE OR REPLACE FUNCTION public.get_user_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email')::text,
    ''
  );
$$;

-- Get user's organization ID from JWT (already exists, keeping for consistency)
-- This was created in the previous migration but we'll ensure it's the right version
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  jwt_org_id text;
BEGIN
  -- Only read organization_id from JWT metadata (no database queries)
  jwt_org_id := auth.jwt() -> 'user_metadata' ->> 'organization_id';
  
  IF jwt_org_id IS NULL OR jwt_org_id = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN jwt_org_id::uuid;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- ============================================================
-- Organization Hierarchy Function
-- ============================================================

-- Get full organization hierarchy (root + all descendants)
CREATE OR REPLACE FUNCTION public.get_user_org_hierarchy(root_org_id uuid)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE org_tree AS (
    -- Start with the root organization
    SELECT o.id, o.parent_organization_id
    FROM public.organizations o
    WHERE o.id = root_org_id
    
    UNION ALL
    
    -- Recursively find all child organizations
    SELECT c.id, c.parent_organization_id
    FROM public.organizations c
    INNER JOIN org_tree ON c.parent_organization_id = org_tree.id
  )
  SELECT org_tree.id FROM org_tree;
$$;

-- ============================================================
-- Jobs Table RLS Policy - Hierarchy + Virgilio Staff Protection
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "jobs_tenant_isolation" ON public.jobs;
DROP POLICY IF EXISTS "Users can view jobs in org with assignments" ON public.jobs;
DROP POLICY IF EXISTS "Platform admins can manage all jobs - secure" ON public.jobs;
DROP POLICY IF EXISTS "Org members can view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Assigned users can view jobs" ON public.jobs;
DROP POLICY IF EXISTS "job_members" ON public.jobs;
DROP POLICY IF EXISTS "jobs_org_members" ON public.jobs;

-- Create new hierarchy-based policy for SELECT
CREATE POLICY "jobs_tenant_isolation" ON public.jobs
FOR SELECT
USING (
  -- Virgilio staff (@virgilio.tech) are ALWAYS locked to Virgilio org hierarchy
  -- This prevents JWT tampering to access other tenants
  (
    lower(split_part(public.get_user_email(), '@', 2)) = 'virgilio.tech'
    AND jobs.organization_id IN (
      SELECT id FROM public.get_user_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
    )
  )
  OR
  -- For all other users, use their JWT organization_id
  (
    lower(split_part(public.get_user_email(), '@', 2)) != 'virgilio.tech'
    AND public.get_user_organization_id() IS NOT NULL
    AND jobs.organization_id IN (
      SELECT id FROM public.get_user_org_hierarchy(public.get_user_organization_id())
    )
  )
);

-- Platform admins can manage all jobs (INSERT, UPDATE, DELETE)
CREATE POLICY "Platform admins can manage all jobs" ON public.jobs
FOR ALL
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

-- Org recruiters can insert jobs in their hierarchy
CREATE POLICY "Org recruiters can insert jobs" ON public.jobs
FOR INSERT
WITH CHECK (
  (
    lower(split_part(public.get_user_email(), '@', 2)) = 'virgilio.tech'
    AND jobs.organization_id IN (
      SELECT id FROM public.get_user_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
    )
  )
  OR
  (
    lower(split_part(public.get_user_email(), '@', 2)) != 'virgilio.tech'
    AND public.get_user_organization_id() IS NOT NULL
    AND jobs.organization_id IN (
      SELECT id FROM public.get_user_org_hierarchy(public.get_user_organization_id())
    )
    AND check_org_member_access(jobs.organization_id, 'recruiter'::member_role)
  )
);

-- Org recruiters can update jobs in their hierarchy
CREATE POLICY "Org recruiters can update jobs" ON public.jobs
FOR UPDATE
USING (
  (
    lower(split_part(public.get_user_email(), '@', 2)) = 'virgilio.tech'
    AND jobs.organization_id IN (
      SELECT id FROM public.get_user_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
    )
    AND check_org_member_access(jobs.organization_id, 'recruiter'::member_role)
  )
  OR
  (
    lower(split_part(public.get_user_email(), '@', 2)) != 'virgilio.tech'
    AND public.get_user_organization_id() IS NOT NULL
    AND jobs.organization_id IN (
      SELECT id FROM public.get_user_org_hierarchy(public.get_user_organization_id())
    )
    AND check_org_member_access(jobs.organization_id, 'recruiter'::member_role)
  )
)
WITH CHECK (
  (
    lower(split_part(public.get_user_email(), '@', 2)) = 'virgilio.tech'
    AND jobs.organization_id IN (
      SELECT id FROM public.get_user_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
    )
    AND check_org_member_access(jobs.organization_id, 'recruiter'::member_role)
  )
  OR
  (
    lower(split_part(public.get_user_email(), '@', 2)) != 'virgilio.tech'
    AND public.get_user_organization_id() IS NOT NULL
    AND jobs.organization_id IN (
      SELECT id FROM public.get_user_org_hierarchy(public.get_user_organization_id())
    )
    AND check_org_member_access(jobs.organization_id, 'recruiter'::member_role)
  )
);

-- Org admins can delete jobs in their hierarchy
CREATE POLICY "Org admins can delete jobs" ON public.jobs
FOR DELETE
USING (
  (
    lower(split_part(public.get_user_email(), '@', 2)) = 'virgilio.tech'
    AND jobs.organization_id IN (
      SELECT id FROM public.get_user_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
    )
    AND check_org_member_access(jobs.organization_id, 'admin'::member_role)
  )
  OR
  (
    lower(split_part(public.get_user_email(), '@', 2)) != 'virgilio.tech'
    AND public.get_user_organization_id() IS NOT NULL
    AND jobs.organization_id IN (
      SELECT id FROM public.get_user_org_hierarchy(public.get_user_organization_id())
    )
    AND check_org_member_access(jobs.organization_id, 'admin'::member_role)
  )
);

COMMENT ON FUNCTION public.get_user_email() IS 'Returns the email from the JWT token for security checks';
COMMENT ON FUNCTION public.get_user_organization_id() IS 'Returns the organization_id from JWT metadata, set by set-current-organization edge function';
COMMENT ON FUNCTION public.get_user_org_hierarchy(uuid) IS 'Returns the full organization hierarchy (root + descendants) for a given organization ID';
COMMENT ON POLICY "jobs_tenant_isolation" ON public.jobs IS 'Enforces organization hierarchy visibility with Virgilio staff protection against JWT tampering';