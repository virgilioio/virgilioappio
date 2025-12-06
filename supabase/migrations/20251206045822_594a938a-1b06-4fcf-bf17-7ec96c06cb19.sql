-- Phase 1: Create trigger function for automatic sync
CREATE OR REPLACE FUNCTION public.sync_booking_config_active_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Calendar connected → activate booking link
    UPDATE public.booking_configurations
    SET is_active = true, updated_at = now()
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Check if user has any other active calendars
    IF NOT EXISTS (
      SELECT 1 FROM public.calendar_identities 
      WHERE user_id = OLD.user_id AND is_active = true
    ) THEN
      UPDATE public.booking_configurations
      SET is_active = false, updated_at = now()
      WHERE user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    -- Calendar active status changed
    IF NEW.is_active = true THEN
      -- Calendar reactivated → activate booking link
      UPDATE public.booking_configurations
      SET is_active = true, updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSE
      -- Calendar deactivated → check if user has other active calendars
      IF NOT EXISTS (
        SELECT 1 FROM public.calendar_identities 
        WHERE user_id = NEW.user_id AND id != NEW.id AND is_active = true
      ) THEN
        UPDATE public.booking_configurations
        SET is_active = false, updated_at = now()
        WHERE user_id = NEW.user_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on calendar_identities
DROP TRIGGER IF EXISTS trg_sync_booking_config_on_calendar_change ON public.calendar_identities;
CREATE TRIGGER trg_sync_booking_config_on_calendar_change
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_identities
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_config_active_status();

-- Phase 2: Backfill existing affected users
-- Activate booking configs for users who have active calendars but inactive booking links
UPDATE public.booking_configurations bc
SET is_active = true, updated_at = now()
WHERE bc.is_active = false
AND EXISTS (
  SELECT 1 FROM public.calendar_identities ci 
  WHERE ci.user_id = bc.user_id AND ci.is_active = true
);

-- Also deactivate booking configs for users who have no active calendars but active booking links
UPDATE public.booking_configurations bc
SET is_active = false, updated_at = now()
WHERE bc.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM public.calendar_identities ci 
  WHERE ci.user_id = bc.user_id AND ci.is_active = true
);