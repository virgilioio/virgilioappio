-- Phase 1 & 2: Add is_public column and update RLS policies for sourcing_projects

-- Add is_public column
ALTER TABLE sourcing_projects
ADD COLUMN is_public BOOLEAN DEFAULT false;

-- Create index for performance
CREATE INDEX idx_sourcing_projects_visibility 
  ON sourcing_projects(organization_id, is_public) 
  WHERE is_public = true;

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Org members can view projects" ON sourcing_projects;

-- Create new policy supporting creator-only and public projects
CREATE POLICY "Users can view own or public org projects"
  ON sourcing_projects FOR SELECT
  USING (
    -- Always allow creator to see their own
    created_by = auth.uid()
    -- OR project is public AND user is in the org hierarchy
    OR (
      is_public = true 
      AND user_has_org_hierarchy_access(organization_id)
    )
    -- OR platform admin
    OR get_user_type_secure() = 'platform_admin'
  );

-- Update UPDATE policy to allow toggling visibility
DROP POLICY IF EXISTS "Org recruiters can update projects" ON sourcing_projects;

CREATE POLICY "Creators can update their projects"
  ON sourcing_projects FOR UPDATE
  USING (
    created_by = auth.uid()
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  )
  WITH CHECK (
    created_by = auth.uid()
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  );