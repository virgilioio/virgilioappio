-- Create worker contract templates table
CREATE TABLE public.worker_contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID NOT NULL,
  template_name TEXT NOT NULL,
  template_content TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_contract_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for worker contract templates
CREATE POLICY "Platform admins can manage worker contract templates"
ON public.worker_contract_templates
FOR ALL
USING (get_user_type_secure() = 'platform_admin');

-- Create trigger for updated_at
CREATE TRIGGER update_worker_contract_templates_updated_at
BEFORE UPDATE ON public.worker_contract_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add foreign key constraint
ALTER TABLE public.worker_contract_templates
ADD CONSTRAINT worker_contract_templates_country_id_fkey
FOREIGN KEY (country_id) REFERENCES public.worker_compliance_countries(id) ON DELETE CASCADE;