
-- Add created_by column for audit trail
ALTER TABLE public.organizations 
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Add optional owner assignment timestamp for future tracking
ALTER TABLE public.organizations 
ADD COLUMN owner_assigned_at TIMESTAMP WITH TIME ZONE;

-- Enable Row Level Security on organizations table (if not already enabled)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for SELECT operations (Platform Admins can see all, others see their own org)
CREATE POLICY "Platform admins can view all organizations" 
ON public.organizations 
FOR SELECT 
TO authenticated 
USING (
  get_user_type() = 'platform_admin' OR 
  get_member_role() = 'customer_success' OR
  id = get_user_organization_id()
);

-- Create RLS policy for INSERT operations (Only Platform Admins and Customer Success can create)
CREATE POLICY "Only platform admins and customer success can create organizations" 
ON public.organizations 
FOR INSERT 
TO authenticated 
WITH CHECK (
  get_user_type() = 'platform_admin' OR 
  get_member_role() = 'customer_success'
);

-- Create RLS policy for UPDATE operations (Platform Admins can update all, workspace owners can update their own)
CREATE POLICY "Platform admins and workspace owners can update organizations" 
ON public.organizations 
FOR UPDATE 
TO authenticated 
USING (
  get_user_type() = 'platform_admin' OR 
  get_member_role() = 'customer_success' OR
  (id = get_user_organization_id() AND get_user_type() = 'workspace_owner')
);

-- Create RLS policy for DELETE operations (Only Platform Admins can delete)
CREATE POLICY "Only platform admins can delete organizations" 
ON public.organizations 
FOR DELETE 
TO authenticated 
USING (get_user_type() = 'platform_admin');

-- Create function to automatically set created_by during INSERT
CREATE OR REPLACE FUNCTION public.handle_organization_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Automatically set created_by to current user
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  
  -- Set owner_assigned_at if owner_id is being set
  IF NEW.owner_id IS NOT NULL AND OLD.owner_id IS NULL THEN
    NEW.owner_assigned_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to call the audit function
CREATE TRIGGER organization_audit_trigger
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_organization_audit();
