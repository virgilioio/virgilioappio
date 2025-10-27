-- Add missing fields to scheduled_bookings table for Phase 4 completion
ALTER TABLE scheduled_bookings
  ADD COLUMN interviewer_id UUID REFERENCES auth.users(id),
  ADD COLUMN organization_id UUID REFERENCES organizations(id),
  ADD COLUMN duration_minutes INTEGER,
  ADD COLUMN meeting_location TEXT,
  ADD COLUMN meeting_type TEXT,
  ADD COLUMN ics_uid TEXT UNIQUE,
  ADD COLUMN candidate_id UUID REFERENCES candidates(id),
  ADD COLUMN job_id UUID REFERENCES jobs(id),
  ADD COLUMN job_candidate_association_id UUID REFERENCES job_candidate_associations(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_interviewer ON scheduled_bookings(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_org ON scheduled_bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_candidate ON scheduled_bookings(candidate_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_job ON scheduled_bookings(job_id);

-- Update RLS policies for the new fields
CREATE POLICY "Interviewers can view own bookings"
  ON scheduled_bookings FOR SELECT
  USING (interviewer_id = auth.uid());

CREATE POLICY "Org members can view org bookings"
  ON scheduled_bookings FOR SELECT
  USING (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
      AND m.organization_id = scheduled_bookings.organization_id
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Interviewers can update own bookings"
  ON scheduled_bookings FOR UPDATE
  USING (interviewer_id = auth.uid());

-- Add comment for documentation
COMMENT ON COLUMN scheduled_bookings.ics_uid IS 'Unique ICS identifier for calendar event tracking, format: booking-{uuid}@virgilio.io';