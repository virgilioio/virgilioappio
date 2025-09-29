-- Phase 1: Add organization scoping to job settings tables

-- Add organization_id to job_stages table
ALTER TABLE public.job_stages 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add organization_id to application_fields table  
ALTER TABLE public.application_fields
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add organization_id to offer_templates table
ALTER TABLE public.offer_templates
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Update RLS policies for job_stages to allow workspace owners
DROP POLICY IF EXISTS "Platform admins can manage all job stages" ON public.job_stages;
DROP POLICY IF EXISTS "All users can view active job stages" ON public.job_stages;

-- New policies for job_stages
CREATE POLICY "Platform admins can manage all job stages" 
ON public.job_stages FOR ALL
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Organization members can view job stages" 
ON public.job_stages FOR SELECT
USING (
  is_active = true AND (
    organization_id IS NULL OR  -- Platform defaults visible to all
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
        AND m.organization_id = job_stages.organization_id 
        AND m.user_status = 'active'
    )
  )
);

CREATE POLICY "Workspace owners can manage organization job stages"
ON public.job_stages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = job_stages.organization_id 
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = job_stages.organization_id 
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
);

-- Update RLS policies for application_fields
DROP POLICY IF EXISTS "Platform admins can manage application fields" ON public.application_fields;
DROP POLICY IF EXISTS "Platform admins can view application fields" ON public.application_fields;

-- New policies for application_fields
CREATE POLICY "Platform admins can manage all application fields" 
ON public.application_fields FOR ALL
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Organization members can view application fields" 
ON public.application_fields FOR SELECT
USING (
  organization_id IS NULL OR  -- Platform defaults visible to all
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = application_fields.organization_id 
      AND m.user_status = 'active'
  )
);

CREATE POLICY "Workspace owners can manage organization application fields"
ON public.application_fields FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = application_fields.organization_id 
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = application_fields.organization_id 
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
);

-- Update RLS policies for offer_templates  
DROP POLICY IF EXISTS "Authenticated users can view offer templates" ON public.offer_templates;

-- New policies for offer_templates
CREATE POLICY "Platform admins can manage all offer templates" 
ON public.offer_templates FOR ALL
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Organization members can view offer templates" 
ON public.offer_templates FOR SELECT
USING (
  organization_id IS NULL OR  -- Platform defaults visible to all
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = offer_templates.organization_id 
      AND m.user_status = 'active'
  )
);

CREATE POLICY "Workspace owners can manage organization offer templates"
ON public.offer_templates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = offer_templates.organization_id 
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = offer_templates.organization_id 
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
);

-- Also need to update offer_template_fields to have organization scoping
ALTER TABLE public.offer_template_fields 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Update RLS policies for offer_template_fields
DROP POLICY IF EXISTS "Authenticated users can view offer template fields" ON public.offer_template_fields;

CREATE POLICY "Platform admins can manage all offer template fields" 
ON public.offer_template_fields FOR ALL
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Organization members can view offer template fields" 
ON public.offer_template_fields FOR SELECT
USING (
  organization_id IS NULL OR  -- Platform defaults visible to all
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = offer_template_fields.organization_id 
      AND m.user_status = 'active'
  )
);

CREATE POLICY "Workspace owners can manage organization offer template fields"
ON public.offer_template_fields FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = offer_template_fields.organization_id 
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = offer_template_fields.organization_id 
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  )
);