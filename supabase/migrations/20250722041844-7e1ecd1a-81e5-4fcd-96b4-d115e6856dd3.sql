
-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(organization_id, name) -- Ensure unique department names within each organization
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departments
-- Platform admins can manage all departments
CREATE POLICY "Platform admins can manage all departments" ON public.departments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

-- Workspace owners can manage departments in their organization
CREATE POLICY "Workspace owners can manage their org departments" ON public.departments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = departments.organization_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
    )
  );

-- Organization members can view departments in their organization
CREATE POLICY "Organization members can view their departments" ON public.departments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = departments.organization_id
      AND m.user_status = 'active'
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at_departments
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
