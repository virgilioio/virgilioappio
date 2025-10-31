-- Create CoreSignal Usage Tracking Table
CREATE TABLE public.coresignal_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- First day of month (e.g., '2025-10-01')
  
  -- Credit counters
  search_credits_used INTEGER NOT NULL DEFAULT 0,
  collect_credits_used INTEGER NOT NULL DEFAULT 0,
  
  -- Plan limits (stored for historical reference)
  search_credits_limit INTEGER NOT NULL DEFAULT 500,
  collect_credits_limit INTEGER NOT NULL DEFAULT 250,
  
  -- Metadata
  last_search_at TIMESTAMP WITH TIME ZONE,
  last_collect_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(organization_id, month)
);

CREATE INDEX idx_coresignal_usage_org_month ON public.coresignal_usage(organization_id, month DESC);

-- Enable RLS on coresignal_usage
ALTER TABLE public.coresignal_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coresignal_usage
CREATE POLICY "Org members can view their org's CoreSignal usage"
  ON public.coresignal_usage
  FOR SELECT
  USING (
    user_has_org_hierarchy_access(organization_id)
  );

CREATE POLICY "Platform admins can manage all CoreSignal usage"
  ON public.coresignal_usage
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- Extend sourcing_projects table
ALTER TABLE public.sourcing_projects
ADD COLUMN coresignal_search_id TEXT,
ADD COLUMN coresignal_last_searched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN coresignal_candidate_count INTEGER DEFAULT 0,
ADD COLUMN coresignal_cache_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_sourcing_projects_coresignal_cache ON public.sourcing_projects(coresignal_cache_expires_at);

-- Extend candidates table for CoreSignal source
ALTER TABLE public.candidates
ADD COLUMN coresignal_profile_id TEXT,
ADD COLUMN coresignal_search_score FLOAT,
ADD COLUMN coresignal_collected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN coresignal_headline TEXT,
ADD COLUMN coresignal_connections_count INTEGER;

CREATE INDEX idx_candidates_coresignal_profile ON public.candidates(coresignal_profile_id);
CREATE INDEX idx_candidates_source ON public.candidates(source);