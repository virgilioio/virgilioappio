-- Create table for worker-specific compliance data
CREATE TABLE public.worker_custom_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL,
  country_field_id UUID NOT NULL REFERENCES public.country_fields(id) ON DELETE CASCADE,
  field_value TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size_bytes INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(worker_id, country_field_id)
);

-- Enable RLS on worker_custom_data
ALTER TABLE public.worker_custom_data ENABLE ROW LEVEL SECURITY;

-- Create policies for worker_custom_data
CREATE POLICY "Platform admins can manage all worker custom data" 
  ON public.worker_custom_data 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.user_type = 'platform_admin'
    )
  );

CREATE POLICY "Organization members can view worker data for their org workers" 
  ON public.worker_custom_data 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workers w
      JOIN public.members m ON w.organization_id = m.organization_id
      WHERE w.id = worker_custom_data.worker_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Organization admins can manage worker data for their org workers" 
  ON public.worker_custom_data 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workers w
      JOIN public.members m ON w.organization_id = m.organization_id
      WHERE w.id = worker_custom_data.worker_id
      AND m.user_id = auth.uid()
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
    )
  );

-- Add updated_at trigger
CREATE TRIGGER handle_worker_custom_data_updated_at
  BEFORE UPDATE ON public.worker_custom_data
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();