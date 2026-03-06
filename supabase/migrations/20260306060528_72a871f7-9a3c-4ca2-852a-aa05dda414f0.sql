-- ============================================================
-- Complete system_role migration: update all remaining functions
-- Functions 1-8 use CREATE OR REPLACE (no return type change)
-- Functions 9-10 need DROP first (return type changed)
-- Plus rename invitations.member_role column
-- ============================================================

-- 1. admin_insert_first_member
CREATE OR REPLACE FUNCTION public.admin_insert_first_member(p_tenant_id uuid, p_user_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_member_id UUID;
BEGIN
  RAISE LOG 'admin_insert_first_member called: tenant=%, user=%', p_tenant_id, p_user_id;
  SELECT id INTO v_member_id FROM public.members WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
  IF v_member_id IS NOT NULL THEN RAISE LOG 'Member already exists: %', v_member_id; RETURN v_member_id; END IF;
  INSERT INTO public.members (user_id, organization_id, tenant_id, user_type, system_role, user_status)
  VALUES (p_user_id, p_tenant_id, p_tenant_id, 'workspace_owner', 'admin', 'active')
  RETURNING id INTO v_member_id;
  RAISE LOG 'Successfully created first member: %', v_member_id;
  RETURN v_member_id;
END;
$function$;

-- 2. admin_manage_member
CREATE OR REPLACE FUNCTION public.admin_manage_member(p_member_id uuid, p_changes jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'audit'
AS $function$
DECLARE v_old_values jsonb; v_user_email text; v_operation text;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT to_jsonb(m.*) INTO v_old_values FROM public.members m WHERE id = p_member_id;
  IF v_old_values IS NULL THEN RAISE EXCEPTION 'Member not found: %', p_member_id; END IF;
  v_user_email := v_old_values->>'user_email';
  IF p_changes ? '_delete' AND (p_changes->>'_delete')::boolean = true THEN
    v_operation := 'delete'; DELETE FROM public.members WHERE id = p_member_id;
  ELSE
    v_operation := 'update';
    UPDATE public.members SET
      user_type = COALESCE((p_changes->>'user_type')::public.user_type_enum, user_type),
      system_role = COALESCE((p_changes->>'system_role')::public.system_role, system_role),
      user_status = COALESCE(p_changes->>'user_status', user_status),
      updated_at = now()
    WHERE id = p_member_id;
  END IF;
  PERFORM public.log_audit_event(p_action := format('admin_%s_member', v_operation), p_table_name := 'members', p_record_id := p_member_id, p_user_id := auth.uid(), p_old_values := v_old_values, p_new_values := CASE WHEN v_operation = 'delete' THEN NULL ELSE p_changes END);
  RETURN jsonb_build_object('success', true, 'member_id', p_member_id, 'operation', v_operation, 'user_email', v_user_email, 'message', format('Member "%s" %sd successfully', v_user_email, v_operation));
END;
$function$;

-- 3. audit_member_role_change trigger
CREATE OR REPLACE FUNCTION public.audit_member_role_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.system_role IS DISTINCT FROM NEW.system_role THEN
    INSERT INTO public.audit_logs (action, table_name, record_id, user_id, old_values, new_values, created_at)
    VALUES ('system_role_changed', 'members', NEW.id, auth.uid(),
      jsonb_build_object('system_role', OLD.system_role, 'user_type', OLD.user_type),
      jsonb_build_object('system_role', NEW.system_role, 'user_type', NEW.user_type), now());
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. log_member_activation trigger
CREATE OR REPLACE FUNCTION public.log_member_activation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$
DECLARE user_full_name TEXT; user_email TEXT;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.user_status = 'active' AND OLD.user_status != 'active')
     OR (TG_OP = 'INSERT' AND NEW.user_status = 'active') THEN
    SELECT COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name',
      CONCAT(au.raw_user_meta_data->>'first_name', ' ', au.raw_user_meta_data->>'last_name')), au.email
    INTO user_full_name, user_email FROM auth.users au WHERE au.id = NEW.user_id;
    INSERT INTO public.activities (user_id, organization_id, tenant_id, activity_type, title, description, metadata)
    VALUES (NEW.user_id, NEW.organization_id, NEW.tenant_id, 'member_activated', 'Team member joined',
      COALESCE(user_full_name, user_email, 'A new team member') || ' joined the team',
      jsonb_build_object('member_id', NEW.id, 'system_role', NEW.system_role, 'user_type', NEW.user_type));
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. get_tenant_billable_seat_count
CREATE OR REPLACE FUNCTION public.get_tenant_billable_seat_count(tenant_id_param uuid)
 RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE cnt integer;
BEGIN
  SELECT COUNT(DISTINCT m.user_id) INTO cnt
  FROM public.members m JOIN public.organizations o ON o.id = m.organization_id
  WHERE o.tenant_id = tenant_id_param AND m.user_status = 'active'
    AND m.user_type NOT IN ('platform_admin', 'guest')
    AND (m.user_type = 'workspace_owner' OR (m.user_type = 'member' AND m.system_role = 'admin'));
  RETURN COALESCE(cnt, 0);
END;
$function$;

-- 6. duplicate_job_posting
CREATE OR REPLACE FUNCTION public.duplicate_job_posting(source_posting_id uuid, new_title text DEFAULT NULL::text, new_description text DEFAULT NULL::text, new_details jsonb DEFAULT NULL::jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_job_id uuid; v_new_posting_id uuid;
BEGIN
  SELECT jp.job_id INTO v_job_id FROM public.job_postings jp WHERE jp.id = source_posting_id;
  IF v_job_id IS NULL THEN RAISE EXCEPTION 'Source posting not found'; END IF;
  IF public.get_user_type_secure() <> 'platform_admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.jobs j JOIN public.members m ON m.organization_id = j.organization_id
      WHERE j.id = v_job_id AND m.user_id = auth.uid() AND m.user_status = 'active' AND m.system_role = 'admin'
    ) AND NOT EXISTS (
      SELECT 1 FROM public.job_assignments ja WHERE ja.job_id = v_job_id AND ja.user_id = auth.uid()
    ) THEN RAISE EXCEPTION 'Insufficient permissions to duplicate posting'; END IF;
  END IF;
  INSERT INTO public.job_postings (job_id, title, description, details, is_active, created_by)
  SELECT jp.job_id, COALESCE(new_title, jp.title || ' (Copy)'), COALESCE(new_description, jp.description),
    COALESCE(new_details, jp.details), false, auth.uid()
  FROM public.job_postings jp WHERE jp.id = source_posting_id RETURNING id INTO v_new_posting_id;
  DELETE FROM public.job_posting_application_fields WHERE posting_id = v_new_posting_id;
  INSERT INTO public.job_posting_application_fields (posting_id, source, application_field_id, field_name, field_label, field_type, is_required, display_order, placeholder_text, help_text, accepted_file_types, max_file_size_mb, column_span)
  SELECT v_new_posting_id, s.source, s.application_field_id, s.field_name, s.field_label, s.field_type, s.is_required, s.display_order, s.placeholder_text, s.help_text, s.accepted_file_types, s.max_file_size_mb, s.column_span
  FROM public.job_posting_application_fields s WHERE s.posting_id = source_posting_id;
  INSERT INTO public.posting_field_select_options (posting_field_id, option_label, option_value, display_order)
  SELECT n.id, o.option_label, o.option_value, o.display_order
  FROM public.posting_field_select_options o
  JOIN public.job_posting_application_fields s ON s.id = o.posting_field_id
  JOIN public.job_posting_application_fields n ON n.posting_id = v_new_posting_id AND n.display_order = s.display_order
  WHERE s.posting_id = source_posting_id;
  RETURN v_new_posting_id;
END;
$function$;

-- 7. user_can_manage_org_members
CREATE OR REPLACE FUNCTION public.user_can_manage_org_members(org_id_param uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE current_user_id uuid; org_tenant_id uuid; can_manage boolean;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN RETURN false; END IF;
  SELECT tenant_id INTO org_tenant_id FROM public.organizations WHERE id = org_id_param;
  IF org_tenant_id IS NULL THEN RETURN false; END IF;
  SET LOCAL row_security = off;
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = current_user_id AND m.tenant_id = org_tenant_id AND m.user_status = 'active'
      AND (m.user_type = 'platform_admin' OR m.user_type = 'workspace_owner' OR m.system_role = 'admin')
  ) INTO can_manage;
  SET LOCAL row_security = on;
  RETURN can_manage;
END;
$function$;

-- 8. diagnose_user_auth
CREATE OR REPLACE FUNCTION public.diagnose_user_auth(target_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(check_name text, status text, details jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT 'Profile Organization'::text,
    CASE WHEN p.organization_id IS NULL THEN 'FAIL' ELSE 'PASS' END,
    jsonb_build_object('profile_org_id', p.organization_id, 'email', p.email)
  FROM profiles p WHERE p.user_id = target_user_id;
  RETURN QUERY SELECT 'Active Memberships'::text,
    CASE WHEN COUNT(*) = 0 THEN 'FAIL' ELSE 'PASS' END,
    jsonb_agg(jsonb_build_object('organization_id', m.organization_id, 'system_role', m.system_role, 'org_name', o.name))
  FROM members m JOIN organizations o ON o.id = m.organization_id
  WHERE m.user_id = target_user_id AND m.user_status = 'active' GROUP BY m.user_id;
  RETURN QUERY SELECT 'Metadata Consistency'::text,
    CASE WHEN u.raw_user_meta_data->>'organization_id' = p.organization_id::text THEN 'PASS'
      WHEN p.organization_id IS NULL THEN 'WARN' ELSE 'FAIL' END,
    jsonb_build_object('metadata_org', u.raw_user_meta_data->>'organization_id', 'profile_org', p.organization_id,
      'mismatch', u.raw_user_meta_data->>'organization_id' != p.organization_id::text)
  FROM auth.users u JOIN profiles p ON p.user_id = u.id WHERE u.id = target_user_id;
END;
$function$;

-- 9. audit_platform_admin_access: DROP and recreate (return type changed)
DROP FUNCTION IF EXISTS public.audit_platform_admin_access();
CREATE FUNCTION public.audit_platform_admin_access()
 RETURNS TABLE(user_email text, user_id uuid, has_member_record boolean, user_type text, system_role text, organization_id uuid, issue_description text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT au.email::text as user_email, au.id as user_id,
    (m.user_id IS NOT NULL) as has_member_record,
    COALESCE(m.user_type::text, 'NO_RECORD') as user_type,
    COALESCE(m.system_role::text, 'NO_RECORD') as system_role,
    m.organization_id,
    CASE
      WHEN au.raw_user_meta_data->>'user_type' = 'platform_admin' AND m.user_id IS NULL THEN 'Platform admin has no member record'
      WHEN au.raw_user_meta_data->>'user_type' = 'platform_admin' AND m.user_type::text != 'platform_admin' THEN 'Platform admin has incorrect user_type in members table'
      WHEN au.raw_user_meta_data->>'user_type' = 'platform_admin' AND m.organization_id IS NULL THEN 'Platform admin has no organization assignment'
      ELSE 'OK'
    END as issue_description
  FROM auth.users au LEFT JOIN public.members m ON au.id = m.user_id
  WHERE au.raw_user_meta_data->>'user_type' = 'platform_admin' ORDER BY au.email;
END;
$function$;

-- 10. debug_user_permissions: DROP and recreate (return type changed)
DROP FUNCTION IF EXISTS public.debug_user_permissions();
CREATE FUNCTION public.debug_user_permissions()
 RETURNS TABLE(current_user_id uuid, user_type text, system_role text, organization_id uuid, member_count bigint, can_see_all_orgs boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY SELECT auth.uid() as current_user_id, get_user_type() as user_type,
    get_member_role() as system_role, get_user_organization_id() as organization_id,
    (SELECT COUNT(*) FROM public.members WHERE user_id = auth.uid()) as member_count,
    (get_user_type() = 'platform_admin') as can_see_all_orgs;
END;
$function$;

-- 11. Rename invitations.member_role -> invitations.system_role
ALTER TABLE public.invitations RENAME COLUMN member_role TO system_role;