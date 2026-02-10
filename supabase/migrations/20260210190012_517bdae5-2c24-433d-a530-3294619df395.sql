
-- Create validation_point_resolutions table
CREATE TABLE public.validation_point_resolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  association_id UUID NOT NULL REFERENCES public.job_candidate_associations(id) ON DELETE CASCADE,
  point_index INTEGER NOT NULL,
  point_question TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('validated', 'flagged')),
  resolved_by UUID NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_in_stage TEXT NOT NULL,
  notes TEXT,
  scorecard_id UUID REFERENCES public.job_stage_scorecards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (association_id, point_index)
);

-- Enable RLS
ALTER TABLE public.validation_point_resolutions ENABLE ROW LEVEL SECURITY;

-- Read: org members via hierarchy check (same as scorecards)
CREATE POLICY "Org members can read validation resolutions"
ON public.validation_point_resolutions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_candidate_associations jca
    JOIN public.jobs j ON j.id = jca.job_id
    WHERE jca.id = validation_point_resolutions.association_id
    AND public.check_org_hierarchy_role_access(j.organization_id, 'interviewer')
  )
);

-- Insert: authenticated users can insert their own
CREATE POLICY "Authenticated users can insert their own resolutions"
ON public.validation_point_resolutions
FOR INSERT
WITH CHECK (auth.uid() = resolved_by);

-- Update: users can update their own resolutions
CREATE POLICY "Users can update their own resolutions"
ON public.validation_point_resolutions
FOR UPDATE
USING (auth.uid() = resolved_by);

-- Create index for fast lookups
CREATE INDEX idx_validation_resolutions_association ON public.validation_point_resolutions(association_id);
