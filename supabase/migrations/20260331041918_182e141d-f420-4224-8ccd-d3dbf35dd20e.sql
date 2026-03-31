
-- Add missing indexes on high-traffic foreign keys (IF NOT EXISTS to be safe)
CREATE INDEX IF NOT EXISTS idx_job_candidate_associations_candidate_id ON public.job_candidate_associations (candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_candidate_associations_job_id ON public.job_candidate_associations (job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_organization_id ON public.candidates (organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id ON public.jobs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members (user_id);
CREATE INDEX IF NOT EXISTS idx_members_organization_id ON public.members (organization_id);
CREATE INDEX IF NOT EXISTS idx_members_user_org ON public.members (user_id, organization_id);
