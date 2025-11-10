-- =====================================================
-- Phase 2.2: Create SECURITY DEFINER Admin Functions
-- =====================================================

-- Function: Admin Delete Job
CREATE OR REPLACE FUNCTION public.admin_delete_job(p_job_id UUID) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'audit'
AS $$
DECLARE
  v_job_title text;
  v_org_id uuid;
  v_affected_count integer;
BEGIN
  -- Verify caller is platform admin
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins can delete jobs via this function';
  END IF;
  
  -- Get job details before deletion for audit log
  SELECT title, organization_id INTO v_job_title, v_org_id
  FROM public.jobs
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  -- Count affected records (candidates in this job)
  SELECT COUNT(*) INTO v_affected_count
  FROM public.job_candidate_associations
  WHERE job_id = p_job_id;
  
  -- Perform deletion (CASCADE will handle related records)
  DELETE FROM public.jobs WHERE id = p_job_id;
  
  -- Log action to audit schema
  PERFORM public.log_audit_event(
    p_action := 'admin_delete_job',
    p_table_name := 'jobs',
    p_record_id := p_job_id,
    p_user_id := auth.uid(),
    p_old_values := jsonb_build_object(
      'title', v_job_title,
      'organization_id', v_org_id
    ),
    p_new_values := NULL
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'job_title', v_job_title,
    'affected_associations', v_affected_count,
    'message', format('Job "%s" deleted successfully', v_job_title)
  );
END;
$$;

-- Function: Admin Delete Candidate
CREATE OR REPLACE FUNCTION public.admin_delete_candidate(p_candidate_id UUID) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'audit'
AS $$
DECLARE
  v_candidate_name text;
  v_tenant_id uuid;
  v_affected_count integer;
BEGIN
  -- Verify caller is platform admin
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins can delete candidates via this function';
  END IF;
  
  -- Get candidate details before deletion for audit log
  SELECT candidate_name, tenant_id INTO v_candidate_name, v_tenant_id
  FROM public.candidates
  WHERE id = p_candidate_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found: %', p_candidate_id;
  END IF;
  
  -- Count affected records (job associations)
  SELECT COUNT(*) INTO v_affected_count
  FROM public.job_candidate_associations
  WHERE candidate_id = p_candidate_id;
  
  -- Perform deletion (CASCADE will handle related records)
  DELETE FROM public.candidates WHERE id = p_candidate_id;
  
  -- Log action to audit schema
  PERFORM public.log_audit_event(
    p_action := 'admin_delete_candidate',
    p_table_name := 'candidates',
    p_record_id := p_candidate_id,
    p_user_id := auth.uid(),
    p_old_values := jsonb_build_object(
      'candidate_name', v_candidate_name,
      'tenant_id', v_tenant_id
    ),
    p_new_values := NULL
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'candidate_id', p_candidate_id,
    'candidate_name', v_candidate_name,
    'affected_associations', v_affected_count,
    'message', format('Candidate "%s" deleted successfully', v_candidate_name)
  );
END;
$$;

-- Function: Admin Manage Member
CREATE OR REPLACE FUNCTION public.admin_manage_member(
  p_member_id UUID,
  p_changes JSONB
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'audit'
AS $$
DECLARE
  v_old_values jsonb;
  v_user_email text;
  v_operation text;
BEGIN
  -- Verify caller is platform admin
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins can manage members via this function';
  END IF;
  
  -- Get current member data for audit log
  SELECT to_jsonb(m.*) INTO v_old_values
  FROM public.members m
  WHERE id = p_member_id;
  
  IF v_old_values IS NULL THEN
    RAISE EXCEPTION 'Member not found: %', p_member_id;
  END IF;
  
  v_user_email := v_old_values->>'user_email';
  
  -- Check if this is a delete operation
  IF p_changes ? '_delete' AND (p_changes->>'_delete')::boolean = true THEN
    v_operation := 'delete';
    DELETE FROM public.members WHERE id = p_member_id;
  ELSE
    v_operation := 'update';
    -- Build dynamic UPDATE query
    UPDATE public.members
    SET 
      user_type = COALESCE((p_changes->>'user_type')::public.user_type_enum, user_type),
      member_role = COALESCE((p_changes->>'member_role')::public.member_role, member_role),
      user_status = COALESCE(p_changes->>'user_status', user_status),
      updated_at = now()
    WHERE id = p_member_id;
  END IF;
  
  -- Log action to audit schema
  PERFORM public.log_audit_event(
    p_action := format('admin_%s_member', v_operation),
    p_table_name := 'members',
    p_record_id := p_member_id,
    p_user_id := auth.uid(),
    p_old_values := v_old_values,
    p_new_values := CASE WHEN v_operation = 'delete' THEN NULL ELSE p_changes END
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'member_id', p_member_id,
    'operation', v_operation,
    'user_email', v_user_email,
    'message', format('Member "%s" %sd successfully', v_user_email, v_operation)
  );
END;
$$;

-- Function: Admin Manage Organization
CREATE OR REPLACE FUNCTION public.admin_manage_organization(
  p_organization_id UUID,
  p_changes JSONB
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'audit'
AS $$
DECLARE
  v_old_values jsonb;
  v_org_name text;
  v_operation text;
BEGIN
  -- Verify caller is platform admin
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins can manage organizations via this function';
  END IF;
  
  -- Get current org data for audit log
  SELECT to_jsonb(o.*) INTO v_old_values
  FROM public.organizations o
  WHERE id = p_organization_id;
  
  IF v_old_values IS NULL THEN
    RAISE EXCEPTION 'Organization not found: %', p_organization_id;
  END IF;
  
  v_org_name := v_old_values->>'name';
  
  -- Check if this is a delete operation
  IF p_changes ? '_delete' AND (p_changes->>'_delete')::boolean = true THEN
    v_operation := 'delete';
    -- Soft delete by setting status to inactive
    UPDATE public.organizations
    SET status = 'inactive', updated_at = now()
    WHERE id = p_organization_id;
  ELSE
    v_operation := 'update';
    -- Build dynamic UPDATE query for allowed fields
    UPDATE public.organizations
    SET 
      name = COALESCE(p_changes->>'name', name),
      status = COALESCE(p_changes->>'status', status),
      org_kind = COALESCE(p_changes->>'org_kind', org_kind),
      updated_at = now()
    WHERE id = p_organization_id;
  END IF;
  
  -- Log action to audit schema
  PERFORM public.log_audit_event(
    p_action := format('admin_%s_organization', v_operation),
    p_table_name := 'organizations',
    p_record_id := p_organization_id,
    p_user_id := auth.uid(),
    p_old_values := v_old_values,
    p_new_values := p_changes
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_organization_id,
    'operation', v_operation,
    'org_name', v_org_name,
    'message', format('Organization "%s" %sd successfully', v_org_name, v_operation)
  );
END;
$$;

-- Add comments
COMMENT ON FUNCTION public.admin_delete_job IS 
  'SECURITY DEFINER function for platform admins to delete jobs. All operations are audited.';
  
COMMENT ON FUNCTION public.admin_delete_candidate IS 
  'SECURITY DEFINER function for platform admins to delete candidates. All operations are audited.';
  
COMMENT ON FUNCTION public.admin_manage_member IS 
  'SECURITY DEFINER function for platform admins to update or delete members. All operations are audited.';
  
COMMENT ON FUNCTION public.admin_manage_organization IS 
  'SECURITY DEFINER function for platform admins to update or soft-delete organizations. All operations are audited.';