-- Create trigger function to log member activation activity
CREATE OR REPLACE FUNCTION public.log_member_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- Only log when status changes to 'active' and user_id is set
  IF NEW.user_status = 'active' AND NEW.user_id IS NOT NULL AND 
     (OLD.user_status IS DISTINCT FROM 'active' OR OLD.user_id IS NULL) THEN
    
    -- Get user details from auth.users
    SELECT 
      email,
      COALESCE(
        raw_user_meta_data->>'first_name' || ' ' || raw_user_meta_data->>'last_name',
        email
      )
    INTO v_user_email, v_user_name
    FROM auth.users
    WHERE id = NEW.user_id;
    
    -- Insert activity log
    INSERT INTO public.activities (
      user_id,
      organization_id,
      tenant_id,
      activity_type,
      title,
      description,
      metadata,
      entity_type,
      entity_id
    ) VALUES (
      NEW.user_id,
      NEW.organization_id,
      NEW.tenant_id,
      'member_activated',
      'Team member joined: ' || COALESCE(v_user_name, v_user_email),
      'New team member accepted invitation and joined',
      jsonb_build_object(
        'role', NEW.member_role,
        'user_type', NEW.user_type,
        'email', v_user_email
      ),
      'member',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on members table
DROP TRIGGER IF EXISTS trg_log_member_activation ON public.members;
CREATE TRIGGER trg_log_member_activation
  AFTER INSERT OR UPDATE OF user_status, user_id ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_member_activation();

COMMENT ON FUNCTION public.log_member_activation() IS 'Automatically logs an activity when a member accepts an invitation and becomes active';