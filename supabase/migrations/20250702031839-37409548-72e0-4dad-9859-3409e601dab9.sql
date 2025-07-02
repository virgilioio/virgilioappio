
-- Create candidate_urls table
CREATE TABLE public.candidate_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.job_candidates(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  icon_name text NOT NULL DEFAULT 'link',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Add indexes for better performance
CREATE INDEX idx_candidate_urls_candidate_id ON public.candidate_urls(candidate_id);

-- Enable RLS
ALTER TABLE public.candidate_urls ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view URLs for candidates they can access" 
ON public.candidate_urls FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.job_candidates jc
    JOIN public.jobs j ON jc.job_id = j.id
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE jc.id = candidate_urls.candidate_id
    AND m.user_id = auth.uid()
    AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.job_candidates jc
    JOIN public.job_assignments ja ON jc.job_id = ja.job_id
    WHERE jc.id = candidate_urls.candidate_id
    AND ja.user_id = auth.uid()
  )
  OR get_user_type_secure() = 'platform_admin'
);

CREATE POLICY "Users can manage URLs for candidates they can manage" 
ON public.candidate_urls FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.job_candidates jc
    JOIN public.jobs j ON jc.job_id = j.id
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE jc.id = candidate_urls.candidate_id
    AND m.user_id = auth.uid()
    AND m.member_role IN ('admin', 'recruiter')
    AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.job_candidates jc
    JOIN public.job_assignments ja ON jc.job_id = ja.job_id
    WHERE jc.id = candidate_urls.candidate_id
    AND ja.user_id = auth.uid()
  )
  OR get_user_type_secure() = 'platform_admin'
);

-- Add updated_at trigger
CREATE TRIGGER update_candidate_urls_updated_at
  BEFORE UPDATE ON public.candidate_urls
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
