-- =====================================================
-- SOURCING FOUNDATIONS MIGRATION
-- Tables: org_credit_usage, sourcing_events, external_candidate_matches
-- RPCs: get_org_credits, consume_sourcing_credits, refill_org_sourcing_credits
-- =====================================================

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Table: org_credit_usage (org-pooled monthly credits)
CREATE TABLE IF NOT EXISTS public.org_credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Search credits
  search_limit INTEGER NOT NULL DEFAULT 0,
  search_remaining INTEGER NOT NULL DEFAULT 0,
  
  -- Collect credits
  collect_limit INTEGER NOT NULL DEFAULT 0,
  collect_remaining INTEGER NOT NULL DEFAULT 0,
  
  -- Refill tracking
  last_refill_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_refill_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one record per organization
  UNIQUE(organization_id)
);

-- Table: sourcing_events (logs of all sourcing operations)
CREATE TABLE IF NOT EXISTS public.sourcing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('search', 'collect', 'import')),
  provider TEXT NOT NULL DEFAULT 'coresignal',
  
  -- Credits consumed
  credits_used INTEGER NOT NULL DEFAULT 0,
  credit_type TEXT NOT NULL CHECK (credit_type IN ('search', 'collect')),
  
  -- Event metadata
  query_params JSONB DEFAULT '{}'::jsonb,
  results_count INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Actor
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: external_candidate_matches (cached search results)
CREATE TABLE IF NOT EXISTS public.external_candidate_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- External provider data
  provider TEXT NOT NULL DEFAULT 'coresignal',
  provider_id TEXT NOT NULL, -- External unique ID from provider
  
  -- Candidate info (snapshot from search)
  candidate_name TEXT NOT NULL,
  current_title TEXT,
  current_company TEXT,
  location_city TEXT,
  location_country TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  
  -- Match metadata
  match_score NUMERIC(5,2),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Full provider response
  
  -- Collection status
  is_collected BOOLEAN NOT NULL DEFAULT false,
  collected_at TIMESTAMP WITH TIME ZONE,
  
  -- Link to internal candidate if imported
  internal_candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate imports from same provider
  UNIQUE(organization_id, provider, provider_id)
);

-- =====================================================
-- 2. CREATE INDEXES
-- =====================================================

-- org_credit_usage indexes
CREATE INDEX idx_org_credit_usage_org_id ON public.org_credit_usage(organization_id);
CREATE INDEX idx_org_credit_usage_next_refill ON public.org_credit_usage(next_refill_at);

-- sourcing_events indexes
CREATE INDEX idx_sourcing_events_org_id ON public.sourcing_events(organization_id);
CREATE INDEX idx_sourcing_events_job_id ON public.sourcing_events(job_id);
CREATE INDEX idx_sourcing_events_created_at ON public.sourcing_events(created_at DESC);
CREATE INDEX idx_sourcing_events_org_date ON public.sourcing_events(organization_id, created_at DESC);
CREATE INDEX idx_sourcing_events_type ON public.sourcing_events(event_type);

-- external_candidate_matches indexes
CREATE INDEX idx_external_matches_org_id ON public.external_candidate_matches(organization_id);
CREATE INDEX idx_external_matches_job_id ON public.external_candidate_matches(job_id);
CREATE INDEX idx_external_matches_provider_id ON public.external_candidate_matches(provider, provider_id);
CREATE INDEX idx_external_matches_collected ON public.external_candidate_matches(is_collected);
CREATE INDEX idx_external_matches_internal_id ON public.external_candidate_matches(internal_candidate_id);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.org_credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_candidate_matches ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. CREATE RLS POLICIES
-- =====================================================

-- org_credit_usage policies
CREATE POLICY "Platform admins can manage all credit usage"
  ON public.org_credit_usage
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Org members can view their org credit usage"
  ON public.org_credit_usage
  FOR SELECT
  USING (check_org_member_access(organization_id));

-- sourcing_events policies
CREATE POLICY "Platform admins can manage all sourcing events"
  ON public.sourcing_events
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Org members can view their org sourcing events"
  ON public.sourcing_events
  FOR SELECT
  USING (check_org_member_access(organization_id));

-- external_candidate_matches policies
CREATE POLICY "Platform admins can manage all external matches"
  ON public.external_candidate_matches
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Org members can view their org external matches"
  ON public.external_candidate_matches
  FOR SELECT
  USING (check_org_member_access(organization_id));

-- =====================================================
-- 5. CREATE RPCs (SECURITY DEFINER FUNCTIONS)
-- =====================================================

-- RPC: get_org_credits
-- Returns credit usage row for an organization
CREATE OR REPLACE FUNCTION public.get_org_credits(org_id UUID)
RETURNS TABLE (
  organization_id UUID,
  search_limit INTEGER,
  search_remaining INTEGER,
  collect_limit INTEGER,
  collect_remaining INTEGER,
  last_refill_at TIMESTAMP WITH TIME ZONE,
  next_refill_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow platform admins or org members to view credits
  IF get_user_type_secure() != 'platform_admin' AND NOT check_org_member_access(org_id) THEN
    RAISE EXCEPTION 'Unauthorized: You do not have access to this organization';
  END IF;

  RETURN QUERY
  SELECT 
    ocu.organization_id,
    ocu.search_limit,
    ocu.search_remaining,
    ocu.collect_limit,
    ocu.collect_remaining,
    ocu.last_refill_at,
    ocu.next_refill_at,
    ocu.created_at,
    ocu.updated_at
  FROM public.org_credit_usage ocu
  WHERE ocu.organization_id = org_id;
END;
$$;

-- RPC: consume_sourcing_credits
-- Atomically decrements credits if sufficient balance exists
CREATE OR REPLACE FUNCTION public.consume_sourcing_credits(
  org_id UUID,
  credit_type TEXT,
  amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  -- Validate credit_type
  IF credit_type NOT IN ('search', 'collect') THEN
    RAISE EXCEPTION 'Invalid credit_type: must be "search" or "collect"';
  END IF;

  -- Validate amount
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Atomically decrement the appropriate credit field if sufficient balance
  IF credit_type = 'search' THEN
    UPDATE public.org_credit_usage
    SET 
      search_remaining = search_remaining - amount,
      updated_at = now()
    WHERE 
      organization_id = org_id
      AND search_remaining >= amount;
  ELSE -- 'collect'
    UPDATE public.org_credit_usage
    SET 
      collect_remaining = collect_remaining - amount,
      updated_at = now()
    WHERE 
      organization_id = org_id
      AND collect_remaining >= amount;
  END IF;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  -- Return true if credits were consumed, false if insufficient balance
  RETURN rows_updated > 0;
END;
$$;

-- RPC: refill_org_sourcing_credits
-- Sets new limits and resets remaining credits; updates refill timestamps
CREATE OR REPLACE FUNCTION public.refill_org_sourcing_credits(
  org_id UUID,
  search_limit INT,
  collect_limit INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only platform admins can refill credits
  IF get_user_type_secure() != 'platform_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can refill credits';
  END IF;

  -- Upsert: insert or update credit usage
  INSERT INTO public.org_credit_usage (
    organization_id,
    search_limit,
    search_remaining,
    collect_limit,
    collect_remaining,
    last_refill_at,
    next_refill_at,
    updated_at
  ) VALUES (
    org_id,
    search_limit,
    search_limit, -- remaining = limit on refill
    collect_limit,
    collect_limit, -- remaining = limit on refill
    now(),
    now() + INTERVAL '30 days',
    now()
  )
  ON CONFLICT (organization_id)
  DO UPDATE SET
    search_limit = EXCLUDED.search_limit,
    search_remaining = EXCLUDED.search_limit, -- reset to new limit
    collect_limit = EXCLUDED.collect_limit,
    collect_remaining = EXCLUDED.collect_limit, -- reset to new limit
    last_refill_at = now(),
    next_refill_at = now() + INTERVAL '30 days',
    updated_at = now();
END;
$$;

-- =====================================================
-- 6. ADD AUDIT TRIGGER FOR updated_at
-- =====================================================

-- Trigger for org_credit_usage
CREATE TRIGGER set_org_credit_usage_updated_at
  BEFORE UPDATE ON public.org_credit_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_activities_updated_at();

-- Trigger for external_candidate_matches
CREATE TRIGGER set_external_matches_updated_at
  BEFORE UPDATE ON public.external_candidate_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_activities_updated_at();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE public.org_credit_usage IS 'Organization-pooled monthly sourcing credits (search + collect)';
COMMENT ON TABLE public.sourcing_events IS 'Audit log of all sourcing operations (search/collect/import)';
COMMENT ON TABLE public.external_candidate_matches IS 'Cached results from external candidate search providers';

COMMENT ON FUNCTION public.get_org_credits(UUID) IS 'Returns credit usage for an organization (org members + platform admins only)';
COMMENT ON FUNCTION public.consume_sourcing_credits(UUID, TEXT, INTEGER) IS 'Atomically consumes credits if sufficient balance exists (returns true/false)';
COMMENT ON FUNCTION public.refill_org_sourcing_credits(UUID, INTEGER, INTEGER) IS 'Refills organization credits and resets refill timestamps (platform admins only)';