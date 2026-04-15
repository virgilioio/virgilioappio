
-- 1. Create SECURITY DEFINER function to break RLS recursion
CREATE OR REPLACE FUNCTION public.is_sourcing_project_creator(
  _project_id UUID, _user_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sourcing_projects
    WHERE id = _project_id AND created_by = _user_id
  );
$$;

-- 2. Fix collaborators SELECT policy (breaks the cycle)
DROP POLICY IF EXISTS "Project creators can view collaborators"
  ON sourcing_project_collaborators;

CREATE POLICY "Project creators can view collaborators"
  ON sourcing_project_collaborators FOR SELECT
  USING (
    is_sourcing_project_creator(sourcing_project_id, auth.uid())
  );

-- 3. Fix sourcing_projects SELECT policy (ambiguous id)
DROP POLICY IF EXISTS "Users can view own, public, or collaborated projects"
  ON sourcing_projects;

CREATE POLICY "Users can view own, public, or collaborated projects"
  ON sourcing_projects FOR SELECT
  USING (
    created_by = auth.uid()
    OR (is_public = true AND user_has_org_hierarchy_access(organization_id))
    OR get_user_type_secure() = 'platform_admin'
    OR EXISTS (
      SELECT 1 FROM sourcing_project_collaborators spc
      WHERE spc.sourcing_project_id = sourcing_projects.id
        AND spc.user_id = auth.uid()
    )
  );

-- 4. Fix sourcing_projects UPDATE policy (ambiguous id)
DROP POLICY IF EXISTS "Users can update own or collaborated projects"
  ON sourcing_projects;

CREATE POLICY "Users can update own or collaborated projects"
  ON sourcing_projects FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sourcing_project_collaborators spc
      WHERE spc.sourcing_project_id = sourcing_projects.id
        AND spc.user_id = auth.uid()
    )
  );

-- 5. Fix collaborators INSERT policy
DROP POLICY IF EXISTS "Project creators can add collaborators"
  ON sourcing_project_collaborators;

CREATE POLICY "Project creators can add collaborators"
  ON sourcing_project_collaborators FOR INSERT
  WITH CHECK (
    added_by = auth.uid()
    AND is_sourcing_project_creator(sourcing_project_id, auth.uid())
  );

-- 6. Fix collaborators DELETE policy
DROP POLICY IF EXISTS "Project creators can remove collaborators"
  ON sourcing_project_collaborators;

CREATE POLICY "Project creators can remove collaborators"
  ON sourcing_project_collaborators FOR DELETE
  USING (is_sourcing_project_creator(sourcing_project_id, auth.uid()));
