
-- Add RLS policies for organization_custom_data table with proper permission restrictions
-- Only Platform Admins, Workspace Owners (for their own org), and Customer Success can edit

-- Enable RLS on the table (if not already enabled)
ALTER TABLE public.organization_custom_data ENABLE ROW LEVEL SECURITY;

-- Policy for viewing organization custom data
-- Platform admins can see all, workspace owners can see their own org, customer success can see managed orgs
CREATE POLICY "Authorized users can view organization custom data" 
  ON public.organization_custom_data
  FOR SELECT 
  TO authenticated
  USING (
    get_user_type() = 'platform_admin'
    OR (
      get_user_type() = 'workspace_owner' 
      AND EXISTS (
        SELECT 1 FROM public.organizations o 
        WHERE o.id = organization_id 
        AND o.owner_id = auth.uid()
      )
    )
    OR get_member_role() = 'customer_success'
  );

-- Policy for inserting organization custom data
-- Only authorized users can create compliance data
CREATE POLICY "Authorized users can insert organization custom data" 
  ON public.organization_custom_data
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    get_user_type() = 'platform_admin'
    OR (
      get_user_type() = 'workspace_owner' 
      AND EXISTS (
        SELECT 1 FROM public.organizations o 
        WHERE o.id = organization_id 
        AND o.owner_id = auth.uid()
      )
    )
    OR get_member_role() = 'customer_success'
  );

-- Policy for updating organization custom data
-- Same restrictions as insert
CREATE POLICY "Authorized users can update organization custom data" 
  ON public.organization_custom_data
  FOR UPDATE 
  TO authenticated
  USING (
    get_user_type() = 'platform_admin'
    OR (
      get_user_type() = 'workspace_owner' 
      AND EXISTS (
        SELECT 1 FROM public.organizations o 
        WHERE o.id = organization_id 
        AND o.owner_id = auth.uid()
      )
    )
    OR get_member_role() = 'customer_success'
  );

-- Policy for deleting organization custom data
-- Same restrictions as insert/update
CREATE POLICY "Authorized users can delete organization custom data" 
  ON public.organization_custom_data
  FOR DELETE 
  TO authenticated
  USING (
    get_user_type() = 'platform_admin'
    OR (
      get_user_type() = 'workspace_owner' 
      AND EXISTS (
        SELECT 1 FROM public.organizations o 
        WHERE o.id = organization_id 
        AND o.owner_id = auth.uid()
      )
    )
    OR get_member_role() = 'customer_success'
  );

-- Create storage bucket for organization files if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('organization-files', 'organization-files', false)
ON CONFLICT (id) DO NOTHING;

-- Add storage policies for organization files with same restrictions
CREATE POLICY "Authorized users can upload organization files" 
  ON storage.objects
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    bucket_id = 'organization-files' AND (
      get_user_type() = 'platform_admin'
      OR (
        get_user_type() = 'workspace_owner' 
        AND EXISTS (
          SELECT 1 FROM public.organizations o 
          WHERE o.id::text = split_part(name, '/', 1)
          AND o.owner_id = auth.uid()
        )
      )
      OR get_member_role() = 'customer_success'
    )
  );

CREATE POLICY "Authorized users can view organization files" 
  ON storage.objects
  FOR SELECT 
  TO authenticated
  USING (
    bucket_id = 'organization-files' AND (
      get_user_type() = 'platform_admin'
      OR (
        get_user_type() = 'workspace_owner' 
        AND EXISTS (
          SELECT 1 FROM public.organizations o 
          WHERE o.id::text = split_part(name, '/', 1)
          AND o.owner_id = auth.uid()
        )
      )
      OR get_member_role() = 'customer_success'
    )
  );

CREATE POLICY "Authorized users can delete organization files" 
  ON storage.objects
  FOR DELETE 
  TO authenticated
  USING (
    bucket_id = 'organization-files' AND (
      get_user_type() = 'platform_admin'
      OR (
        get_user_type() = 'workspace_owner' 
        AND EXISTS (
          SELECT 1 FROM public.organizations o 
          WHERE o.id::text = split_part(name, '/', 1)
          AND o.owner_id = auth.uid()
        )
      )
      OR get_member_role() = 'customer_success'
    )
  );
