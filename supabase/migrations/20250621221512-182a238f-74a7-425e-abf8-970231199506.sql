
-- Create table for country-specific job request agreements
CREATE TABLE public.job_request_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  agreement_content TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(country_id, is_active) -- Only one active agreement per country
);

-- Add RLS policies for job request agreements
ALTER TABLE public.job_request_agreements ENABLE ROW LEVEL SECURITY;

-- Policy for platform admins to manage agreements
CREATE POLICY "Platform admins can manage job request agreements" 
  ON public.job_request_agreements 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.user_type = 'platform_admin'
    )
  );

-- Add updated_at trigger
CREATE TRIGGER handle_job_request_agreements_updated_at
  BEFORE UPDATE ON public.job_request_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add some sample placeholder keys for common fields
INSERT INTO public.platform_settings (setting_key, display_name, description, setting_type) VALUES
('agreement_placeholders', 'Agreement Placeholder Keys', 'Available placeholder keys for job request agreements', 'json')
ON CONFLICT (setting_key) DO NOTHING;
