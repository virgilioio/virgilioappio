ALTER TABLE public.reference_referees
  ADD COLUMN IF NOT EXISTS draft_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS pii_purge_at timestamptz;

ALTER TABLE public.reference_requests
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_reference_referees_token_hash ON public.reference_referees (token_hash);
CREATE INDEX IF NOT EXISTS idx_reference_requests_candidate_token_hash ON public.reference_requests (candidate_token_hash);