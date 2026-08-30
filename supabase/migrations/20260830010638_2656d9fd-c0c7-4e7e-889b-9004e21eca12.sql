ALTER TABLE public.reference_requests
  ADD COLUMN IF NOT EXISTS share_token_hash text,
  ADD COLUMN IF NOT EXISTS share_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS share_created_by uuid;

CREATE INDEX IF NOT EXISTS reference_requests_share_token_hash_idx
  ON public.reference_requests (share_token_hash)
  WHERE share_token_hash IS NOT NULL;