-- Drop existing function and recreate with correct return type
DROP FUNCTION IF EXISTS public.accept_invitation(text, uuid);

-- Fix accept_invitation to use members table instead of invitations table
-- This matches the validate_invite_token function and send-invitation edge function
CREATE OR REPLACE FUNCTION public.accept_invitation(
  token_input TEXT,
  new_user_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT,
  member_id UUID,
  user_type TEXT,
  member_role TEXT,
  organization_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_user_exists BOOLEAN;
  v_profile_exists BOOLEAN;
  v_retry_count INT := 0;
  v_max_retries INT := 5;
BEGIN
  -- Validate inputs
  IF token_input IS NULL OR token_input = '' THEN
    RETURN QUERY SELECT false, 'Invalid invitation token'::text, NULL::uuid, NULL::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;
  
  IF new_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid user ID'::text, NULL::uuid, NULL::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  -- Find the member with this invite token (FROM MEMBERS TABLE - consistent with validate_invite_token)
  SELECT m.*, o.name as organization_name
  INTO v_member
  FROM members m
  JOIN organizations o ON o.id = m.organization_id
  WHERE m.invite_token = token_input::uuid
    AND m.user_status = 'invited'
    AND m.user_id IS NULL
    AND m.invite_expires_at > NOW()
  FOR UPDATE;  -- Lock row to prevent race conditions
    
  IF v_member IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid or expired invitation'::text, NULL::uuid, NULL::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  -- Wait for BOTH user AND profile to exist (profile is created by trigger)
  LOOP
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = new_user_id) INTO v_user_exists;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = new_user_id) INTO v_profile_exists;
    
    IF v_user_exists AND v_profile_exists THEN
      EXIT;
    END IF;
    
    v_retry_count := v_retry_count + 1;
    
    IF v_retry_count >= v_max_retries THEN
      IF NOT v_user_exists THEN
        RETURN QUERY SELECT false, 'User account not ready yet. Please try again.'::text, NULL::uuid, NULL::text, NULL::text, NULL::uuid;
      ELSE
        RETURN QUERY SELECT false, 'User profile not ready yet. Please try again.'::text, NULL::uuid, NULL::text, NULL::text, NULL::uuid;
      END IF;
      RETURN;
    END IF;
    
    PERFORM pg_sleep(0.2 * POWER(2, v_retry_count - 1));
  END LOOP;

  -- Update the member record
  UPDATE members
  SET 
    user_id = new_user_id,
    user_status = 'active',
    invite_token = NULL,
    invite_expires_at = NULL,
    updated_at = NOW()
  WHERE id = v_member.id;

  -- Return success with member details
  RETURN QUERY SELECT 
    true,
    'Invitation accepted successfully'::text,
    v_member.id,
    v_member.user_type::text,
    v_member.member_role::text,
    v_member.organization_id;
END;
$$;