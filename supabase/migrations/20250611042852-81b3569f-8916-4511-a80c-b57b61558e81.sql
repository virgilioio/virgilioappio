
-- Apply critical security migration for invite tokens (Part 1)
ALTER TABLE public.members 
ADD CONSTRAINT unique_invite_token UNIQUE (invite_token);

-- Clean up legacy invited records with NULL tokens by regenerating them
UPDATE public.members 
SET 
  invite_token = gen_random_uuid(),
  invite_expires_at = now() + interval '7 days',
  updated_at = now()
WHERE user_status = 'invited' 
  AND invite_token IS NULL;

-- Enhanced logging and security for invite validation
CREATE OR REPLACE FUNCTION public.validate_invite_token(token_input uuid)
RETURNS TABLE(
  member_id uuid,
  organization_id uuid,
  member_role text,
  organization_name text,
  is_valid boolean,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add logging for security monitoring
  RAISE LOG 'Validating invite token: %', token_input;
  
  RETURN QUERY
  SELECT 
    m.id as member_id,
    m.organization_id,
    m.member_role::text,
    o.name as organization_name,
    CASE 
      WHEN m.id IS NULL THEN false
      WHEN m.user_status != 'invited' THEN false
      WHEN m.invite_expires_at < now() THEN false
      WHEN m.user_id IS NOT NULL THEN false
      ELSE true
    END as is_valid,
    CASE 
      WHEN m.id IS NULL THEN 'Invalid or expired invitation token'
      WHEN m.user_status != 'invited' THEN 'Invitation has already been accepted'
      WHEN m.invite_expires_at < now() THEN 'Invitation has expired'
      WHEN m.user_id IS NOT NULL THEN 'Invitation has already been used'
      ELSE 'Valid invitation'
    END as error_message
  FROM public.members m
  LEFT JOIN public.organizations o ON m.organization_id = o.id
  WHERE m.invite_token = token_input;
END;
$$;

-- Enhanced accept invitation with row-level locking for security
CREATE OR REPLACE FUNCTION public.accept_invitation(token_input uuid, new_user_id uuid)
RETURNS TABLE(
  success boolean,
  error_message text,
  member_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    RETURN QUERY SELECT false, 'Invalid or expired invitation'::text, null::uuid;
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
  RETURN QUERY SELECT true, 'Invitation accepted successfully'::text, member_record.id;
END;
$$;

-- Function to clean up expired invitations (for maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  UPDATE public.members 
  SET 
    user_status = 'inactive',
    invite_token = NULL,
    invite_expires_at = NULL,
    updated_at = now()
  WHERE user_status = 'invited' 
    AND invite_expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RAISE LOG 'Cleaned up % expired invitations', cleanup_count;
  RETURN cleanup_count;
END;
$$;
