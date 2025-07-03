-- Create offer templates table
CREATE TABLE public.offer_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create offer template fields table (similar to country_fields)
CREATE TABLE public.offer_template_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.offer_templates(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type field_type NOT NULL DEFAULT 'text',
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  placeholder_text TEXT,
  help_text TEXT,
  accepted_file_types TEXT,
  max_file_size_mb INTEGER DEFAULT 5,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_template_fields ENABLE ROW LEVEL SECURITY;

-- Create policies for offer_templates
CREATE POLICY "Platform admins can manage offer templates"
ON public.offer_templates
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
    AND user_type = 'platform_admin'::user_type_enum
    AND member_role = 'admin'::member_role
  )
);

-- Create policies for offer_template_fields  
CREATE POLICY "Platform admins can manage offer template fields"
ON public.offer_template_fields
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
    AND user_type = 'platform_admin'::user_type_enum
    AND member_role = 'admin'::member_role
  )
);

-- Add updated_at trigger for offer_templates
CREATE TRIGGER update_offer_templates_updated_at
  BEFORE UPDATE ON public.offer_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add updated_at trigger for offer_template_fields
CREATE TRIGGER update_offer_template_fields_updated_at
  BEFORE UPDATE ON public.offer_template_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Update field_select_options to support offer template fields
ALTER TABLE public.field_select_options 
ADD COLUMN offer_template_field_id UUID REFERENCES public.offer_template_fields(id) ON DELETE CASCADE;

-- Update field_validation_rules to support offer template fields
ALTER TABLE public.field_validation_rules 
ADD COLUMN offer_template_field_id UUID REFERENCES public.offer_template_fields(id) ON DELETE CASCADE;

-- Add check constraints to ensure only one foreign key is set
ALTER TABLE public.field_select_options 
ADD CONSTRAINT field_select_options_single_reference 
CHECK (
  (country_field_id IS NOT NULL AND offer_template_field_id IS NULL) OR
  (country_field_id IS NULL AND offer_template_field_id IS NOT NULL)
);

ALTER TABLE public.field_validation_rules 
ADD CONSTRAINT field_validation_rules_single_reference 
CHECK (
  (country_field_id IS NOT NULL AND offer_template_field_id IS NULL) OR
  (country_field_id IS NULL AND offer_template_field_id IS NOT NULL)
);

-- Update RLS policies for field_select_options to include offer template fields
DROP POLICY IF EXISTS "Platform admins can insert field select options" ON public.field_select_options;
DROP POLICY IF EXISTS "Platform admins can update field select options" ON public.field_select_options;
DROP POLICY IF EXISTS "Platform admins can delete field select options" ON public.field_select_options;

CREATE POLICY "Platform admins can insert field select options"
ON public.field_select_options
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
    AND user_type = 'platform_admin'::user_type_enum
    AND member_role = 'admin'::member_role
  )
);

CREATE POLICY "Platform admins can update field select options"
ON public.field_select_options
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
    AND user_type = 'platform_admin'::user_type_enum
    AND member_role = 'admin'::member_role
  )
);

CREATE POLICY "Platform admins can delete field select options"
ON public.field_select_options
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
    AND user_type = 'platform_admin'::user_type_enum
    AND member_role = 'admin'::member_role
  )
);

-- Update RLS policies for field_validation_rules to include offer template fields
DROP POLICY IF EXISTS "Platform admins can insert field validation rules" ON public.field_validation_rules;
DROP POLICY IF EXISTS "Platform admins can update field validation rules" ON public.field_validation_rules;
DROP POLICY IF EXISTS "Platform admins can delete field validation rules" ON public.field_validation_rules;

CREATE POLICY "Platform admins can insert field validation rules"
ON public.field_validation_rules
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
    AND user_type = 'platform_admin'::user_type_enum
    AND member_role = 'admin'::member_role
  )
);

CREATE POLICY "Platform admins can update field validation rules"
ON public.field_validation_rules
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
    AND user_type = 'platform_admin'::user_type_enum
    AND member_role = 'admin'::member_role
  )
);

CREATE POLICY "Platform admins can delete field validation rules"
ON public.field_validation_rules
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
    AND user_type = 'platform_admin'::user_type_enum
    AND member_role = 'admin'::member_role
  )
);