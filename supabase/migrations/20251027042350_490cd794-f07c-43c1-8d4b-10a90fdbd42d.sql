-- Add weekly_schedule column
ALTER TABLE booking_configurations 
ADD COLUMN IF NOT EXISTS weekly_schedule JSONB DEFAULT '{
  "monday": {"enabled": true, "start": "09:00", "end": "17:00"},
  "tuesday": {"enabled": true, "start": "09:00", "end": "17:00"},
  "wednesday": {"enabled": true, "start": "09:00", "end": "17:00"},
  "thursday": {"enabled": true, "start": "09:00", "end": "17:00"},
  "friday": {"enabled": true, "start": "09:00", "end": "17:00"},
  "saturday": {"enabled": false, "start": "09:00", "end": "17:00"},
  "sunday": {"enabled": false, "start": "09:00", "end": "17:00"}
}'::jsonb;

-- Migrate existing data from old columns to new weekly_schedule
UPDATE booking_configurations
SET weekly_schedule = jsonb_build_object(
  'monday', CASE WHEN 1 = ANY(available_days) THEN jsonb_build_object('enabled', true, 'start', start_time, 'end', end_time) ELSE jsonb_build_object('enabled', false, 'start', start_time, 'end', end_time) END,
  'tuesday', CASE WHEN 2 = ANY(available_days) THEN jsonb_build_object('enabled', true, 'start', start_time, 'end', end_time) ELSE jsonb_build_object('enabled', false, 'start', start_time, 'end', end_time) END,
  'wednesday', CASE WHEN 3 = ANY(available_days) THEN jsonb_build_object('enabled', true, 'start', start_time, 'end', end_time) ELSE jsonb_build_object('enabled', false, 'start', start_time, 'end', end_time) END,
  'thursday', CASE WHEN 4 = ANY(available_days) THEN jsonb_build_object('enabled', true, 'start', start_time, 'end', end_time) ELSE jsonb_build_object('enabled', false, 'start', start_time, 'end', end_time) END,
  'friday', CASE WHEN 5 = ANY(available_days) THEN jsonb_build_object('enabled', true, 'start', start_time, 'end', end_time) ELSE jsonb_build_object('enabled', false, 'start', start_time, 'end', end_time) END,
  'saturday', CASE WHEN 6 = ANY(available_days) THEN jsonb_build_object('enabled', true, 'start', start_time, 'end', end_time) ELSE jsonb_build_object('enabled', false, 'start', start_time, 'end', end_time) END,
  'sunday', CASE WHEN 0 = ANY(available_days) THEN jsonb_build_object('enabled', true, 'start', start_time, 'end', end_time) ELSE jsonb_build_object('enabled', false, 'start', start_time, 'end', end_time) END
)
WHERE weekly_schedule IS NULL OR weekly_schedule = '{}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN booking_configurations.weekly_schedule IS 
'Weekly availability schedule in format: {"monday": {"enabled": true, "start": "09:00", "end": "17:00"}, ...}';

-- Keep old columns for backward compatibility (can drop in future migration after verification)