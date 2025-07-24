-- Create separate worker compliance countries table
CREATE TABLE public.worker_compliance_countries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_compliance_countries ENABLE ROW LEVEL SECURITY;

-- Create policies for worker compliance countries
CREATE POLICY "All users can view active worker compliance countries" 
ON public.worker_compliance_countries 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Platform admins can manage worker compliance countries" 
ON public.worker_compliance_countries 
FOR ALL 
USING (get_user_type_secure() = 'platform_admin');

-- Create worker compliance fields table
CREATE TABLE public.worker_compliance_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_country_id UUID NOT NULL REFERENCES public.worker_compliance_countries(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type field_type NOT NULL DEFAULT 'text',
  is_required BOOLEAN NOT NULL DEFAULT false,
  placeholder_text TEXT,
  help_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  accepted_file_types TEXT,
  max_file_size_mb INTEGER DEFAULT 5,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(worker_country_id, field_name)
);

-- Enable RLS
ALTER TABLE public.worker_compliance_fields ENABLE ROW LEVEL SECURITY;

-- Create policies for worker compliance fields
CREATE POLICY "All users can view worker compliance fields" 
ON public.worker_compliance_fields 
FOR SELECT 
USING (true);

CREATE POLICY "Platform admins can manage worker compliance fields" 
ON public.worker_compliance_fields 
FOR ALL 
USING (get_user_type_secure() = 'platform_admin');

-- Add triggers for updated_at
CREATE TRIGGER update_worker_compliance_countries_updated_at
BEFORE UPDATE ON public.worker_compliance_countries
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_worker_compliance_fields_updated_at
BEFORE UPDATE ON public.worker_compliance_fields
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Insert some common worker compliance countries to start
INSERT INTO public.worker_compliance_countries (name, code, description) VALUES
('United States', 'US', 'Worker visa and tax compliance requirements for US'),
('United Kingdom', 'GB', 'Worker visa and tax compliance requirements for UK'),
('Germany', 'DE', 'Worker visa and tax compliance requirements for Germany'),
('Canada', 'CA', 'Worker visa and tax compliance requirements for Canada'),
('Australia', 'AU', 'Worker visa and tax compliance requirements for Australia'),
('Singapore', 'SG', 'Worker visa and tax compliance requirements for Singapore'),
('Netherlands', 'NL', 'Worker visa and tax compliance requirements for Netherlands'),
('France', 'FR', 'Worker visa and tax compliance requirements for France');

-- Create worker compliance select options table
CREATE TABLE public.worker_compliance_field_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_compliance_field_id UUID NOT NULL REFERENCES public.worker_compliance_fields(id) ON DELETE CASCADE,
  option_value TEXT NOT NULL,
  option_label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_compliance_field_options ENABLE ROW LEVEL SECURITY;

-- Create policies for worker compliance field options
CREATE POLICY "All users can view worker compliance field options" 
ON public.worker_compliance_field_options 
FOR SELECT 
USING (true);

CREATE POLICY "Platform admins can manage worker compliance field options" 
ON public.worker_compliance_field_options 
FOR ALL 
USING (get_user_type_secure() = 'platform_admin');

-- Create worker compliance field validation rules table
CREATE TABLE public.worker_compliance_field_validation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_compliance_field_id UUID NOT NULL REFERENCES public.worker_compliance_fields(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  rule_value TEXT NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_compliance_field_validation_rules ENABLE ROW LEVEL SECURITY;

-- Create policies for worker compliance field validation rules
CREATE POLICY "All users can view worker compliance field validation rules" 
ON public.worker_compliance_field_validation_rules 
FOR SELECT 
USING (true);

CREATE POLICY "Platform admins can manage worker compliance field validation rules" 
ON public.worker_compliance_field_validation_rules 
FOR ALL 
USING (get_user_type_secure() = 'platform_admin');