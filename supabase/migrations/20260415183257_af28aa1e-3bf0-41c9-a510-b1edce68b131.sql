
-- Create sourcing_project_collaborators table
CREATE TABLE public.sourcing_project_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sourcing_project_id UUID NOT NULL REFERENCES public.sourcing_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sourcing_project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.sourcing_project_collaborators ENABLE ROW LEVEL SECURITY;

-- Collaborators can see their own rows
CREATE POLICY "Users can view their collaborations"
  ON public.sourcing_project_collaborators
  FOR SELECT
  USING (user_id = auth.uid());

-- Project creator can see all collaborators on their projects
CREATE POLICY "Project creators can view collaborators"
  ON public.sourcing_project_collaborators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sourcing_projects sp
      WHERE sp.id = sourcing_project_id
        AND sp.created_by = auth.uid()
    )
  );

-- Project creator can add collaborators
CREATE POLICY "Project creators can add collaborators"
  ON public.sourcing_project_collaborators
  FOR INSERT
  WITH CHECK (
    added_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sourcing_projects sp
      WHERE sp.id = sourcing_project_id
        AND sp.created_by = auth.uid()
    )
  );

-- Project creator can remove collaborators
CREATE POLICY "Project creators can remove collaborators"
  ON public.sourcing_project_collaborators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sourcing_projects sp
      WHERE sp.id = sourcing_project_id
        AND sp.created_by = auth.uid()
    )
  );

-- Update sourcing_projects SELECT policy to include collaborators
DROP POLICY IF EXISTS "Users can view own or public org projects" ON public.sourcing_projects;

CREATE POLICY "Users can view own, public, or collaborated projects"
  ON public.sourcing_projects
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR (is_public = true AND user_has_org_hierarchy_access(organization_id))
    OR get_user_type_secure() = 'platform_admin'
    OR EXISTS (
      SELECT 1 FROM public.sourcing_project_collaborators spc
      WHERE spc.sourcing_project_id = id
        AND spc.user_id = auth.uid()
    )
  );

-- Update sourcing_projects UPDATE policy to allow collaborators
DROP POLICY IF EXISTS "Users can update own projects" ON public.sourcing_projects;

CREATE POLICY "Users can update own or collaborated projects"
  ON public.sourcing_projects
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sourcing_project_collaborators spc
      WHERE spc.sourcing_project_id = id
        AND spc.user_id = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX idx_sourcing_project_collaborators_user ON public.sourcing_project_collaborators(user_id);
CREATE INDEX idx_sourcing_project_collaborators_project ON public.sourcing_project_collaborators(sourcing_project_id);
