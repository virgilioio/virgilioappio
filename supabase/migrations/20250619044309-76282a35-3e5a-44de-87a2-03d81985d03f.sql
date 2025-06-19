
-- Create countries table to replace static country list
CREATE TABLE public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE, -- ISO country code (e.g., 'MX', 'US')
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create field types enum including file upload
CREATE TYPE public.field_type AS ENUM (
  'text',
  'number', 
  'email',
  'textarea',
  'select',
  'checkbox',
  'date',
  'file'
);

-- Create country fields table for dynamic field definitions
CREATE TABLE public.country_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type public.field_type NOT NULL DEFAULT 'text',
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  placeholder_text TEXT,
  help_text TEXT,
  -- File upload specific fields
  accepted_file_types TEXT, -- JSON array of MIME types e.g., ["application/pdf", "image/jpeg"]
  max_file_size_mb INTEGER DEFAULT 5, -- Maximum file size in MB
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(country_id, field_name)
);

-- Create field validation rules table
CREATE TABLE public.field_validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_field_id UUID REFERENCES public.country_fields(id) ON DELETE CASCADE NOT NULL,
  rule_type TEXT NOT NULL, -- 'regex', 'min_length', 'max_length', 'min_value', 'max_value'
  rule_value TEXT NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create select options table for select field types
CREATE TABLE public.field_select_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_field_id UUID REFERENCES public.country_fields(id) ON DELETE CASCADE NOT NULL,
  option_value TEXT NOT NULL,
  option_label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization custom data table
CREATE TABLE public.organization_custom_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  country_field_id UUID REFERENCES public.country_fields(id) ON DELETE CASCADE NOT NULL,
  field_value TEXT, -- For text/number/email/textarea/select/checkbox/date fields
  file_url TEXT, -- For file uploads - Supabase storage URL
  file_name TEXT, -- Original filename for display
  file_size_bytes INTEGER, -- File size for validation tracking
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, country_field_id)
);

-- Create storage bucket for organization custom files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('organization-files', 'organization-files', false);

-- Storage policies for organization files
CREATE POLICY "Platform admins can view all organization files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'organization-files' 
    AND EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

CREATE POLICY "Organization members can view their files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'organization-files'
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
      AND name LIKE m.organization_id::text || '/%'
    )
  );

CREATE POLICY "Authenticated users can upload organization files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'organization-files'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update their organization files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'organization-files'
    AND (
      -- Platform admins can update all
      EXISTS (
        SELECT 1 FROM public.members 
        WHERE user_id = auth.uid() 
        AND user_type = 'platform_admin' 
        AND member_role = 'admin'
      )
      OR
      -- Organization members can update their files
      EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.user_id = auth.uid()
        AND name LIKE m.organization_id::text || '/%'
      )
    )
  );

CREATE POLICY "Users can delete their organization files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'organization-files'
    AND (
      -- Platform admins can delete all
      EXISTS (
        SELECT 1 FROM public.members 
        WHERE user_id = auth.uid() 
        AND user_type = 'platform_admin' 
        AND member_role = 'admin'
      )
      OR
      -- Organization members can delete their files
      EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.user_id = auth.uid()
        AND name LIKE m.organization_id::text || '/%'
      )
    )
  );

-- Enable RLS on all tables
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_select_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_custom_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Countries
CREATE POLICY "All users can view active countries" ON public.countries
  FOR SELECT USING (is_active = true);

CREATE POLICY "Platform admins can insert countries" ON public.countries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

CREATE POLICY "Platform admins can update countries" ON public.countries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

CREATE POLICY "Platform admins can delete countries" ON public.countries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

-- RLS Policies - Country Fields
CREATE POLICY "All users can view country fields" ON public.country_fields
  FOR SELECT USING (true);

CREATE POLICY "Platform admins can insert country fields" ON public.country_fields
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

CREATE POLICY "Platform admins can update country fields" ON public.country_fields
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

CREATE POLICY "Platform admins can delete country fields" ON public.country_fields
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

-- RLS Policies - Field Validation Rules
CREATE POLICY "All users can view field validation rules" ON public.field_validation_rules
  FOR SELECT USING (true);

CREATE POLICY "Platform admins can insert field validation rules" ON public.field_validation_rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

CREATE POLICY "Platform admins can update field validation rules" ON public.field_validation_rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

CREATE POLICY "Platform admins can delete field validation rules" ON public.field_validation_rules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

-- RLS Policies - Field Select Options
CREATE POLICY "All users can view field select options" ON public.field_select_options
  FOR SELECT USING (true);

CREATE POLICY "Platform admins can insert field select options" ON public.field_select_options
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

CREATE POLICY "Platform admins can update field select options" ON public.field_select_options
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

CREATE POLICY "Platform admins can delete field select options" ON public.field_select_options
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
  );

-- Organization custom data - visible to organization members and platform admins
CREATE POLICY "Users can view organization custom data" ON public.organization_custom_data
  FOR SELECT USING (
    -- Platform admins can see all
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
    OR
    -- Organization members can see their org's data
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organization_id
    )
  );

CREATE POLICY "Users can insert organization custom data" ON public.organization_custom_data
  FOR INSERT WITH CHECK (
    -- Platform admins can manage all
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
    OR
    -- Organization admins can manage their org's data
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organization_id
      AND m.member_role = 'admin'
    )
  );

CREATE POLICY "Users can update organization custom data" ON public.organization_custom_data
  FOR UPDATE USING (
    -- Platform admins can manage all
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
    OR
    -- Organization admins can manage their org's data
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organization_id
      AND m.member_role = 'admin'
    )
  );

CREATE POLICY "Users can delete organization custom data" ON public.organization_custom_data
  FOR DELETE USING (
    -- Platform admins can manage all
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND user_type = 'platform_admin' 
      AND member_role = 'admin'
    )
    OR
    -- Organization admins can manage their org's data
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organization_id
      AND m.member_role = 'admin'
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER handle_updated_at_countries
  BEFORE UPDATE ON public.countries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_country_fields
  BEFORE UPDATE ON public.country_fields
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_organization_custom_data
  BEFORE UPDATE ON public.organization_custom_data
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert initial countries
INSERT INTO public.countries (name, code, is_active) VALUES
  ('United States', 'US', true),
  ('Mexico', 'MX', true),
  ('Canada', 'CA', true),
  ('United Kingdom', 'GB', true),
  ('Germany', 'DE', true),
  ('France', 'FR', true),
  ('Spain', 'ES', true),
  ('Brazil', 'BR', true),
  ('Argentina', 'AR', true),
  ('Australia', 'AU', true);

-- Add RFC field for Mexico as an example
INSERT INTO public.country_fields (country_id, field_name, field_label, field_type, is_required, display_order, placeholder_text, help_text)
SELECT 
  c.id,
  'rfc',
  'RFC (Registro Federal de Contribuyentes)',
  'text',
  true,
  1,
  'ABC123456789',
  'Mexican taxpayer identification number (13 characters: 3-4 letters + 6 digits + 3 alphanumeric)'
FROM public.countries c 
WHERE c.code = 'MX';

-- Add RFC validation rule
INSERT INTO public.field_validation_rules (country_field_id, rule_type, rule_value, error_message)
SELECT 
  cf.id,
  'regex',
  '^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$',
  'RFC must be 13 characters: 3-4 letters followed by 6 digits and 3 alphanumeric characters'
FROM public.country_fields cf
JOIN public.countries c ON cf.country_id = c.id
WHERE c.code = 'MX' AND cf.field_name = 'rfc';

-- Add tax certificate file upload field for Mexico
INSERT INTO public.country_fields (country_id, field_name, field_label, field_type, is_required, display_order, help_text, accepted_file_types, max_file_size_mb)
SELECT 
  c.id,
  'tax_certificate',
  'Tax Certificate (Constancia de Situación Fiscal)',
  'file',
  false,
  2,
  'Upload your official tax certificate issued by SAT (PDF format recommended)',
  '["application/pdf", "image/jpeg", "image/png"]',
  10
FROM public.countries c 
WHERE c.code = 'MX';

-- Add EIN field for United States
INSERT INTO public.country_fields (country_id, field_name, field_label, field_type, is_required, display_order, placeholder_text, help_text)
SELECT 
  c.id,
  'ein',
  'EIN (Employer Identification Number)',
  'text',
  true,
  1,
  '12-3456789',
  'US federal tax identification number (9 digits in XX-XXXXXXX format)'
FROM public.countries c 
WHERE c.code = 'US';

-- Add EIN validation rule
INSERT INTO public.field_validation_rules (country_field_id, rule_type, rule_value, error_message)
SELECT 
  cf.id,
  'regex',
  '^[0-9]{2}-[0-9]{7}$',
  'EIN must be in format XX-XXXXXXX (2 digits, hyphen, 7 digits)'
FROM public.country_fields cf
JOIN public.countries c ON cf.country_id = c.id
WHERE c.code = 'US' AND cf.field_name = 'ein';
