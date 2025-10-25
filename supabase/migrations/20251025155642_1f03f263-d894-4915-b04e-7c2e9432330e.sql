-- Add hierarchical organization support for multi-tenant isolation
-- This ensures users see jobs from their organization AND all child organizations/departments

-- Function to get all organization IDs in user's hierarchy (parent + all children)
CREATE OR REPLACE FUNCTION public.get_user_org_hierarchy()
RETURNS TABLE(org_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE org_tree AS (
    -- Start with user's current organization
    SELECT id, parent_organization_id
    FROM public.organizations
    WHERE id = get_user_organization_id()
    
    UNION ALL
    
    -- Get all children recursively
    SELECT o.id, o.parent_organization_id
    FROM public.organizations o
    INNER JOIN org_tree ot ON o.parent_organization_id = ot.id
  )
  SELECT id AS org_id FROM org_tree;
$$;

-- Update jobs RLS policy to respect organizational hierarchy
DROP POLICY IF EXISTS "jobs_select_with_assignments" ON public.jobs;

CREATE POLICY "jobs_select_with_assignments" ON public.jobs 
FOR SELECT
USING (
  -- Match any organization in user's hierarchy (parent + all children)
  organization_id IN (SELECT org_id FROM get_user_org_hierarchy())
  OR
  -- OR be a guest/client assigned to this specific job
  (get_member_role() = 'client' AND EXISTS (
    SELECT 1 FROM public.job_assignments 
    WHERE job_id = jobs.id AND user_id = auth.uid()
  ))
);