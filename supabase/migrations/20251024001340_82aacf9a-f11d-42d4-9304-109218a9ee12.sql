-- Phase 2: Make Sourcing Tables Read-Only (Temporary)
-- Remove INSERT/UPDATE/DELETE policies, keep SELECT for inspection

-- ========================================
-- 1. org_credit_usage: Make Read-Only
-- ========================================

-- Drop existing policies that allow writes
DROP POLICY IF EXISTS "Platform admins can manage org credits" ON public.org_credit_usage;
DROP POLICY IF EXISTS "Platform admins can refill credits" ON public.org_credit_usage;
DROP POLICY IF EXISTS "Org members can update credits" ON public.org_credit_usage;
DROP POLICY IF EXISTS "Service can update credits" ON public.org_credit_usage;

-- Keep/Create read-only policy for platform admins
DROP POLICY IF EXISTS "Platform admins can view org credits - READ ONLY" ON public.org_credit_usage;
CREATE POLICY "Platform admins can view org credits - READ ONLY"
  ON public.org_credit_usage
  FOR SELECT
  USING (get_user_type_secure() = 'platform_admin');

-- Keep/Create read-only policy for org members
DROP POLICY IF EXISTS "Org members can view their org credits - READ ONLY" ON public.org_credit_usage;
CREATE POLICY "Org members can view their org credits - READ ONLY"
  ON public.org_credit_usage
  FOR SELECT
  USING (check_org_member_access(organization_id));

-- ========================================
-- 2. external_candidate_matches: Make Read-Only
-- ========================================

-- Drop existing write policies
DROP POLICY IF EXISTS "Platform admins can manage all external matches" ON public.external_candidate_matches;
DROP POLICY IF EXISTS "Org recruiters can create external matches" ON public.external_candidate_matches;
DROP POLICY IF EXISTS "Org members can update external matches" ON public.external_candidate_matches;

-- Keep existing SELECT policy (already exists in schema)
-- "Org members can view their org external matches" - already in place

-- Ensure platform admins can still view
DROP POLICY IF EXISTS "Platform admins can view external matches - READ ONLY" ON public.external_candidate_matches;
CREATE POLICY "Platform admins can view external matches - READ ONLY"
  ON public.external_candidate_matches
  FOR SELECT
  USING (get_user_type_secure() = 'platform_admin');

-- ========================================
-- 3. sourcing_events: Make Read-Only
-- ========================================

-- Drop existing write policies
DROP POLICY IF EXISTS "Platform admins can manage sourcing events" ON public.sourcing_events;
DROP POLICY IF EXISTS "Service can insert sourcing events" ON public.sourcing_events;
DROP POLICY IF EXISTS "Edge functions can insert sourcing events" ON public.sourcing_events;

-- Create read-only policy for platform admins
DROP POLICY IF EXISTS "Platform admins can view sourcing events - READ ONLY" ON public.sourcing_events;
CREATE POLICY "Platform admins can view sourcing events - READ ONLY"
  ON public.sourcing_events
  FOR SELECT
  USING (get_user_type_secure() = 'platform_admin');

-- Create read-only policy for org members
DROP POLICY IF EXISTS "Org members can view their sourcing events - READ ONLY" ON public.sourcing_events;
CREATE POLICY "Org members can view their sourcing events - READ ONLY"
  ON public.sourcing_events
  FOR SELECT
  USING (check_org_member_access(organization_id));

-- ========================================
-- Verification Queries
-- ========================================

-- Add comments for documentation
COMMENT ON TABLE public.org_credit_usage IS 'READ-ONLY: Sourcing credits table - writes disabled during cleanup';
COMMENT ON TABLE public.external_candidate_matches IS 'READ-ONLY: External candidate matches - writes disabled during cleanup';
COMMENT ON TABLE public.sourcing_events IS 'READ-ONLY: Sourcing events log - writes disabled during cleanup';