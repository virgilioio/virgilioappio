-- Create enum for stage types
CREATE TYPE stage_type_enum AS ENUM (
  'application',
  'screening', 
  'interview',
  'assessment',
  'reference_check',
  'offer',
  'onboarding',
  'custom'
);

-- Create job_stages table
CREATE TABLE public.job_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_name TEXT NOT NULL,
  stage_type stage_type_enum NOT NULL,
  stage_description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  stage_priority INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.job_stages ENABLE ROW LEVEL SECURITY;

-- Create policies for job_stages
CREATE POLICY "Platform admins can manage all job stages"
ON public.job_stages
FOR ALL
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "All users can view active job stages"
ON public.job_stages
FOR SELECT
USING (is_active = true);

-- Add unique constraint for priority on default stages
CREATE UNIQUE INDEX idx_job_stages_default_priority 
ON public.job_stages (stage_priority) 
WHERE is_default = true AND is_active = true;

-- Add trigger for updated_at
CREATE TRIGGER update_job_stages_updated_at
BEFORE UPDATE ON public.job_stages
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();