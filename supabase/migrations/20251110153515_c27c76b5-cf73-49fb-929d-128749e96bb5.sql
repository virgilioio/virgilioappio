-- =====================================================
-- Phase 1.1: Block Recruiter Delete Operations
-- =====================================================

-- Drop and recreate jobs delete policy - workspace owners only
DROP POLICY IF EXISTS "jobs_delete_consolidated" ON public.jobs;
CREATE POLICY "jobs_delete_consolidated" ON public.jobs
FOR DELETE
TO authenticated
USING (public.user_is_workspace_owner(organization_id));

-- Drop and recreate candidates delete policy - platform admins and workspace owners only
DROP POLICY IF EXISTS "candidates_delete_consolidated" ON public.candidates;
CREATE POLICY "candidates_delete_consolidated" ON public.candidates
FOR DELETE
TO authenticated
USING (
  public.is_platform_admin() OR
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = candidates.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "jobs_delete_consolidated" ON public.jobs IS 
  'Only workspace owners can delete jobs. Recruiters have view/create/edit but NOT delete.';
COMMENT ON POLICY "candidates_delete_consolidated" ON public.candidates IS 
  'Only platform admins and workspace owners can delete candidates. Recruiters have view/create/edit but NOT delete.';