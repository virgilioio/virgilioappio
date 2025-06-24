
-- PHASE 1: Fix Organizations Table (Critical)
-- Drop all existing problematic policies on organizations
DROP POLICY IF EXISTS "organizations_platform_admin_all" ON public.organizations;
DROP POLICY IF EXISTS "orgs_platform_admin_access" ON public.organizations;
DROP POLICY IF EXISTS "organizations_workspace_owner_access" ON public.organizations;
DROP POLICY IF EXISTS "organizations_workspace_owner_update" ON public.organizations;
DROP POLICY IF EXISTS "organizations_customer_success_access" ON public.organizations;
DROP POLICY IF EXISTS "Organizations select policy" ON public.organizations;
DROP POLICY IF EXISTS "Organizations insert policy" ON public.organizations;
DROP POLICY IF EXISTS "Organizations update policy" ON public.organizations;
DROP POLICY IF EXISTS "Organizations delete policy" ON public.organizations;
DROP POLICY IF EXISTS "orgs_workspace_owner_view" ON public.organizations;
DROP POLICY IF EXISTS "orgs_owner_can_view" ON public.organizations;
DROP POLICY IF EXISTS "organizations_workspace_owner" ON public.organizations;
DROP POLICY IF EXISTS "recruiters_can_view_assigned_organizations" ON public.organizations;

-- Create simple, non-recursive policies for organizations
CREATE POLICY "Platform admins can manage all organizations"
  ON public.organizations FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Organization owners can view their organization"
  ON public.organizations FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Organization members can view their organization"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organizations.id 
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Organization owners can update their organization"
  ON public.organizations FOR UPDATE
  USING (owner_id = auth.uid());

-- PHASE 2: Fix Invoices Table (Critical for Payments)
-- Drop all existing problematic policies on invoices
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;

-- Create simple, non-recursive policies for invoices
CREATE POLICY "Platform admins can manage all invoices"
  ON public.invoices FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Organization members can view their invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = invoices.organization_id 
      AND m.user_status = 'active'
    )
  );

-- PHASE 3: Fix Job-Related Tables
-- Drop problematic policies on jobs
DROP POLICY IF EXISTS "jobs_platform_admin_access" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_with_assignments" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete" ON public.jobs;
DROP POLICY IF EXISTS "jobs_platform_admin_full" ON public.jobs;
DROP POLICY IF EXISTS "jobs_assigned_users_can_view" ON public.jobs;
DROP POLICY IF EXISTS "jobs_platform_admin" ON public.jobs;
DROP POLICY IF EXISTS "jobs_assigned_users" ON public.jobs;

-- Create simple, non-recursive policies for jobs
CREATE POLICY "Platform admins can manage all jobs"
  ON public.jobs FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Organization members can view their jobs"
  ON public.jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = jobs.organization_id 
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Organization admins can manage their jobs"
  ON public.jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = jobs.organization_id 
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Users can view jobs they are assigned to"
  ON public.jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_assignments ja 
      WHERE ja.job_id = jobs.id 
      AND ja.user_id = auth.uid()
    )
  );

-- Drop problematic policies on job_assignments
DROP POLICY IF EXISTS "job_assignments_select" ON public.job_assignments;
DROP POLICY IF EXISTS "job_assignments_insert" ON public.job_assignments;
DROP POLICY IF EXISTS "job_assignments_update" ON public.job_assignments;
DROP POLICY IF EXISTS "job_assignments_delete" ON public.job_assignments;

-- Create simple, non-recursive policies for job_assignments
CREATE POLICY "Platform admins can manage all job assignments"
  ON public.job_assignments FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Organization members can view assignments in their org"
  ON public.job_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = job_assignments.organization_id 
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Organization admins can manage assignments in their org"
  ON public.job_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = job_assignments.organization_id 
      AND m.member_role IN ('admin', 'recruiter')
      AND m.user_status = 'active'
    )
  );

-- Drop problematic policies on job_candidates
DROP POLICY IF EXISTS "job_candidates_select_policy" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_insert_policy" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_update_policy" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_delete_policy" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_select_with_assignments" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_insert" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_update" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_delete" ON public.job_candidates;

-- Create simple, non-recursive policies for job_candidates
CREATE POLICY "Platform admins can manage all job candidates"
  ON public.job_candidates FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Users can view candidates for jobs they can access"
  ON public.job_candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.members m ON j.organization_id = m.organization_id
      WHERE j.id = job_candidates.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.job_assignments ja
      WHERE ja.job_id = job_candidates.job_id
      AND ja.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization recruiters can manage candidates"
  ON public.job_candidates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.members m ON j.organization_id = m.organization_id
      WHERE j.id = job_candidates.job_id
      AND m.user_id = auth.uid()
      AND m.member_role IN ('admin', 'recruiter')
      AND m.user_status = 'active'
    )
  );

-- Drop problematic policies on job_requests
DROP POLICY IF EXISTS "job_requests_select_policy" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_insert_policy" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_update_policy" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_delete_policy" ON public.job_requests;

-- Create simple, non-recursive policies for job_requests
CREATE POLICY "Platform admins can manage all job requests"
  ON public.job_requests FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Organization members can view their job requests"
  ON public.job_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = job_requests.organization_id 
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Organization members can create job requests"
  ON public.job_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = job_requests.organization_id 
      AND m.member_role IN ('admin', 'recruiter', 'client')
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Organization admins can update job requests"
  ON public.job_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = job_requests.organization_id 
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
    )
  );

-- PHASE 4: Fix Remaining Tables
-- Drop problematic policies on activities
DROP POLICY IF EXISTS "activities_users_own" ON public.activities;
DROP POLICY IF EXISTS "activities_platform_admin" ON public.activities;
DROP POLICY IF EXISTS "activities_view_own_or_admin" ON public.activities;
DROP POLICY IF EXISTS "activities_insert_own" ON public.activities;
DROP POLICY IF EXISTS "activities_update_own_or_admin" ON public.activities;
DROP POLICY IF EXISTS "activities_delete_own_or_admin" ON public.activities;
DROP POLICY IF EXISTS "activities_platform_admin_access" ON public.activities;

-- Create simple, non-recursive policies for activities
CREATE POLICY "Platform admins can manage all activities"
  ON public.activities FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Users can manage their own activities"
  ON public.activities FOR ALL
  USING (user_id = auth.uid());

-- Drop problematic policies on candidate_comments
DROP POLICY IF EXISTS "candidate_comments_select_policy" ON public.candidate_comments;
DROP POLICY IF EXISTS "candidate_comments_insert_policy" ON public.candidate_comments;
DROP POLICY IF EXISTS "candidate_comments_update_policy" ON public.candidate_comments;
DROP POLICY IF EXISTS "candidate_comments_delete_policy" ON public.candidate_comments;

-- Create simple, non-recursive policies for candidate_comments
CREATE POLICY "Platform admins can manage all candidate comments"
  ON public.candidate_comments FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Organization members can view comments in their org"
  ON public.candidate_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = candidate_comments.organization_id 
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Organization members can create comments in their org"
  ON public.candidate_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = candidate_comments.organization_id 
      AND m.user_status = 'active'
    )
    AND author_id = auth.uid()
  );

CREATE POLICY "Users can update their own comments"
  ON public.candidate_comments FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON public.candidate_comments FOR DELETE
  USING (author_id = auth.uid());

-- Drop problematic policies on organization_custom_data
DROP POLICY IF EXISTS "Users can view organization custom data" ON public.organization_custom_data;
DROP POLICY IF EXISTS "Users can insert organization custom data" ON public.organization_custom_data;
DROP POLICY IF EXISTS "Users can update organization custom data" ON public.organization_custom_data;
DROP POLICY IF EXISTS "Users can delete organization custom data" ON public.organization_custom_data;

-- Create simple, non-recursive policies for organization_custom_data
CREATE POLICY "Platform admins can manage all organization custom data"
  ON public.organization_custom_data FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Organization members can view their custom data"
  ON public.organization_custom_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organization_custom_data.organization_id 
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Organization admins can manage their custom data"
  ON public.organization_custom_data FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organization_custom_data.organization_id 
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
    )
  );

-- Drop problematic policies on profiles
DROP POLICY IF EXISTS "Platform Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Org members can read profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;

-- Create simple, non-recursive policies for profiles
CREATE POLICY "Platform admins can manage all profiles"
  ON public.profiles FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Users can manage their own profile"
  ON public.profiles FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Organization members can view profiles in their org"
  ON public.profiles FOR SELECT
  USING (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = profiles.organization_id 
      AND m.user_status = 'active'
    )
  );
