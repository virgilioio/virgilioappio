-- Create SECURITY DEFINER function to safely insert first member
-- Bypasses RLS policies that would prevent self-membership creation
CREATE OR REPLACE FUNCTION public.admin_insert_first_member(
  p_tenant_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  -- Log function invocation
  RAISE LOG 'admin_insert_first_member called: tenant=%, user=%', p_tenant_id, p_user_id;
  
  -- Check if member already exists (idempotency)
  SELECT id INTO v_member_id
  FROM public.members
  WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id;
  
  IF v_member_id IS NOT NULL THEN
    RAISE LOG 'Member already exists: %', v_member_id;
    RETURN v_member_id;
  END IF;
  
  -- Insert first member with workspace_owner/admin role
  -- organization_id = tenant_id (no child orgs at signup)
  INSERT INTO public.members (
    user_id,
    organization_id,
    tenant_id,
    user_type,
    member_role,
    user_status
  ) VALUES (
    p_user_id,
    p_tenant_id,  -- organization_id = tenant_id for root org
    p_tenant_id,
    'workspace_owner',
    'admin',
    'active'
  )
  RETURNING id INTO v_member_id;
  
  RAISE LOG 'Successfully created first member: %', v_member_id;
  
  RETURN v_member_id;
END;
$$;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION public.admin_insert_first_member(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.admin_insert_first_member IS 
'Safely inserts the first member for a new tenant, bypassing RLS policies. Used during tenant provisioning.';