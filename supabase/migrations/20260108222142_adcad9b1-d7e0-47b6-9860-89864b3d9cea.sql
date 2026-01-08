-- Fix accept_invitation to wait for profiles table before updating member
-- This fixes the race condition where the member update fails because
-- the profile record (created by trigger) doesn't exist yet

CREATE OR REPLACE FUNCTION public.accept_invitation(
  invite_token TEXT,
  new_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_member RECORD;
  v_user_exists BOOLEAN;
  v_profile_exists BOOLEAN;
  v_retry_count INT := 0;
  v_max_retries INT := 5;
  v_result jsonb;
BEGIN
  -- Validate inputs
  IF invite_token IS NULL OR invite_token = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation token');
  END IF;
  
  IF new_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid user ID');
  END IF;

  -- Find the invitation
  SELECT i.*, o.name as organization_name
  INTO v_invitation
  FROM invitations i
  JOIN organizations o ON o.id = i.organization_id
  WHERE i.invite_token = accept_invitation.invite_token
    AND i.used_at IS NULL
    AND i.invite_expires_at > NOW();
    
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Wait for BOTH user AND profile to exist (profile is created by trigger)
  LOOP
    -- Check if user exists in auth.users
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = new_user_id) INTO v_user_exists;
    
    -- Check if profile exists (created by handle_new_user trigger)
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = new_user_id) INTO v_profile_exists;
    
    -- Exit if both exist
    IF v_user_exists AND v_profile_exists THEN
      EXIT;
    END IF;
    
    v_retry_count := v_retry_count + 1;
    
    IF v_retry_count >= v_max_retries THEN
      IF NOT v_user_exists THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'User account not ready yet. Please try again.',
          'retry', true,
          'detail', 'auth.users record not found after retries'
        );
      ELSE
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'User profile not ready yet. Please try again.',
          'retry', true,
          'detail', 'profiles record not found after retries'
        );
      END IF;
    END IF;
    
    -- Exponential backoff: 0.2s, 0.4s, 0.8s, 1.6s, 3.2s
    PERFORM pg_sleep(0.2 * POWER(2, v_retry_count - 1));
  END LOOP;

  -- Find existing member record for this invitation
  SELECT * INTO v_member
  FROM members
  WHERE organization_id = v_invitation.organization_id
    AND email = v_invitation.email
    AND user_id IS NULL;
    
  IF v_member IS NULL THEN
    -- No pending member record found, create one
    INSERT INTO members (
      organization_id,
      user_id,
      email,
      role,
      user_type,
      joined_at
    ) VALUES (
      v_invitation.organization_id,
      new_user_id,
      v_invitation.email,
      v_invitation.member_role,
      'organization_user',
      NOW()
    );
  ELSE
    -- Update existing member record with user_id
    UPDATE members
    SET user_id = new_user_id,
        joined_at = NOW(),
        updated_at = NOW()
    WHERE id = v_member.id;
  END IF;

  -- Mark invitation as used
  UPDATE invitations
  SET used_at = NOW(),
      updated_at = NOW()
  WHERE id = v_invitation.id;

  -- Return success with organization info
  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'organization_name', v_invitation.organization_name,
    'role', v_invitation.member_role
  );

EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'User profile not ready yet. Please try again.',
      'retry', true,
      'detail', 'Foreign key violation - profile may not exist yet'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Database error: ' || SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;