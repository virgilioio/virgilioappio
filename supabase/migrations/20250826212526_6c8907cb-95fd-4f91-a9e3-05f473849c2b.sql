-- Fix the accept_invitation function to handle timing issues and foreign key constraints
CREATE OR REPLACE FUNCTION public.accept_invitation(token_input uuid, new_user_id uuid)
 RETURNS TABLE(success boolean, error_message text, member_id uuid, user_type text, member_role text, organization_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  member_record public.members%ROWTYPE;
  retry_count INTEGER := 0;
  max_retries INTEGER := 5;
  user_exists BOOLEAN := false;
  wait_seconds NUMERIC;
BEGIN
  -- Add logging for security monitoring
  RAISE LOG 'Accepting invitation for token: % by user: %', token_input, new_user_id;
  
  -- Get the member record for this token with row-level locking
  SELECT * INTO member_record 
  FROM public.members 
  WHERE invite_token = token_input 
    AND user_status = 'invited' 
    AND invite_expires_at > now()
    AND user_id IS NULL
  FOR UPDATE;  -- Prevent concurrent access
  
  IF NOT FOUND THEN
    RAISE LOG 'Invalid invitation acceptance attempt for token: %', token_input;
    RETURN QUERY SELECT false, 'Invalid or expired invitation'::text, null::uuid, null::text, null::text, null::uuid;
    RETURN;
  END IF;
  
  -- Retry loop to handle race condition with user creation
  WHILE retry_count < max_retries LOOP
    BEGIN
      -- Check if user exists in auth.users
      SELECT EXISTS(
        SELECT 1 FROM auth.users WHERE id = new_user_id
      ) INTO user_exists;
      
      IF NOT user_exists THEN
        -- Wait a bit for user creation to complete
        wait_seconds := 0.1 * POWER(2, retry_count); -- Exponential backoff: 0.1, 0.2, 0.4, 0.8, 1.6 seconds
        RAISE LOG 'User % not found in auth.users, waiting % seconds (attempt %/%)', new_user_id, wait_seconds, retry_count + 1, max_retries;
        PERFORM pg_sleep(wait_seconds);
        retry_count := retry_count + 1;
        CONTINUE;
      END IF;
      
      -- Try to update the member record
      UPDATE public.members 
      SET 
        user_id = new_user_id,
        user_status = 'active',
        invite_token = NULL,
        invite_expires_at = NULL,
        updated_at = now()
      WHERE id = member_record.id;
      
      -- If we get here, the update succeeded
      RAISE LOG 'Successfully accepted invitation for member: % on attempt %', member_record.id, retry_count + 1;
      RETURN QUERY SELECT 
        true, 
        'Invitation accepted successfully'::text, 
        member_record.id,
        member_record.user_type::text,
        member_record.member_role::text,
        member_record.organization_id;
      RETURN;
      
    EXCEPTION
      WHEN foreign_key_violation THEN
        retry_count := retry_count + 1;
        wait_seconds := 0.1 * POWER(2, retry_count - 1);
        
        RAISE LOG 'Foreign key constraint violation for user %, retrying in % seconds (attempt %/%)', new_user_id, wait_seconds, retry_count, max_retries;
        
        IF retry_count >= max_retries THEN
          RAISE LOG 'Max retries exceeded for invitation acceptance, user: %', new_user_id;
          RETURN QUERY SELECT false, 'User account not ready, please try again in a few seconds'::text, null::uuid, null::text, null::text, null::uuid;
          RETURN;
        END IF;
        
        PERFORM pg_sleep(wait_seconds);
    END;
  END LOOP;
  
  -- This shouldn't be reached, but just in case
  RETURN QUERY SELECT false, 'Unable to complete invitation acceptance after multiple attempts'::text, null::uuid, null::text, null::text, null::uuid;
END;
$function$;