-- Phase 1: Fix Service Role Bypass in validate_org_creation_permissions()
-- Add auth.uid() IS NULL check for more robust service role detection

CREATE OR REPLACE FUNCTION public.validate_org_creation_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  jwt_role text;
BEGIN
  -- Method 1: Check if auth.uid() is NULL (service role context)
  -- This is the most reliable way to detect service role operations
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Method 2: Check JWT claims for service_role (fallback)
  BEGIN
    jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
    IF jwt_role = 'service_role' THEN
      RETURN NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If JWT claims are not available, proceed with normal checks
    NULL;
  END;
  
  -- Platform admins can create any org
  IF public.get_user_type_secure() = 'platform_admin' THEN
    RETURN NEW;
  END IF;
  
  -- Workspace owners can only create child orgs under their parent
  IF NEW.parent_organization_id IS NOT NULL THEN
    IF NOT public.user_is_workspace_owner(NEW.parent_organization_id) THEN
      RAISE EXCEPTION 'Only workspace owners can create child organizations';
    END IF;
  ELSE
    -- Only platform admins can create parent orgs (unless service role)
    RAISE EXCEPTION 'Only platform admins can create parent organizations';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Phase 2: Clean Up Orphaned Tenants for alejandrordz.oficial@gmail.com
-- These tenants were created during failed onboarding attempts and have no associated data

DELETE FROM public.tenants
WHERE id IN (
  'cffb9b44-43ae-409c-8ac2-5baeb82f7fbb',
  'c4d2f4fc-6636-4cd1-be77-a1856407d9de',
  '79f63997-ecee-4bb8-8cc2-33d4f92372dd',
  '5f563956-a229-4517-8031-b54085bef81a',
  'cca69b1a-470b-4d71-9786-131773c82c52'
);