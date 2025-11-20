-- Add candidate_google_event_id column to scheduled_bookings table
ALTER TABLE scheduled_bookings 
ADD COLUMN candidate_google_event_id TEXT;

COMMENT ON COLUMN scheduled_bookings.candidate_google_event_id IS 
'Google Calendar event ID for the candidate''s separate calendar event (if invitation was sent)';

-- Update candidate_confirmation_status to support 'not_sent' value
-- (This is informational - the column already allows any text value)