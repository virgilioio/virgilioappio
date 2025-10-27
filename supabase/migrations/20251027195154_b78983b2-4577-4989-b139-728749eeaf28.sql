-- Clean up incomplete test bookings with NULL foreign keys
DELETE FROM scheduled_bookings
WHERE interviewer_id IS NULL 
  OR candidate_id IS NULL 
  OR job_hiring_stage_id IS NULL;

-- Add NOT NULL constraints to prevent future incomplete bookings
ALTER TABLE scheduled_bookings
  ALTER COLUMN candidate_id SET NOT NULL,
  ALTER COLUMN interviewer_id SET NOT NULL,
  ALTER COLUMN job_hiring_stage_id SET NOT NULL;