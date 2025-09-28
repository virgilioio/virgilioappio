-- Phase 1h: Drop ALL remaining policies that reference member_role
-- Drop remaining storage policies
DROP POLICY IF EXISTS "Users can delete candidate attachments they can manage" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their organization files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their organization files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload candidate attachments for manageable candidate" ON storage.objects;
DROP POLICY IF EXISTS "Users can view candidate attachments for accessible candidates" ON storage.objects;
DROP POLICY IF EXISTS "Workspace owners can upload invoices" ON storage.objects;

-- Migrate remaining data first
UPDATE public.members 
SET member_role = 'hiring_manager' 
WHERE member_role = 'client';

UPDATE public.members 
SET user_type = 'member', member_role = 'hiring_manager'
WHERE user_type = 'workspace_owner';

UPDATE public.members 
SET member_role = 'admin'
WHERE member_role = 'customer_success';