-- Add custom_event_title column for generic booking links
ALTER TABLE booking_configurations
ADD COLUMN custom_event_title TEXT DEFAULT 'Interview with {candidate_name}';

-- Add comment for documentation
COMMENT ON COLUMN booking_configurations.custom_event_title IS 
  'Custom event title template for generic bookings. Use {candidate_name} as placeholder. Only used when booking is NOT job-specific.';