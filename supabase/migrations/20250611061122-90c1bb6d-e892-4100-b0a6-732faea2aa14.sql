
-- Drop the existing function first
DROP FUNCTION IF EXISTS public.accept_invitation(uuid, uuid);

-- Create the new function with the complete return type
CREATE OR REPLACE FUNCTION public.accept_invitation(token_input uuid, new_user_id uuid)
 RETURNS TABLE(success boolean, error_message text, member_id uuid, user_type text, member_role text, organization_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  member_record public.members%ROWTYPE;
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
  
  -- Update the member record
  UPDATE public.members 
  SET 
    user_id = new_user_id,
    user_status = 'active',
    invite_token = NULL,
    invite_expires_at = NULL,
    updated_at = now()
  WHERE id = member_record.id;
  
  RAISE LOG 'Successfully accepted invitation for member: %', member_record.id;
  RETURN QUERY SELECT 
    true, 
    'Invitation accepted successfully'::text, 
    member_record.id,
    member_record.user_type::text,
    member_record.member_role::text,
    member_record.organization_id;
END;
$function$
