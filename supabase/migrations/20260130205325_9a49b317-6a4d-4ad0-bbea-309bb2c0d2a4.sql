-- Create RPC function for email-based invitation reconciliation
-- This function automatically links users to pending invitations based on their email
-- It runs after any authentication (OAuth, email/password) to ensure no orphaned accounts

CREATE OR REPLACE FUNCTION public.reconcile_pending_invitation(p_user_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  action_taken TEXT,
  organization_id UUID,
  organization_name TEXT,
  member_role TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
  v_member_record RECORD;
BEGIN
  -- Get user's email from auth.users
  SELECT email INTO v_user_email 
  FROM auth.users 
  WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'user_not_found'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Find pending invitation for this email (with row lock to prevent race conditions)
  SELECT m.id, m.organization_id, m.member_role, m.invite_expires_at, o.name as org_name
  INTO v_member_record
  FROM members m
  JOIN organizations o ON m.organization_id = o.id
  WHERE m.invited_email = v_user_email
    AND m.user_status = 'invited'
    AND m.user_id IS NULL
    AND (m.invite_expires_at IS NULL OR m.invite_expires_at > NOW())
  FOR UPDATE OF m
  LIMIT 1;
  
  IF v_member_record IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'no_pending_invitation'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Atomically link the user to the member record
  UPDATE members SET
    user_id = p_user_id,
    user_status = 'active',
    invite_token = NULL,
    invite_expires_at = NULL,
    updated_at = NOW()
  WHERE id = v_member_record.id;
  
  -- Return success with organization details
  RETURN QUERY SELECT 
    true::BOOLEAN, 
    'invitation_accepted'::TEXT,
    v_member_record.organization_id,
    v_member_record.org_name,
    v_member_record.member_role;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.reconcile_pending_invitation(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.reconcile_pending_invitation IS 'Automatically links authenticated users to their pending organization invitations based on email address. Called during auth bootstrap to ensure OAuth and other auth paths correctly accept invitations.';