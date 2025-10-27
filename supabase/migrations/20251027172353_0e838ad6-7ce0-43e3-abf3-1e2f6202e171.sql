-- Add job_hiring_stage_id to scheduled_bookings for stage-specific tracking
ALTER TABLE scheduled_bookings 
  ADD COLUMN job_hiring_stage_id UUID REFERENCES job_hiring_stages(id);

CREATE INDEX idx_scheduled_bookings_stage ON scheduled_bookings(job_hiring_stage_id);

COMMENT ON COLUMN scheduled_bookings.job_hiring_stage_id IS 'Reference to the specific hiring stage this interview is for (enables stage-specific interview tracking)';

-- Add booked_by to track who scheduled the interview (for internal bookings)
ALTER TABLE scheduled_bookings 
  ADD COLUMN booked_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN scheduled_bookings.booked_by IS 'User who created the booking (null for candidate self-bookings, set for recruiter-initiated bookings)';