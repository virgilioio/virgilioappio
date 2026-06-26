
ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'webhook',
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS details jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS stripe_webhook_events_event_id_unique
  ON public.stripe_webhook_events (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL AND stripe_event_id <> '';

CREATE INDEX IF NOT EXISTS stripe_webhook_events_customer_idx
  ON public.stripe_webhook_events (stripe_customer_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_source_idx
  ON public.stripe_webhook_events (source, processed_at DESC);
