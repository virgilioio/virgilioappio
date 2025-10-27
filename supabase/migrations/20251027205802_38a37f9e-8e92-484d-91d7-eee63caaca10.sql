-- =====================================================
-- Phase 1: Add Trial Management & Billing Status
-- =====================================================

-- Add new columns for trial and billing state management
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'trialing' 
    CHECK (billing_status IN ('trialing', 'active', 'past_due', 'canceled', 'locked')),
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_source TEXT DEFAULT 'self_signup',
  ADD COLUMN IF NOT EXISTS last_seat_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_tenant_subs_billing_status 
  ON public.tenant_subscriptions(billing_status);
  
CREATE INDEX IF NOT EXISTS idx_tenant_subs_trial_ends 
  ON public.tenant_subscriptions(trial_ends_at) 
  WHERE trial_ends_at IS NOT NULL;

-- Backfill existing rows with intelligent status detection
UPDATE public.tenant_subscriptions
SET 
  billing_status = CASE 
    WHEN stripe_subscription_id IS NOT NULL AND subscribed = true THEN 'active'
    WHEN stripe_subscription_id IS NULL AND (trial_end IS NULL OR trial_end > now()) THEN 'trialing'
    WHEN stripe_subscription_id IS NULL AND trial_end IS NOT NULL AND trial_end < now() THEN 'locked'
    ELSE 'locked'
  END,
  trial_started_at = COALESCE(trial_started_at, created_at),
  trial_ends_at = COALESCE(trial_ends_at, trial_end, created_at + INTERVAL '14 days'),
  last_seat_count = COALESCE(seat_quantity, 0),
  subscription_status = CASE 
    WHEN subscribed = true THEN 'active'
    ELSE NULL
  END
WHERE billing_status IS NULL;

-- Add comments
COMMENT ON COLUMN public.tenant_subscriptions.billing_status IS 
  'Primary billing state: trialing (14-day trial), active (paid), past_due (payment failed), canceled (ended), locked (trial expired, no payment)';

COMMENT ON COLUMN public.tenant_subscriptions.trial_started_at IS 
  'When the 14-day trial began (DB-managed, not Stripe trial)';

COMMENT ON COLUMN public.tenant_subscriptions.trial_ends_at IS 
  'When the 14-day trial ends. If now() > trial_ends_at AND no subscription, status becomes locked';

COMMENT ON COLUMN public.tenant_subscriptions.last_seat_count IS 
  'Snapshot of billable seat count at last subscription update. Used for reconciliation.';

COMMENT ON COLUMN public.tenant_subscriptions.subscription_status IS 
  'Mirror of Stripe subscription.status (active, past_due, canceled, etc). Updated by webhook.';

-- =====================================================
-- Helper Function: Check if Trial is Expired
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_trial_expired(tenant_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  trial_end TIMESTAMPTZ;
  has_subscription BOOLEAN;
BEGIN
  SELECT 
    ts.trial_ends_at,
    ts.stripe_subscription_id IS NOT NULL
  INTO trial_end, has_subscription
  FROM public.tenant_subscriptions ts
  WHERE ts.tenant_id = tenant_id_param;

  RETURN (trial_end IS NOT NULL AND trial_end < now() AND NOT has_subscription);
END;
$$;

COMMENT ON FUNCTION public.is_trial_expired IS 
  'Returns true if tenant trial has expired and they have no active Stripe subscription';

-- =====================================================
-- Update RLS Policies
-- =====================================================

DROP POLICY IF EXISTS "Workspace owners can view their tenant subscription" ON public.tenant_subscriptions;

CREATE POLICY "Workspace owners can view their tenant subscription"
ON public.tenant_subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.members m ON m.organization_id = o.id
    WHERE o.tenant_id = tenant_subscriptions.tenant_id
      AND m.user_id = auth.uid()
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
  OR get_user_type_secure() = 'platform_admin'
);

DROP POLICY IF EXISTS "Platform admins can update tenant subscriptions" ON public.tenant_subscriptions;

CREATE POLICY "Platform admins can update tenant subscriptions"
ON public.tenant_subscriptions
FOR UPDATE
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');