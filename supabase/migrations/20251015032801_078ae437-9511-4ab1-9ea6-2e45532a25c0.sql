-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'custom',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contract_templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'custom',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
CREATE POLICY "Platform admins can manage all email templates"
ON public.email_templates
FOR ALL
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Workspace owners can manage organization email templates"
ON public.email_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = email_templates.organization_id
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = email_templates.organization_id
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
);

CREATE POLICY "Organization members can view email templates"
ON public.email_templates
FOR SELECT
USING (
  organization_id IS NULL OR
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = email_templates.organization_id
      AND m.user_status = 'active'
  )
);

-- RLS Policies for contract_templates
CREATE POLICY "Platform admins can manage all contract templates"
ON public.contract_templates
FOR ALL
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Workspace owners can manage organization contract templates"
ON public.contract_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = contract_templates.organization_id
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = contract_templates.organization_id
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
);

CREATE POLICY "Organization members can view contract templates"
ON public.contract_templates
FOR SELECT
USING (
  organization_id IS NULL OR
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = contract_templates.organization_id
      AND m.user_status = 'active'
  )
);