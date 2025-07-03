-- Create offer_letters table
CREATE TABLE public.offer_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.job_candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.offer_templates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  field_values JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offer_letters ENABLE ROW LEVEL SECURITY;

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.offer_letters
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- RLS policies for offer_letters
CREATE POLICY "Platform admins can manage all offer letters" ON public.offer_letters FOR ALL
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Organization members can view offer letters in their org" ON public.offer_letters FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid() 
    AND m.organization_id = offer_letters.organization_id 
    AND m.user_status = 'active'
  )
);

CREATE POLICY "Organization recruiters can manage offer letters" ON public.offer_letters FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid() 
    AND m.organization_id = offer_letters.organization_id 
    AND m.member_role IN ('admin', 'recruiter')
    AND m.user_status = 'active'
  )
);

CREATE POLICY "Users can view offer letters for jobs they are assigned to" ON public.offer_letters FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_assignments ja
    WHERE ja.job_id = offer_letters.job_id 
    AND ja.user_id = auth.uid()
  )
);

-- Add comments for documentation
COMMENT ON TABLE public.offer_letters IS 'Stores generated offer letters for candidates';
COMMENT ON COLUMN public.offer_letters.field_values IS 'JSON object storing custom field values from the template';
COMMENT ON COLUMN public.offer_letters.status IS 'Status: draft, finalized, sent, accepted, declined';