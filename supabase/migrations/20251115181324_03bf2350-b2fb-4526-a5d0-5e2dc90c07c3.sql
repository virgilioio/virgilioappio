-- Fix user_is_workspace_owner to work correctly in SECURITY DEFINER context
-- The issue: auth.uid() returns NULL in SECURITY DEFINER functions
-- The solution: Extract user ID from JWT claims as fallback
CREATE OR REPLACE FUNCTION public.user_is_workspace_owner(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.members m
    JOIN public.organizations o ON m.tenant_id = o.tenant_id
    WHERE o.id = $1
      AND m.user_id = COALESCE(
        auth.uid(),
        (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
      )
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
$$;