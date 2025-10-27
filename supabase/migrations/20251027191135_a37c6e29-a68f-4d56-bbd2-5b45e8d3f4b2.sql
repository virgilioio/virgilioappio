-- Create trigger to auto-set organization_id on insert (if not already exists)
CREATE OR REPLACE FUNCTION set_booking_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to get organization from job first
  IF NEW.job_id IS NOT NULL AND NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM jobs
    WHERE id = NEW.job_id;
  END IF;
  
  -- If still null, get from interviewer's active membership
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM members
    WHERE user_id = NEW.interviewer_id
    AND user_status = 'active'
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_booking_organization_id ON scheduled_bookings;
CREATE TRIGGER trigger_set_booking_organization_id
BEFORE INSERT ON scheduled_bookings
FOR EACH ROW
EXECUTE FUNCTION set_booking_organization_id();

-- Backfill organization_id where missing
UPDATE scheduled_bookings sb
SET organization_id = j.organization_id
FROM jobs j
WHERE sb.job_id = j.id
AND sb.organization_id IS NULL;

UPDATE scheduled_bookings sb
SET organization_id = m.organization_id
FROM members m
WHERE sb.interviewer_id = m.user_id
AND sb.organization_id IS NULL
AND m.user_status = 'active';