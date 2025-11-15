-- Fix user_is_workspace_owner by using SQL language instead of plpgsql
-- SECURITY DEFINER SQL functions automatically bypass RLS - no manual bypassing needed!
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
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
$$;