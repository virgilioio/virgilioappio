-- Phase 1: Fix candidates table RLS policies to include workspace_owner
-- Drop and recreate INSERT policy for candidates
DROP POLICY IF EXISTS "Organization recruiters can create candidates" ON public.candidates;

CREATE POLICY "Organization recruiters can create candidates" 
ON public.candidates FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR (
    organization_id IN (
      SELECT members.organization_id
      FROM public.members
      WHERE members.user_id = auth.uid()
        AND members.user_status = 'active'
        AND (
          members.user_type = 'workspace_owner'
          OR members.member_role IN ('admin', 'recruiter')
        )
    )
    AND created_by = auth.uid()
  )
);

-- Drop and recreate UPDATE policy for candidates
DROP POLICY IF EXISTS "Organization recruiters can update org candidates" ON public.candidates;

CREATE POLICY "Organization recruiters can update org candidates"
ON public.candidates FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR (
    organization_id IS NOT NULL 
    AND organization_id IN (
      SELECT members.organization_id
      FROM public.members
      WHERE members.user_id = auth.uid()
        AND members.user_status = 'active'
        AND (
          members.user_type = 'workspace_owner'
          OR members.member_role IN ('admin', 'recruiter')
        )
    )
  )
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR (
    organization_id IS NOT NULL 
    AND organization_id IN (
      SELECT members.organization_id
      FROM public.members
      WHERE members.user_id = auth.uid()
        AND members.user_status = 'active'
        AND (
          members.user_type = 'workspace_owner'
          OR members.member_role IN ('admin', 'recruiter')
        )
    )
  )
);

-- Phase 2: Add missing RLS policies for members table
-- Allow workspace owners and org admins to invite new members
DROP POLICY IF EXISTS "Workspace owners and admins can invite members" ON public.members;

CREATE POLICY "Workspace owners and admins can invite members"
ON public.members FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = members.organization_id
      AND m.user_status = 'active'
      AND (
        m.user_type = 'workspace_owner'
        OR m.member_role = 'admin'
      )
  )
);

-- Allow workspace owners and org admins to update members in their org
DROP POLICY IF EXISTS "Workspace owners and admins can update members" ON public.members;

CREATE POLICY "Workspace owners and admins can update members"
ON public.members FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = members.organization_id
      AND m.user_status = 'active'
      AND (
        m.user_type = 'workspace_owner'
        OR m.member_role = 'admin'
      )
  )
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = members.organization_id
      AND m.user_status = 'active'
      AND (
        m.user_type = 'workspace_owner'
        OR m.member_role = 'admin'
      )
  )
);

-- Allow workspace owners and org admins to view members in their org
DROP POLICY IF EXISTS "Workspace owners and admins can view members" ON public.members;

CREATE POLICY "Workspace owners and admins can view members"
ON public.members FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = members.organization_id
      AND m.user_status = 'active'
      AND (
        m.user_type = 'workspace_owner'
        OR m.member_role = 'admin'
      )
  )
);

-- Phase 3: Sync member data to fix inconsistencies
-- Fix TYPE_MISMATCH: Sync user_type from auth metadata
UPDATE public.members m
SET user_type = CASE 
  WHEN (au.raw_user_meta_data->>'user_type') = 'workspace_owner' THEN 'workspace_owner'::user_type_enum
  WHEN (au.raw_user_meta_data->>'user_type') = 'platform_admin' THEN 'platform_admin'::user_type_enum
  ELSE 'member'::user_type_enum
END,
updated_at = now()
FROM auth.users au
WHERE m.user_id = au.id
  AND m.user_type::text != COALESCE(au.raw_user_meta_data->>'user_type', 'member');

-- Fix ACTIVE_WITHOUT_USER_ID: Set to 'invited' status
UPDATE public.members
SET user_status = 'invited',
    updated_at = now()
WHERE user_status = 'active'
  AND user_id IS NULL;