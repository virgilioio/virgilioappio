-- Add tenant_type and signup_source to organizations table for better tenant classification
ALTER TABLE public.organizations 
ADD COLUMN tenant_type TEXT DEFAULT 'internal' CHECK (tenant_type IN ('saas', 'internal')),
ADD COLUMN signup_source TEXT DEFAULT 'manual' CHECK (signup_source IN ('self_serve', 'sales', 'invite', 'manual'));

-- Create stripe_event_log table for webhook idempotency
CREATE TABLE public.stripe_event_log (
  event_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tenant_metrics_daily for telemetry tracking
CREATE TABLE public.tenant_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  dau INTEGER DEFAULT 0,
  jobs_created INTEGER DEFAULT 0,
  candidates_added INTEGER DEFAULT 0,
  ai_requests INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, date)
);

-- Add subscription status and dunning fields to tenant_subscriptions
ALTER TABLE public.tenant_subscriptions 
ADD COLUMN subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'unpaid')),
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN current_period_start TIMESTAMPTZ,
ADD COLUMN current_period_end TIMESTAMPTZ,
ADD COLUMN cancel_at_period_end BOOLEAN DEFAULT false,
ADD COLUMN dunning_failed_payment_attempts INTEGER DEFAULT 0,
ADD COLUMN last_payment_failed_at TIMESTAMPTZ;

-- Enable RLS on new tables
ALTER TABLE public.stripe_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_metrics_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_event_log (platform admin only)
CREATE POLICY "Platform admins can manage stripe events" ON public.stripe_event_log
FOR ALL
USING (get_user_type_secure() = 'platform_admin');

-- RLS Policies for tenant_metrics_daily (platform admin only)
CREATE POLICY "Platform admins can view all tenant metrics" ON public.tenant_metrics_daily
FOR SELECT
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can manage tenant metrics" ON public.tenant_metrics_daily
FOR ALL
USING (get_user_type_secure() = 'platform_admin');

-- Create indexes for performance
CREATE INDEX idx_stripe_event_log_event_id ON public.stripe_event_log(event_id);
CREATE INDEX idx_stripe_event_log_type ON public.stripe_event_log(type);
CREATE INDEX idx_tenant_metrics_daily_tenant_date ON public.tenant_metrics_daily(tenant_id, date);
CREATE INDEX idx_organizations_tenant_type ON public.organizations(tenant_type);
CREATE INDEX idx_organizations_org_kind_tenant_type ON public.organizations(org_kind, tenant_type);
CREATE INDEX idx_tenant_subscriptions_stripe_customer_id ON public.tenant_subscriptions(stripe_customer_id);
CREATE INDEX idx_tenant_subscriptions_subscription_status ON public.tenant_subscriptions(subscription_status);

-- Backfill existing tenant organizations as SaaS customers
UPDATE public.organizations 
SET tenant_type = 'saas', signup_source = 'self_serve'
WHERE org_kind = 'tenant' AND parent_organization_id IS NULL;

-- Backfill existing client organizations under tenants as internal to the tenant
UPDATE public.organizations 
SET tenant_type = 'internal', signup_source = 'manual'
WHERE org_kind = 'client' AND parent_organization_id IS NOT NULL;