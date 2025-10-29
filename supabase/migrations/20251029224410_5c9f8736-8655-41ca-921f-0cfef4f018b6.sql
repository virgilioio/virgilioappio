-- Create sourcing_projects table for persistent sourcing workspace
-- This allows users to save and return to talent search projects

CREATE TABLE sourcing_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  -- Project metadata
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  -- Search criteria (flexible JSON for complex filters)
  search_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Source configuration (future-ready for external APIs)
  enabled_sources JSONB NOT NULL DEFAULT '["internal"]'::jsonb,

  -- Stats
  total_candidates INTEGER DEFAULT 0,
  last_search_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sourcing_projects_org ON sourcing_projects(organization_id);
CREATE INDEX idx_sourcing_projects_created_by ON sourcing_projects(created_by);
CREATE INDEX idx_sourcing_projects_job ON sourcing_projects(job_id);
CREATE INDEX idx_sourcing_projects_status ON sourcing_projects(status);
CREATE INDEX idx_sourcing_projects_updated_at ON sourcing_projects(updated_at DESC);

-- Enable RLS
ALTER TABLE sourcing_projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Org members can view projects"
  ON sourcing_projects FOR SELECT
  USING (check_org_member_access(organization_id));

CREATE POLICY "Recruiters can create projects"
  ON sourcing_projects FOR INSERT
  WITH CHECK (
    check_org_member_access(organization_id, 'recruiter'::member_role)
    AND created_by = auth.uid()
  );

CREATE POLICY "Creators can update their projects"
  ON sourcing_projects FOR UPDATE
  USING (
    check_org_member_access(organization_id, 'recruiter'::member_role)
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can delete projects"
  ON sourcing_projects FOR DELETE
  USING (check_org_member_access(organization_id, 'admin'::member_role));

CREATE POLICY "Platform admins full access"
  ON sourcing_projects FOR ALL
  USING (get_user_type_secure() = 'platform_admin');