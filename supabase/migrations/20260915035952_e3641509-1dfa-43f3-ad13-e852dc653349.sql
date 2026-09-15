ALTER TABLE public.scheduled_bookings
  ADD COLUMN IF NOT EXISTS transcript_source_message_id text,
  ADD COLUMN IF NOT EXISTS transcript_notified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_bookings_transcript_source_message_id_key
  ON public.scheduled_bookings (transcript_source_message_id)
  WHERE transcript_source_message_id IS NOT NULL;