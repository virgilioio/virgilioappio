-- Phase 4: Complete member_role enum removal
-- Order: Drop policies → Drop old function overload → Drop columns → Drop enum → Recreate policies

-- ==========================================
-- STEP 1: Drop all RLS policies that reference member_role enum
-- ==========================================
DROP POLICY IF EXISTS "Users can view comments for accessible candidates" ON public.candidate_comments;
DROP POLICY IF EXISTS "Users can create comments for accessible candidates" ON public.candidate_comments;
DROP POLICY IF EXISTS "Admins and recruiters can view org assignments" ON public.job_assignments;
DROP POLICY IF EXISTS "job_assignments_insert_consolidated" ON public.job_assignments;
DROP POLICY IF EXISTS "job_assignments_delete_consolidated" ON public.job_assignments;
DROP POLICY IF EXISTS "email_logs_insert_consolidated" ON public.email_logs;
DROP POLICY IF EXISTS "jobs_insert_by_org_roles" ON public.jobs;
DROP POLICY IF EXISTS "Tenant recruiters can manage stage automations" ON public.stage_automations;
DROP POLICY IF EXISTS "Tenant recruiters can manage automation emails" ON public.stage_automation_emails;
DROP POLICY IF EXISTS "Org members can insert select options" ON public.posting_field_select_options;
DROP POLICY IF EXISTS "Org members can update select options" ON public.posting_field_select_options;
DROP POLICY IF EXISTS "Org members can delete select options" ON public.posting_field_select_options;

-- ==========================================
-- STEP 2: Drop old function overload with member_role parameter
-- ==========================================
DROP FUNCTION IF EXISTS public.check_org_member_access(uuid, member_role);

-- ==========================================
-- STEP 3: Drop member_role column from members table
-- ==========================================
ALTER TABLE public.members DROP COLUMN IF EXISTS member_role;

-- ==========================================
-- STEP 4: Change invitations.member_role from enum to text
-- ==========================================
ALTER TABLE public.invitations ALTER COLUMN member_role TYPE text USING member_role::text;

-- ==========================================
-- STEP 5: Drop the enum type
-- ==========================================
DROP TYPE IF EXISTS public.member_role;

-- ==========================================
-- STEP 6: Recreate RLS policies using system_role
-- ==========================================

-- candidate_comments: view
CREATE POLICY "Users can view comments for accessible candidates"
ON public.candidate_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = candidate_comments.organization_id
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- candidate_comments: insert
CREATE POLICY "Users can create comments for accessible candidates"
ON public.candidate_comments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = candidate_comments.organization_id
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- job_assignments: select
CREATE POLICY "Admins and members can view org assignments"
ON public.job_assignments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = job_assignments.organization_id
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- job_assignments: insert
CREATE POLICY "job_assignments_insert_consolidated"
ON public.job_assignments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = job_assignments.organization_id
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- job_assignments: delete
CREATE POLICY "job_assignments_delete_consolidated"
ON public.job_assignments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = job_assignments.organization_id
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- email_logs: insert
CREATE POLICY "email_logs_insert_consolidated"
ON public.email_logs FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = email_logs.organization_id
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- jobs: insert
CREATE POLICY "jobs_insert_by_org_roles"
ON public.jobs FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = jobs.organization_id
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- stage_automations: all (using correct join via job_hiring_stages)
CREATE POLICY "Tenant members can manage stage automations"
ON public.stage_automations FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_hiring_stages jhs
    JOIN public.jobs j ON j.id = jhs.job_id
    JOIN public.members m ON m.tenant_id = j.tenant_id
    WHERE jhs.id = stage_automations.job_hiring_stage_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_hiring_stages jhs
    JOIN public.jobs j ON j.id = jhs.job_id
    JOIN public.members m ON m.tenant_id = j.tenant_id
    WHERE jhs.id = stage_automations.job_hiring_stage_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- stage_automation_emails: all (using correct join via stage_automations → job_hiring_stages)
CREATE POLICY "Tenant members can manage automation emails"
ON public.stage_automation_emails FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stage_automations sa
    JOIN public.job_hiring_stages jhs ON jhs.id = sa.job_hiring_stage_id
    JOIN public.jobs j ON j.id = jhs.job_id
    JOIN public.members m ON m.tenant_id = j.tenant_id
    WHERE sa.id = stage_automation_emails.stage_automation_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stage_automations sa
    JOIN public.job_hiring_stages jhs ON jhs.id = sa.job_hiring_stage_id
    JOIN public.jobs j ON j.id = jhs.job_id
    JOIN public.members m ON m.tenant_id = j.tenant_id
    WHERE sa.id = stage_automation_emails.stage_automation_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- posting_field_select_options: insert
CREATE POLICY "Org members can insert select options"
ON public.posting_field_select_options FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- posting_field_select_options: update
CREATE POLICY "Org members can update select options"
ON public.posting_field_select_options FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);

-- posting_field_select_options: delete
CREATE POLICY "Org members can delete select options"
ON public.posting_field_select_options FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.system_role IN ('admin', 'member')
  )
);