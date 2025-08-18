-- Create candidate application responses table
CREATE TABLE public.candidate_application_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL,
  job_id UUID NOT NULL,
  posting_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_value TEXT,
  field_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidate_application_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for organization members to view responses
CREATE POLICY "Organization members can view application responses"
ON public.candidate_application_responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM jobs j
    JOIN members m ON j.organization_id = m.organization_id
    WHERE j.id = candidate_application_responses.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
  OR get_user_type_secure() = 'platform_admin'
);

-- Create policy for platform admins to manage all responses
CREATE POLICY "Platform admins can manage all application responses"
ON public.candidate_application_responses
FOR ALL
USING (get_user_type_secure() = 'platform_admin');

-- Create indexes for better performance
CREATE INDEX idx_candidate_application_responses_candidate_job 
ON public.candidate_application_responses(candidate_id, job_id);

CREATE INDEX idx_candidate_application_responses_posting 
ON public.candidate_application_responses(posting_id);