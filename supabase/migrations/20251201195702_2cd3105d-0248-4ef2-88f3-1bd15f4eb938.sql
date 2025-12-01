-- Add transcript ingest columns to scheduled_bookings
ALTER TABLE public.scheduled_bookings
ADD COLUMN IF NOT EXISTS transcript_ingest_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS transcript_ingest_email TEXT,
ADD COLUMN IF NOT EXISTS transcript_raw TEXT,
ADD COLUMN IF NOT EXISTS transcript_summary TEXT,
ADD COLUMN IF NOT EXISTS transcript_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS transcript_received_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS draft_scorecard_id UUID REFERENCES public.job_stage_scorecards(id);

-- Add AI draft columns to job_stage_scorecards
ALTER TABLE public.job_stage_scorecards
ADD COLUMN IF NOT EXISTS is_ai_draft BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS source_booking_id UUID REFERENCES public.scheduled_bookings(id),
ADD COLUMN IF NOT EXISTS ai_suggested_rating TEXT;

-- Create index for fast lookup by ingest code
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_transcript_ingest_code 
ON public.scheduled_bookings(transcript_ingest_code) 
WHERE transcript_ingest_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.scheduled_bookings.transcript_ingest_code IS 'Unique 8-character code for transcript email ingestion';
COMMENT ON COLUMN public.scheduled_bookings.transcript_ingest_email IS 'Magic email address for transcript ingestion (int_{code}@ingest.virgilio.io)';
COMMENT ON COLUMN public.scheduled_bookings.transcript_raw IS 'Raw transcript content received via email';
COMMENT ON COLUMN public.scheduled_bookings.transcript_summary IS 'AI-generated summary of the transcript';
COMMENT ON COLUMN public.job_stage_scorecards.is_ai_draft IS 'Whether this scorecard was auto-generated from transcript';
COMMENT ON COLUMN public.job_stage_scorecards.source_booking_id IS 'The booking that triggered AI scorecard generation';
COMMENT ON COLUMN public.job_stage_scorecards.ai_suggested_rating IS 'AI-suggested rating based on transcript analysis';