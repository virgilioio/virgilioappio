-- ============================================================
-- CRITICAL HOTFIX: Remove Recursive RLS Policies on Members
-- ============================================================
-- Problem: Previous migration left recursive SELECT FROM members 
-- clauses in policies, causing infinite recursion
-- Solution: Use only check_org_member_access() which is SECURITY DEFINER
-- ============================================================

-- Drop problematic policies with recursive checks
DROP POLICY IF EXISTS "Org admins can view org members" ON public.members;
DROP POLICY IF EXISTS "Org admins can invite members" ON public.members;
DROP POLICY IF EXISTS "Org admins can update members" ON public.members;

-- Recreate policies WITHOUT recursive workspace_owner checks
-- check_org_member_access() already handles workspace owners internally
CREATE POLICY "Org admins can view org members"
ON public.members FOR SELECT
USING (check_org_member_access(organization_id, 'admin'));

CREATE POLICY "Org admins can invite members"
ON public.members FOR INSERT
WITH CHECK (check_org_member_access(organization_id, 'admin'));

CREATE POLICY "Org admins can update members"
ON public.members FOR UPDATE
USING (check_org_member_access(organization_id, 'admin'))
WITH CHECK (check_org_member_access(organization_id, 'admin'));