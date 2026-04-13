
-- Add PDL cache columns to sourcing_preview_candidates
ALTER TABLE public.sourcing_preview_candidates
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'apollo',
  ADD COLUMN IF NOT EXISTS pdl_id TEXT,
  ADD COLUMN IF NOT EXISTS skills JSONB,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS experience JSONB,
  ADD COLUMN IF NOT EXISTS education JSONB,
  ADD COLUMN IF NOT EXISTS certifications JSONB,
  ADD COLUMN IF NOT EXISTS emails JSONB,
  ADD COLUMN IF NOT EXISTS phones JSONB,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS job_title_levels JSONB,
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_state TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT;

-- Add PDL cache expiry to sourcing_projects (independent from Apollo cache)
ALTER TABLE public.sourcing_projects
  ADD COLUMN IF NOT EXISTS pdl_cache_expires_at TIMESTAMPTZ;

-- Index for efficient cache lookups by source
CREATE INDEX IF NOT EXISTS idx_sourcing_preview_candidates_source 
  ON public.sourcing_preview_candidates (sourcing_project_id, source);
