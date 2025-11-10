-- =====================================================
-- Phase 1.2: Lock Down Invitations Table
-- =====================================================

-- Create invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  member_role public.member_role NOT NULL,
  invite_token uuid UNIQUE DEFAULT gen_random_uuid(),
  invite_expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  used_at timestamptz,
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add used_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'invitations' 
    AND column_name = 'used_at'
  ) THEN
    ALTER TABLE public.invitations ADD COLUMN used_at timestamptz;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Platform admins have full access
DROP POLICY IF EXISTS "invitations_platform_admin" ON public.invitations;
CREATE POLICY "invitations_platform_admin" 
ON public.invitations FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Workspace owners manage within their tenant
DROP POLICY IF EXISTS "invitations_workspace_owner_manage" ON public.invitations;
CREATE POLICY "invitations_workspace_owner_manage" 
ON public.invitations FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    JOIN public.organizations o ON o.id = m.organization_id
    JOIN public.organizations inv_org ON inv_org.id = invitations.organization_id
    WHERE m.user_id = auth.uid()
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
      AND o.tenant_id = inv_org.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    JOIN public.organizations o ON o.id = m.organization_id
    JOIN public.organizations inv_org ON inv_org.id = invitations.organization_id
    WHERE m.user_id = auth.uid()
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
      AND o.tenant_id = inv_org.tenant_id
  )
);

-- Members can view their own invitations
DROP POLICY IF EXISTS "invitations_self_view" ON public.invitations;
CREATE POLICY "invitations_self_view" 
ON public.invitations FOR SELECT TO authenticated
USING (email = public.get_user_email());

-- Prevent invitation reuse
CREATE OR REPLACE FUNCTION public.reject_used_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RAISE EXCEPTION 'Cannot modify invitation that has already been used (used_at: %)', OLD.used_at
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS check_invitation_not_used ON public.invitations;
CREATE TRIGGER check_invitation_not_used
BEFORE UPDATE ON public.invitations
FOR EACH ROW
WHEN (OLD.used_at IS NOT NULL)
EXECUTE FUNCTION public.reject_used_invitation();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(invite_token) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON public.invitations(organization_id);