-- Fix search path security warning for booking trigger function
CREATE OR REPLACE FUNCTION set_booking_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;