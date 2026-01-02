-- Add booking_link_sent_at column to job_candidate_associations
ALTER TABLE public.job_candidate_associations 
ADD COLUMN booking_link_sent_at TIMESTAMPTZ;

-- Add index for efficient querying
CREATE INDEX idx_jca_booking_link_sent 
ON public.job_candidate_associations(booking_link_sent_at) 
WHERE booking_link_sent_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.job_candidate_associations.booking_link_sent_at IS 
  'Timestamp when a booking link was last sent to this candidate for this job';

-- Backfill existing data: set booking_link_sent_at for candidates who received emails with booking links
UPDATE public.job_candidate_associations jca
SET booking_link_sent_at = el.sent_at
FROM public.email_logs el
WHERE el.candidate_id = jca.candidate_id
  AND el.job_id = jca.job_id
  AND el.status = 'sent'
  AND el.direction = 'sent'
  AND (el.body_html ILIKE '%gogio.io/schedule%' OR el.body_html ILIKE '%/schedule/%')
  AND jca.booking_link_sent_at IS NULL;