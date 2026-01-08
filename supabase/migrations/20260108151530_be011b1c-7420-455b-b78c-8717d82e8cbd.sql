-- Create booking_link_tokens table for short URL tokens
CREATE TABLE public.booking_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(12) UNIQUE NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  jhs_id UUID REFERENCES public.job_hiring_stages(id) ON DELETE SET NULL,
  association_id UUID REFERENCES public.job_candidate_associations(id) ON DELETE CASCADE,
  candidate_name TEXT,
  candidate_email TEXT,
  job_title TEXT,
  stage_name TEXT,
  short_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
  created_by UUID
);

-- Index for fast token lookups
CREATE INDEX idx_booking_link_tokens_token ON public.booking_link_tokens(token);

-- Index for finding existing tokens for the same context
CREATE INDEX idx_booking_link_tokens_context ON public.booking_link_tokens(job_id, candidate_id, association_id, short_code);

-- Enable RLS
ALTER TABLE public.booking_link_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read tokens (needed for public booking page)
CREATE POLICY "Anyone can read booking tokens"
  ON public.booking_link_tokens FOR SELECT
  USING (true);

-- Policy: Authenticated users can create tokens
CREATE POLICY "Authenticated users can create tokens"
  ON public.booking_link_tokens FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comment explaining purpose
COMMENT ON TABLE public.booking_link_tokens IS 'Stores short URL tokens for booking links, mapping 8-character tokens to full booking context';