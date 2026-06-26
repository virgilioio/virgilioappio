
-- 1. Extend billing_status to allow 'fraud_review'
ALTER TABLE public.tenant_subscriptions
  DROP CONSTRAINT IF EXISTS tenant_subscriptions_billing_status_check;

ALTER TABLE public.tenant_subscriptions
  ADD CONSTRAINT tenant_subscriptions_billing_status_check
  CHECK (billing_status = ANY (ARRAY[
    'trialing'::text,
    'active'::text,
    'past_due'::text,
    'canceled'::text,
    'locked'::text,
    'fraud_review'::text
  ]));

-- 2. tenant_fraud_signals table
CREATE TABLE IF NOT EXISTS public.tenant_fraud_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  signal_type text NOT NULL CHECK (signal_type IN ('early_fraud_warning', 'dispute', 'manual_flag', 'refunded')),
  stripe_event_id text,
  stripe_charge_id text,
  stripe_dispute_id text,
  stripe_customer_id text,
  fraud_type text,
  amount_cents integer,
  currency text,
  action_taken text CHECK (action_taken IN ('refunded', 'disputed', 'suspended', 'cancelled_subscription', 'none', 'flagged')),
  resolved_at timestamptz,
  resolved_by uuid,
  notes text,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_fraud_signals_tenant ON public.tenant_fraud_signals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_fraud_signals_stripe_event ON public.tenant_fraud_signals(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_tenant_fraud_signals_unresolved ON public.tenant_fraud_signals(tenant_id) WHERE resolved_at IS NULL;

GRANT SELECT ON public.tenant_fraud_signals TO authenticated;
GRANT ALL ON public.tenant_fraud_signals TO service_role;

ALTER TABLE public.tenant_fraud_signals ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read fraud signals
CREATE POLICY "Platform admins read fraud signals"
  ON public.tenant_fraud_signals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.user_type = 'platform_admin'
        AND m.user_status = 'active'
    )
  );

-- Only platform admins can update fraud signals (resolve / annotate)
CREATE POLICY "Platform admins update fraud signals"
  ON public.tenant_fraud_signals
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.user_type = 'platform_admin'
        AND m.user_status = 'active'
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tenant_fraud_signals_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_fraud_signals_updated_at ON public.tenant_fraud_signals;
CREATE TRIGGER trg_tenant_fraud_signals_updated_at
  BEFORE UPDATE ON public.tenant_fraud_signals
  FOR EACH ROW EXECUTE FUNCTION public.tenant_fraud_signals_set_updated_at();
