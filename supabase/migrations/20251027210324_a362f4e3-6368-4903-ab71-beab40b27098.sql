-- =====================================================
-- Phase 2.1: Trial Auto-Initialization Trigger
-- =====================================================

-- Trigger function to initialize 14-day trial on INSERT
CREATE OR REPLACE FUNCTION public.init_trial_on_tenant_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only initialize if trial fields are NULL (allow explicit overrides)
  IF NEW.trial_started_at IS NULL THEN
    NEW.trial_started_at := now();
    NEW.trial_ends_at := now() + INTERVAL '14 days';
    NEW.trial_source := COALESCE(NEW.trial_source, 'self_signup');
    NEW.billing_status := 'trialing';
    
    RAISE LOG 'Trial initialized for tenant %: ends at %', 
      NEW.tenant_id, NEW.trial_ends_at;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.init_trial_on_tenant_subscription IS 
  'Auto-initialize 14-day trial when tenant_subscriptions row is created';

-- Create trigger (BEFORE INSERT to modify NEW before write)
DROP TRIGGER IF EXISTS trigger_init_trial ON public.tenant_subscriptions;

CREATE TRIGGER trigger_init_trial
  BEFORE INSERT ON public.tenant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.init_trial_on_tenant_subscription();

-- Backfill NULL trial dates for existing 'trialing' rows
UPDATE public.tenant_subscriptions
SET 
  trial_started_at = COALESCE(trial_started_at, created_at),
  trial_ends_at = COALESCE(trial_ends_at, created_at + INTERVAL '14 days'),
  trial_source = COALESCE(trial_source, 'self_signup')
WHERE billing_status = 'trialing' 
  AND trial_ends_at IS NULL;

-- Log results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.tenant_subscriptions
  WHERE billing_status = 'trialing' AND trial_ends_at IS NOT NULL;
  
  RAISE NOTICE 'Backfilled % trialing tenant(s) with trial dates', updated_count;
END $$;