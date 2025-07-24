-- Create table for worker compliance data (new system)
CREATE TABLE public.worker_compliance_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  worker_compliance_field_id UUID NOT NULL REFERENCES public.worker_compliance_fields(id) ON DELETE CASCADE,
  field_value TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size_bytes INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(worker_id, worker_compliance_field_id)
);

-- Enable RLS
ALTER TABLE public.worker_compliance_data ENABLE ROW LEVEL SECURITY;

-- Create policies for worker compliance data
CREATE POLICY "Users can view worker compliance data for their organization" 
ON public.worker_compliance_data 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = worker_compliance_data.worker_id
    AND w.organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Users can create worker compliance data for their organization" 
ON public.worker_compliance_data 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = worker_compliance_data.worker_id
    AND w.organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Users can update worker compliance data for their organization" 
ON public.worker_compliance_data 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = worker_compliance_data.worker_id
    AND w.organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Users can delete worker compliance data for their organization" 
ON public.worker_compliance_data 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = worker_compliance_data.worker_id
    AND w.organization_id = get_user_organization_id()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_worker_compliance_data_updated_at
BEFORE UPDATE ON public.worker_compliance_data
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();