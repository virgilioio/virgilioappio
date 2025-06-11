
-- Phase 3: Safe data migration to assign 'client' role to workspace owners
-- This migration will update workspace owners to have 'client' member_role instead of mixed roles

-- Step 1: Update members who are workspace owners to have 'client' role
-- We'll identify workspace owners by checking if their user_type is 'workspace_owner' 
-- or if they don't have a member record but their user metadata indicates workspace_owner
UPDATE public.members 
SET 
  member_role = 'client',
  updated_at = now()
WHERE 
  user_type = 'workspace_owner'
  OR (
    user_id IN (
      SELECT id 
      FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' = 'workspace_owner'
    )
  );

-- Step 2: For any workspace owners who don't have member records yet, create them
-- This ensures all workspace owners have proper member records with 'client' role
INSERT INTO public.members (user_id, organization_id, member_role, user_type, user_status)
SELECT 
  u.id as user_id,
  (u.raw_user_meta_data->>'organization_id')::uuid as organization_id,
  'client' as member_role,
  'workspace_owner' as user_type,
  'active' as user_status
FROM auth.users u
WHERE 
  u.raw_user_meta_data->>'user_type' = 'workspace_owner'
  AND u.raw_user_meta_data->>'organization_id' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.members m WHERE m.user_id = u.id
  );

-- Note: This migration is reversible - we can rollback by updating member_role back to previous values if needed
-- The original user_type field is preserved for rollback purposes
