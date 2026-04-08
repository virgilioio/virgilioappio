ALTER TABLE public.tenant_subscriptions
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

ALTER TABLE public.tenant_subscriptions
ADD COLUMN IF NOT EXISTS suspended_reason TEXT;