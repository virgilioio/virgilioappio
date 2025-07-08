-- Create independent candidates table
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location_country TEXT,
  location_state TEXT,
  location_city TEXT,
  salary_amount NUMERIC,
  salary_currency TEXT DEFAULT 'USD',
  salary_period TEXT,
  profile_summary TEXT,
  linkedin_url TEXT,
  resume_url TEXT,
  skills TEXT[],
  status TEXT DEFAULT 'available',
  source TEXT DEFAULT 'direct',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(email, candidate_name)
);

-- Create job-candidate associations table
CREATE TABLE public.job_candidate_associations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  notes TEXT,
  status TEXT DEFAULT 'active',
  added_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(candidate_id, job_id)
);

-- Enable RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_candidate_associations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for candidates table
CREATE POLICY "Platform admins can manage all candidates" 
ON public.candidates 
FOR ALL 
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Organization members can view candidates" 
ON public.candidates 
FOR SELECT 
USING (true);

CREATE POLICY "Organization recruiters can manage candidates" 
ON public.candidates 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
    AND m.member_role IN ('admin', 'recruiter') 
    AND m.user_status = 'active'
  )
);

-- RLS Policies for job_candidate_associations table
CREATE POLICY "Platform admins can manage all associations" 
ON public.job_candidate_associations 
FOR ALL 
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Organization members can view associations in their org" 
ON public.job_candidate_associations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_candidate_associations.job_id 
    AND m.user_id = auth.uid() 
    AND m.user_status = 'active'
  )
);

CREATE POLICY "Organization recruiters can manage associations" 
ON public.job_candidate_associations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_candidate_associations.job_id 
    AND m.user_id = auth.uid() 
    AND m.member_role IN ('admin', 'recruiter') 
    AND m.user_status = 'active'
  )
);

CREATE POLICY "Users can view associations for jobs they are assigned to" 
ON public.job_candidate_associations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.job_assignments ja
    WHERE ja.job_id = job_candidate_associations.job_id 
    AND ja.user_id = auth.uid()
  )
);

-- Add indexes for performance
CREATE INDEX idx_candidates_email ON public.candidates(email);
CREATE INDEX idx_candidates_name ON public.candidates(candidate_name);
CREATE INDEX idx_candidates_status ON public.candidates(status);
CREATE INDEX idx_candidates_created_at ON public.candidates(created_at);
CREATE INDEX idx_job_candidate_associations_candidate_id ON public.job_candidate_associations(candidate_id);
CREATE INDEX idx_job_candidate_associations_job_id ON public.job_candidate_associations(job_id);

-- Add updated_at triggers
CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_job_candidate_associations_updated_at
  BEFORE UPDATE ON public.job_candidate_associations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();