
-- Add invite token fields to members table
ALTER TABLE public.members 
ADD COLUMN invite_token uuid,
ADD COLUMN invite_expires_at timestamp with time zone;

-- Create index for faster token lookups
CREATE INDEX idx_members_invite_token ON public.members(invite_token) WHERE invite_token IS NOT NULL;

-- Create function to generate secure invite tokens
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT gen_random_uuid();
$$;

-- Create function to set invite expiry (7 days from now)
CREATE OR REPLACE FUNCTION public.get_invite_expiry()
RETURNS timestamp with time zone
LANGUAGE sql
AS $$
  SELECT now() + interval '7 days';
$$;

-- Update trigger to auto-generate token for invited members
CREATE OR REPLACE FUNCTION public.handle_member_invite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If creating a new member with invited status and no user_id, generate invite token
  IF TG_OP = 'INSERT' AND NEW.user_status = 'invited' AND NEW.user_id IS NULL THEN
    NEW.invite_token = public.generate_invite_token();
    NEW.invite_expires_at = public.get_invite_expiry();
  END IF;
  
  -- If updating status from invited to active, clear invite fields
  IF TG_OP = 'UPDATE' AND OLD.user_status = 'invited' AND NEW.user_status = 'active' THEN
    NEW.invite_token = NULL;
    NEW.invite_expires_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for member invitations
DROP TRIGGER IF EXISTS trigger_member_invite ON public.members;
CREATE TRIGGER trigger_member_invite
  BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_member_invite();

-- Add constraint to prevent duplicate email invitations within same org
-- Note: We'll need to track email in a separate way since members table doesn't have email field
-- For now, we'll handle this in application logic

-- Create function to validate invite tokens
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

-- Create function to accept invitation (will be called after user is created)
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
  -- Get the member record for this token
  SELECT * INTO member_record 
  FROM public.members 
  WHERE invite_token = token_input 
    AND user_status = 'invited' 
    AND invite_expires_at > now()
    AND user_id IS NULL;
  
  IF NOT FOUND THEN
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
  
  RETURN QUERY SELECT true, 'Invitation accepted successfully'::text, member_record.id;
END;
$$;
