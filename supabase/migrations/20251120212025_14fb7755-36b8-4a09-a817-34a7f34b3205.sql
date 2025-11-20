-- Add sync tracking fields to scheduled_bookings table
ALTER TABLE scheduled_bookings
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_source TEXT CHECK (sync_source IN ('virgilio', 'google_calendar')),
ADD COLUMN IF NOT EXISTS sync_errors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS google_calendar_cancelled BOOLEAN DEFAULT FALSE;

-- Enable realtime for scheduled_bookings
ALTER TABLE scheduled_bookings REPLICA IDENTITY FULL;

-- Add to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'scheduled_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_bookings;
  END IF;
END$$;

-- Add index for sync queries
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_sync 
ON scheduled_bookings(interviewer_id, status) 
WHERE google_event_id IS NOT NULL;