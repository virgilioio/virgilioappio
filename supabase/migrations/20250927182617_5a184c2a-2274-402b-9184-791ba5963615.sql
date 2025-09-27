-- Add performance indexes for jobs, candidates, and organizations
-- These indexes will significantly improve query performance

-- Jobs table indexes
CREATE INDEX IF NOT EXISTS idx_jobs_organization_status ON public.jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON public.jobs(created_by);

-- Members table indexes for role lookups
CREATE INDEX IF NOT EXISTS idx_members_user_org ON public.members(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_members_org_role_status ON public.members(organization_id, member_role, user_status);

-- Job candidate associations indexes
CREATE INDEX IF NOT EXISTS idx_job_candidate_associations_job_created ON public.job_candidate_associations(job_id, created_at);

-- Candidates table indexes
CREATE INDEX IF NOT EXISTS idx_candidates_name_location ON public.candidates(candidate_name, location_country, location_city);

-- Organizations table indexes
CREATE INDEX IF NOT EXISTS idx_organizations_signup_source ON public.organizations(signup_source);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON public.organizations(organization_type);

-- Job assignments indexes
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_user ON public.job_assignments(job_id, user_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_user ON public.job_assignments(user_id);