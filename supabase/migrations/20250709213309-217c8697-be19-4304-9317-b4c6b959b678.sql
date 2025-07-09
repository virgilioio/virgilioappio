-- Extend candidates table with enrichment fields
ALTER TABLE public.candidates 
ADD COLUMN enrichment_status TEXT DEFAULT 'pending',
ADD COLUMN enriched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN coresignal_profile_id TEXT,
ADD COLUMN contact_emails TEXT[],
ADD COLUMN contact_phones TEXT[],
ADD COLUMN social_profiles JSONB DEFAULT '{}',
ADD COLUMN bio TEXT,
ADD COLUMN company_current TEXT,
ADD COLUMN role_current TEXT,
ADD COLUMN years_experience INTEGER,
ADD COLUMN resume_generated_url TEXT;

-- Create work experience table
CREATE TABLE public.candidate_work_experience (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_logo_url TEXT,
  job_title TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  skills_used TEXT[],
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create education table
CREATE TABLE public.candidate_education (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  institution_name TEXT NOT NULL,
  degree_type TEXT,
  field_of_study TEXT,
  start_date DATE,
  end_date DATE,
  grade TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create enrichment logs table
CREATE TABLE public.candidate_enrichment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  enrichment_type TEXT NOT NULL, -- 'coresignal', 'manual', etc.
  status TEXT NOT NULL, -- 'success', 'failed', 'partial'
  credits_used INTEGER DEFAULT 0,
  data_found JSONB DEFAULT '{}',
  error_message TEXT,
  processed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_candidates_enrichment_status ON public.candidates(enrichment_status);
CREATE INDEX idx_candidates_coresignal_profile ON public.candidates(coresignal_profile_id);
CREATE INDEX idx_candidate_work_experience_candidate_id ON public.candidate_work_experience(candidate_id);
CREATE INDEX idx_candidate_education_candidate_id ON public.candidate_education(candidate_id);
CREATE INDEX idx_candidate_enrichment_logs_candidate_id ON public.candidate_enrichment_logs(candidate_id);

-- Enable RLS on new tables
ALTER TABLE public.candidate_work_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_enrichment_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for work experience
CREATE POLICY "Organization members can view work experience" 
ON public.candidate_work_experience FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.job_candidates jc ON c.id = jc.candidate_id
    JOIN public.jobs j ON jc.job_id = j.id
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE c.id = candidate_work_experience.candidate_id 
    AND m.user_id = auth.uid() 
    AND m.user_status = 'active'
  ) OR 
  get_user_type_secure() = 'platform_admin'
);

CREATE POLICY "Organization recruiters can manage work experience" 
ON public.candidate_work_experience FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.job_candidates jc ON c.id = jc.candidate_id
    JOIN public.jobs j ON jc.job_id = j.id
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE c.id = candidate_work_experience.candidate_id 
    AND m.user_id = auth.uid() 
    AND m.member_role IN ('admin', 'recruiter')
    AND m.user_status = 'active'
  ) OR 
  get_user_type_secure() = 'platform_admin'
);

-- RLS policies for education (similar structure)
CREATE POLICY "Organization members can view education" 
ON public.candidate_education FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.job_candidates jc ON c.id = jc.candidate_id
    JOIN public.jobs j ON jc.job_id = j.id
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE c.id = candidate_education.candidate_id 
    AND m.user_id = auth.uid() 
    AND m.user_status = 'active'
  ) OR 
  get_user_type_secure() = 'platform_admin'
);

CREATE POLICY "Organization recruiters can manage education" 
ON public.candidate_education FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.job_candidates jc ON c.id = jc.candidate_id
    JOIN public.jobs j ON jc.job_id = j.id
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE c.id = candidate_education.candidate_id 
    AND m.user_id = auth.uid() 
    AND m.member_role IN ('admin', 'recruiter')
    AND m.user_status = 'active'
  ) OR 
  get_user_type_secure() = 'platform_admin'
);

-- RLS policies for enrichment logs
CREATE POLICY "Organization members can view enrichment logs" 
ON public.candidate_enrichment_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.job_candidates jc ON c.id = jc.candidate_id
    JOIN public.jobs j ON jc.job_id = j.id
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE c.id = candidate_enrichment_logs.candidate_id 
    AND m.user_id = auth.uid() 
    AND m.user_status = 'active'
  ) OR 
  get_user_type_secure() = 'platform_admin'
);

CREATE POLICY "Platform admins can manage enrichment logs" 
ON public.candidate_enrichment_logs FOR ALL 
USING (get_user_type_secure() = 'platform_admin');

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_candidate_work_experience_updated_at
  BEFORE UPDATE ON public.candidate_work_experience
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_candidate_education_updated_at
  BEFORE UPDATE ON public.candidate_education
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();