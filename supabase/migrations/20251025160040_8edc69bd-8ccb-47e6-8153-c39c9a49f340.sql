-- Fix RLS circular dependency in get_user_organization_id()
-- The issue: This function is called from RLS policies, but it queries the members table
-- which has its own RLS policies, creating a circular dependency.
--
-- Solution: Read from JWT metadata first, then bypass RLS when querying members table

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  result uuid;
  jwt_org_id text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN null;
  END IF;
  
  -- First, try to get organization_id from JWT metadata (set by set-current-organization edge function)
  -- This is the fastest path and avoids any RLS queries
  BEGIN
    jwt_org_id := auth.jwt() -> 'user_metadata' ->> 'organization_id';
    IF jwt_org_id IS NOT NULL AND jwt_org_id != '' THEN
      RETURN jwt_org_id::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If JWT parsing fails, continue to database query
    NULL;
  END;
  
  -- Fallback: Query the members table with RLS temporarily disabled
  -- This breaks the circular dependency by bypassing RLS policies on members table
  BEGIN
    -- Temporarily disable RLS for this transaction
    SET LOCAL row_security = off;
    
    -- Get the user's primary organization
    SELECT m.organization_id INTO result
    FROM public.members m
    WHERE m.user_id = current_user_id 
      AND m.user_status = 'active'
    ORDER BY 
      -- Platform admins get their Virgilio organization first
      CASE WHEN m.user_type = 'platform_admin' THEN 1 ELSE 2 END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.organizations o 
        WHERE o.id = m.organization_id 
        AND o.name = 'Virgilio'
      ) THEN 1 ELSE 2 END,
      m.created_at DESC
    LIMIT 1;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
  EXCEPTION WHEN OTHERS THEN
    -- Re-enable RLS even if there's an error
    SET LOCAL row_security = on;
    RAISE;
  END;
  
  RETURN result;
END;
$function$;