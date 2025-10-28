-- Create function to check organization hierarchy access
CREATE OR REPLACE FUNCTION public.user_has_org_hierarchy_access(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  member_org_id uuid;
  org_tree_ids uuid[];
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Platform admins have access to everything
  IF get_user_type_secure() = 'platform_admin' THEN
    RETURN true;
  END IF;
  
  -- Check each organization the user is a member of
  FOR member_org_id IN 
    SELECT organization_id 
    FROM public.members 
    WHERE user_id = current_user_id 
      AND user_status = 'active'
  LOOP
    -- Get the full organization tree for this membership
    SELECT ARRAY_AGG(id) INTO org_tree_ids
    FROM (
      -- Start with the member's org
      SELECT member_org_id as id
      
      UNION
      
      -- Add parent org if exists
      SELECT parent_organization_id as id
      FROM public.organizations
      WHERE id = member_org_id
        AND parent_organization_id IS NOT NULL
      
      UNION
      
      -- Add all siblings (children of the same parent)
      SELECT o.id
      FROM public.organizations o
      WHERE o.parent_organization_id = (
        SELECT parent_organization_id 
        FROM public.organizations 
        WHERE id = member_org_id
      )
      AND o.parent_organization_id IS NOT NULL
      
      UNION
      
      -- Add all children of the member's org
      SELECT o.id
      FROM public.organizations o
      WHERE o.parent_organization_id = member_org_id
    ) tree;
    
    -- Check if target org is in this tree
    IF target_org_id = ANY(org_tree_ids) THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$;

-- Update RLS policy for job_hiring_stages SELECT
DROP POLICY IF EXISTS "Users can view job hiring stages for accessible jobs" ON public.job_hiring_stages;

CREATE POLICY "Users can view job hiring stages for accessible jobs"
ON public.job_hiring_stages
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(job_id)
  OR user_has_org_hierarchy_access((SELECT organization_id FROM public.jobs WHERE id = job_hiring_stages.job_id))
);

-- Update RLS policy for job_stages SELECT
DROP POLICY IF EXISTS "Organization members can view job stages" ON public.job_stages;

CREATE POLICY "Organization members can view job stages"
ON public.job_stages
FOR SELECT
USING (
  organization_id IS NULL
  OR get_user_type_secure() = 'platform_admin'
  OR user_has_org_hierarchy_access(organization_id)
);