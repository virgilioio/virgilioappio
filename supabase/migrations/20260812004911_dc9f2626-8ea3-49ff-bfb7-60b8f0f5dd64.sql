ALTER TABLE public.offer_approval_chains
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'sequential',
  ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '{"remind24h": true, "autoEscalate": false, "adminOverride": true, "notifyChain": true}'::jsonb;

ALTER TABLE public.offer_approval_chain_steps
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'always';

ALTER TABLE public.offer_approval_request_steps
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'always',
  ADD COLUMN IF NOT EXISTS skip_reason text;