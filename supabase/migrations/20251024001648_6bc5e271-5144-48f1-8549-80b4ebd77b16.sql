-- Fix RLS on Archive Tables
-- Enable RLS on archive tables (no policies needed - backup only)

-- Enable RLS on all archive tables
ALTER TABLE public._archived_org_credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._archived_sourcing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._archived_external_candidate_matches ENABLE ROW LEVEL SECURITY;

-- Add platform admin SELECT-only policies for inspection
CREATE POLICY "Platform admins can view archived org credits"
  ON public._archived_org_credit_usage
  FOR SELECT
  USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can view archived sourcing events"
  ON public._archived_sourcing_events
  FOR SELECT
  USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can view archived external matches"
  ON public._archived_external_candidate_matches
  FOR SELECT
  USING (get_user_type_secure() = 'platform_admin');