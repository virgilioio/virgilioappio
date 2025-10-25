-- Create stage_interviewer_assignments table
CREATE TABLE stage_interviewer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_hiring_stage_id UUID NOT NULL REFERENCES job_hiring_stages(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  assignment_type TEXT DEFAULT 'required' CHECK (assignment_type IN ('required', 'optional', 'backup')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_hiring_stage_id, member_id)
);

-- Indexes for performance
CREATE INDEX idx_stage_interviewer_assignments_jhs 
  ON stage_interviewer_assignments(job_hiring_stage_id);

CREATE INDEX idx_stage_interviewer_assignments_member 
  ON stage_interviewer_assignments(member_id);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_stage_interviewer_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stage_interviewer_assignments_updated_at
BEFORE UPDATE ON stage_interviewer_assignments
FOR EACH ROW
EXECUTE FUNCTION update_stage_interviewer_assignments_updated_at();

-- RLS Policies
ALTER TABLE stage_interviewer_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: View assignments for jobs in your org
CREATE POLICY "Org members can view stage interviewer assignments"
  ON stage_interviewer_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM job_hiring_stages jhs
      INNER JOIN jobs j ON jhs.job_id = j.id
      WHERE jhs.id = job_hiring_stage_id
      AND check_org_member_access(j.organization_id)
    )
  );

-- Policy: Manage assignments for jobs you can manage
CREATE POLICY "Org coordinators can manage stage interviewer assignments"
  ON stage_interviewer_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM job_hiring_stages jhs
      INNER JOIN jobs j ON jhs.job_id = j.id
      WHERE jhs.id = job_hiring_stage_id
      AND check_org_member_access(j.organization_id, 'recruiter'::member_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_hiring_stages jhs
      INNER JOIN jobs j ON jhs.job_id = j.id
      WHERE jhs.id = job_hiring_stage_id
      AND check_org_member_access(j.organization_id, 'recruiter'::member_role)
    )
  );

-- Platform admins can manage all
CREATE POLICY "Platform admins can manage all stage interviewer assignments"
  ON stage_interviewer_assignments FOR ALL
  USING (get_user_type_secure() = 'platform_admin');