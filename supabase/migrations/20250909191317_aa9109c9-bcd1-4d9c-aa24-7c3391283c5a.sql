-- Add RLS policies for workspace owners to manage organizations

-- Allow workspace owners/admins to view organizations they own or manage
CREATE POLICY "Workspace owners can view their organizations" 
ON public.organizations 
FOR SELECT 
USING (
  get_user_type_secure() = 'platform_admin' OR
  (owner_id = auth.uid()) OR
  (parent_organization_id IN (
    SELECT m.organization_id 
    FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.user_status = 'active' 
      AND m.member_role IN ('admin', 'workspace_owner')
      AND m.user_type = 'workspace_owner'
  ))
);

-- Allow workspace owners/admins to create organizations 
CREATE POLICY "Workspace owners can create organizations" 
ON public.organizations 
FOR INSERT 
WITH CHECK (
  get_user_type_secure() = 'platform_admin' OR
  (owner_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.user_status = 'active' 
      AND m.member_role IN ('admin')
      AND m.user_type = 'workspace_owner'
  ))
);

-- Allow workspace owners/admins to update organizations they own
CREATE POLICY "Workspace owners can update their organizations" 
ON public.organizations 
FOR UPDATE 
USING (
  get_user_type_secure() = 'platform_admin' OR
  (owner_id = auth.uid()) OR
  (parent_organization_id IN (
    SELECT m.organization_id 
    FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.user_status = 'active' 
      AND m.member_role IN ('admin')
      AND m.user_type = 'workspace_owner'
  ))
);

-- Allow workspace owners/admins to delete organizations they own
CREATE POLICY "Workspace owners can delete their organizations" 
ON public.organizations 
FOR DELETE 
USING (
  get_user_type_secure() = 'platform_admin' OR
  (owner_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.user_status = 'active' 
      AND m.member_role IN ('admin')
      AND m.user_type = 'workspace_owner'
  ))
);