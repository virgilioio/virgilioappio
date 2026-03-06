
-- Phase 1: Add system_role column to members table

-- 1. Create the system_role enum
CREATE TYPE public.system_role AS ENUM ('admin', 'member');

-- 2. Add system_role column
ALTER TABLE public.members 
  ADD COLUMN system_role public.system_role NOT NULL DEFAULT 'member';

-- 3. Populate from member_role
UPDATE public.members 
SET system_role = CASE 
  WHEN member_role = 'admin' THEN 'admin'::public.system_role
  ELSE 'member'::public.system_role
END;

-- 4. Update resolve_org_context
CREATE OR REPLACE FUNCTION public.resolve_org_context()
RETURNS TABLE(organization_id uuid, role text, user_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT null::uuid, null::text, 'guest'::text; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = current_user_id AND (raw_user_meta_data->>'user_type') = 'platform_admin') THEN
    RETURN QUERY SELECT m.organization_id, COALESCE(m.system_role::text, 'admin'), 'platform_admin'::text
    FROM public.members m WHERE m.user_id = current_user_id AND m.user_status = 'active'
    ORDER BY CASE WHEN m.user_type = 'platform_admin' THEN 1 ELSE 2 END, m.created_at DESC LIMIT 1;
    IF NOT FOUND THEN RETURN QUERY SELECT null::uuid, 'admin'::text, 'platform_admin'::text; END IF;
    RETURN;
  END IF;
  RETURN QUERY SELECT m.organization_id, m.system_role::text, COALESCE(m.user_type::text, 'guest')
  FROM public.members m WHERE m.user_id = current_user_id AND m.user_status = 'active'
  ORDER BY m.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN QUERY SELECT null::uuid, null::text, 'guest'::text; END IF;
END;
$$;

-- 5. Update get_member_role
CREATE OR REPLACE FUNCTION public.get_member_role()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE current_user_id uuid; role_result text;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN RETURN 'guest'; END IF;
  SELECT COALESCE(system_role::text, 'guest') INTO role_result
  FROM public.members WHERE user_id = current_user_id AND user_status = 'active' LIMIT 1;
  RETURN COALESCE(role_result, 'guest');
END;
$$;

-- 6. Update get_user_member_data
CREATE OR REPLACE FUNCTION public.get_user_member_data()
RETURNS TABLE(user_type text, member_role text, organization_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN RETURN QUERY SELECT 'guest'::text, null::text, null::uuid; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = current_user_id AND (raw_user_meta_data->>'user_type') = 'platform_admin') THEN
    RETURN QUERY SELECT 'platform_admin'::text, COALESCE(m.system_role::text, 'admin'), m.organization_id
    FROM public.members m WHERE m.user_id = current_user_id AND m.user_status = 'active'
    ORDER BY CASE WHEN m.user_type = 'platform_admin' THEN 1 ELSE 2 END, m.created_at DESC LIMIT 1;
    IF NOT FOUND THEN RETURN QUERY SELECT 'platform_admin'::text, 'admin'::text, null::uuid; END IF;
    RETURN;
  END IF;
  RETURN QUERY SELECT COALESCE(m.user_type::text, 'guest'), m.system_role::text, m.organization_id
  FROM public.members m WHERE m.user_id = current_user_id AND m.user_status = 'active'
  ORDER BY m.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN QUERY SELECT 'guest'::text, null::text, null::uuid; END IF;
END;
$$;

-- 7. Update auto_assign trigger
CREATE OR REPLACE FUNCTION public.auto_assign_job_creator_to_assignments()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.members WHERE user_id = auth.uid() AND user_status = 'active') THEN
    INSERT INTO public.job_assignments (job_id, user_id, organization_id, assigned_by, role)
    VALUES (NEW.id, auth.uid(), NEW.organization_id, auth.uid(), 'recruiter'::public.job_assignment_role)
    ON CONFLICT (job_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 8. Drop dependent policies first, then drop/recreate function, then recreate policies
DROP POLICY IF EXISTS "candidates_insert_consolidated" ON public.candidates;
DROP POLICY IF EXISTS "candidates_update_consolidated" ON public.candidates;

DROP FUNCTION IF EXISTS public.check_tenant_member_role(uuid, text);

CREATE FUNCTION public.check_tenant_member_role(tenant_id_param uuid, required_role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (SELECT (raw_user_meta_data->>'user_type') = 'platform_admin' FROM auth.users WHERE id = auth.uid()) THEN
    RETURN true;
  END IF;
  IF required_role = 'recruiter' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.tenant_id = tenant_id_param AND m.user_status = 'active'
        AND (m.user_type = 'workspace_owner' OR m.system_role IN ('admin', 'member'))
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.tenant_id = tenant_id_param AND m.user_status = 'active'
        AND (m.user_type = 'workspace_owner' OR m.system_role = 'admin')
    );
  END IF;
END;
$$;

-- Recreate candidate policies using the new function
CREATE POLICY "candidates_insert_consolidated" ON public.candidates
FOR INSERT WITH CHECK (
  (get_user_type_secure() = 'platform_admin') 
  OR (user_has_tenant_access(tenant_id) AND check_tenant_member_role(tenant_id, 'recruiter'))
);

CREATE POLICY "candidates_update_consolidated" ON public.candidates
FOR UPDATE USING (
  (get_user_type_secure() = 'platform_admin') 
  OR (user_has_tenant_access(tenant_id) AND check_tenant_member_role(tenant_id, 'recruiter'))
)
WITH CHECK (
  (get_user_type_secure() = 'platform_admin') 
  OR (user_has_tenant_access(tenant_id) AND check_tenant_member_role(tenant_id, 'recruiter'))
);

-- 9. Update audit trigger
CREATE OR REPLACE FUNCTION public.audit_member_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.system_role IS DISTINCT FROM NEW.system_role OR OLD.member_role IS DISTINCT FROM NEW.member_role THEN
    INSERT INTO public.audit_logs (action, table_name, record_id, user_id, old_values, new_values, created_at)
    VALUES ('member_role_changed', 'members', NEW.id, auth.uid(),
      jsonb_build_object('member_role', OLD.member_role, 'system_role', OLD.system_role, 'user_type', OLD.user_type),
      jsonb_build_object('member_role', NEW.member_role, 'system_role', NEW.system_role, 'user_type', NEW.user_type),
      now());
  END IF;
  RETURN NEW;
END;
$$;
