-- Fix NULL interviewer_ids in scheduled_bookings
-- This migration attempts to backfill missing interviewer_ids and adds safeguards

-- Step 1: Create function to find fallback interviewer_id
CREATE OR REPLACE FUNCTION get_fallback_interviewer_id(booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_interviewer_id uuid;
  stage_member uuid;
  booking_config_user uuid;
BEGIN
  -- Try to get from stage_interviewer_assignments if stage is available
  SELECT sia.member_id INTO stage_member
  FROM scheduled_bookings sb
  JOIN stage_interviewer_assignments sia ON sia.job_hiring_stage_id = sb.job_hiring_stage_id
  WHERE sb.id = booking_id
  LIMIT 1;
  
  IF stage_member IS NOT NULL THEN
    RETURN stage_member;
  END IF;
  
  -- Try to get from booking_configurations if we can infer which config was used
  SELECT bc.user_id INTO booking_config_user
  FROM scheduled_bookings sb
  JOIN booking_configurations bc ON bc.organization_id = sb.organization_id
  WHERE sb.id = booking_id
  LIMIT 1;
  
  IF booking_config_user IS NOT NULL THEN
    RETURN booking_config_user;
  END IF;
  
  -- If no interviewer found, return NULL (will need manual assignment)
  RETURN NULL;
END;
$$;

-- Step 2: Update bookings with NULL interviewer_id
UPDATE scheduled_bookings
SET 
  interviewer_id = get_fallback_interviewer_id(id),
  updated_at = NOW()
WHERE interviewer_id IS NULL;

-- Step 3: Log bookings that still have NULL interviewer_id for manual review
DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM scheduled_bookings
  WHERE interviewer_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE NOTICE 'Warning: % bookings still have NULL interviewer_id and need manual assignment', null_count;
  ELSE
    RAISE NOTICE 'Success: All bookings now have interviewer_id assigned';
  END IF;
END $$;