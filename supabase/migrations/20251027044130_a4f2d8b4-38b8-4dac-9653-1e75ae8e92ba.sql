-- Create scheduled_bookings table
CREATE TABLE IF NOT EXISTS scheduled_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_config_id UUID NOT NULL REFERENCES booking_configurations(id) ON DELETE CASCADE,
  
  -- Candidate information
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  candidate_phone TEXT,
  candidate_timezone TEXT NOT NULL,
  notes TEXT,
  
  -- Scheduling details
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  
  -- Google Calendar event ID (for future cancellations/updates)
  google_event_id TEXT,
  google_meet_link TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_config ON scheduled_bookings(booking_config_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_email ON scheduled_bookings(candidate_email);
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_start ON scheduled_bookings(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_status ON scheduled_bookings(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_config_status_start 
  ON scheduled_bookings(booking_config_id, status, scheduled_start) 
  WHERE status = 'confirmed';

-- Enable RLS
ALTER TABLE scheduled_bookings ENABLE ROW LEVEL SECURITY;

-- Booking config owners can view their bookings
CREATE POLICY "Users can view own bookings"
  ON scheduled_bookings FOR SELECT
  USING (
    booking_config_id IN (
      SELECT id FROM booking_configurations WHERE user_id = auth.uid()
    )
  );

-- Public can insert bookings (for public booking page)
CREATE POLICY "Anyone can create bookings"
  ON scheduled_bookings FOR INSERT
  WITH CHECK (true);

-- Only booking owner can update/cancel
CREATE POLICY "Users can update own bookings"
  ON scheduled_bookings FOR UPDATE
  USING (
    booking_config_id IN (
      SELECT id FROM booking_configurations WHERE user_id = auth.uid()
    )
  );

-- Platform admins can manage all bookings
CREATE POLICY "Platform admins can manage all bookings"
  ON scheduled_bookings FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- Create handle_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_scheduled_bookings_updated_at ON scheduled_bookings;
CREATE TRIGGER update_scheduled_bookings_updated_at
  BEFORE UPDATE ON scheduled_bookings
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Comments
COMMENT ON TABLE scheduled_bookings IS 'Stores confirmed candidate interview bookings';
COMMENT ON COLUMN scheduled_bookings.status IS 'Booking status: confirmed (active), cancelled (by either party), completed (meeting finished), no_show (candidate did not attend)';
COMMENT ON COLUMN scheduled_bookings.google_event_id IS 'Google Calendar event ID for syncing changes';