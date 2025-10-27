-- Add confirmation status fields to scheduled_bookings
ALTER TABLE scheduled_bookings
  ADD COLUMN interviewer_confirmation_status TEXT DEFAULT 'pending' 
    CHECK (interviewer_confirmation_status IN ('pending', 'confirmed', 'declined')),
  ADD COLUMN candidate_confirmation_status TEXT DEFAULT 'pending'
    CHECK (candidate_confirmation_status IN ('pending', 'confirmed', 'declined')),
  ADD COLUMN interviewer_confirmed_at TIMESTAMPTZ,
  ADD COLUMN candidate_confirmed_at TIMESTAMPTZ;

-- Create indexes for filtering by confirmation status
CREATE INDEX idx_scheduled_bookings_interviewer_confirmation 
  ON scheduled_bookings(interviewer_confirmation_status);
CREATE INDEX idx_scheduled_bookings_candidate_confirmation 
  ON scheduled_bookings(candidate_confirmation_status);

-- Add comments for documentation
COMMENT ON COLUMN scheduled_bookings.interviewer_confirmation_status IS 
  'Interviewer acceptance status: pending (awaiting response), confirmed (accepted), declined (rejected)';
COMMENT ON COLUMN scheduled_bookings.candidate_confirmation_status IS 
  'Candidate acceptance status: pending (awaiting response), confirmed (accepted), declined (rejected)';