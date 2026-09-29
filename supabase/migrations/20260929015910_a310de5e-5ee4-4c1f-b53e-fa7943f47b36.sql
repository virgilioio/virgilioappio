ALTER TABLE public.job_pipeline_shares
  ADD COLUMN IF NOT EXISTS share_application boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_offers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_hired boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_rejected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_reject_reason boolean NOT NULL DEFAULT false;

ALTER TABLE public.rejection_reasons
  ADD COLUMN IF NOT EXISTS client_label text;

COMMENT ON COLUMN public.rejection_reasons.client_label IS 'Optional client-safe label used only in shared pipeline views; internal reason names and notes remain private.';