
-- Drop the existing function first
DROP FUNCTION IF EXISTS public.validate_invite_token(uuid);

-- Add a column to store the invited email in the members table
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS invited_email text;

-- Update the trigger to include email handling
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
    NEW.invited_email = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the new validate function with updated return type
CREATE OR REPLACE FUNCTION public.validate_invite_token(token_input uuid)
RETURNS TABLE(
  member_id uuid,
  organization_id uuid,
  member_role text,
  organization_name text,
  invite_email text,
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
    m.invited_email as invite_email,
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
