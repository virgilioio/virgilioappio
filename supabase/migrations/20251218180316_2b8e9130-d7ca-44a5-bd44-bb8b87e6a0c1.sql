-- Step 1: Create tenant-based role check function
CREATE OR REPLACE FUNCTION public.check_tenant_member_role(tenant_id_param uuid, required_role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = tenant_id_param
    AND m.user_status = 'active'
    AND (
      m.user_type = 'workspace_owner'
      OR m.user_type = 'platform_admin'
      OR m.member_role::text = required_role
      OR (required_role = 'recruiter' AND m.member_role IN ('admin', 'recruiter'))
      OR (required_role = 'hiring_manager' AND m.member_role IN ('admin', 'recruiter', 'hiring_manager'))
      OR (required_role = 'interviewer' AND m.member_role IN ('admin', 'recruiter', 'hiring_manager', 'interviewer'))
      OR (required_role = 'member' AND m.member_role IS NOT NULL)
    )
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Step 2: Update candidates SELECT policy (tenant-based)
DROP POLICY IF EXISTS candidates_select_consolidated ON public.candidates;

CREATE POLICY candidates_select_consolidated ON public.candidates
FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    public.get_user_type_secure() = 'platform_admin'
    OR public.user_has_tenant_access(tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.job_candidate_associations jca
      WHERE jca.candidate_id = candidates.id
      AND public.is_user_assigned_to_job(jca.job_id)
    )
  )
);

-- Step 3: Update candidates INSERT policy (tenant-based)
DROP POLICY IF EXISTS candidates_insert_consolidated ON public.candidates;

CREATE POLICY candidates_insert_consolidated ON public.candidates
FOR INSERT
WITH CHECK (
  public.get_user_type_secure() = 'platform_admin'
  OR (
    public.user_has_tenant_access(tenant_id)
    AND public.check_tenant_member_role(tenant_id, 'recruiter')
  )
);

-- Step 4: Update candidates UPDATE policy (tenant-based)
DROP POLICY IF EXISTS candidates_update_consolidated ON public.candidates;

CREATE POLICY candidates_update_consolidated ON public.candidates
FOR UPDATE
USING (
  public.get_user_type_secure() = 'platform_admin'
  OR (
    public.user_has_tenant_access(tenant_id)
    AND public.check_tenant_member_role(tenant_id, 'recruiter')
  )
)
WITH CHECK (
  public.get_user_type_secure() = 'platform_admin'
  OR (
    public.user_has_tenant_access(tenant_id)
    AND public.check_tenant_member_role(tenant_id, 'recruiter')
  )
);