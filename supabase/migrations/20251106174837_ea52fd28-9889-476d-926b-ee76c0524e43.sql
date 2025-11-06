-- Create table to store CoreSignal search preview results
CREATE TABLE IF NOT EXISTS public.coresignal_preview_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sourcing_project_id uuid NOT NULL REFERENCES public.sourcing_projects(id) ON DELETE CASCADE,
  coresignal_id text NOT NULL,
  full_name text NOT NULL,
  headline text,
  location text,
  country text,
  profile_url text,
  current_company text,
  current_title text,
  experience_count integer DEFAULT 0,
  match_score numeric,
  coresignal_score numeric,
  created_at timestamptz DEFAULT now(),
  
  -- Ensure we don't duplicate candidates for the same project
  UNIQUE(sourcing_project_id, coresignal_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_coresignal_preview_project ON public.coresignal_preview_candidates(sourcing_project_id);

-- Enable RLS
ALTER TABLE public.coresignal_preview_candidates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view preview candidates for their org projects
CREATE POLICY "Users can view preview candidates for their org projects"
  ON public.coresignal_preview_candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sourcing_projects sp
      JOIN public.members m ON m.organization_id = sp.organization_id
      WHERE sp.id = coresignal_preview_candidates.sourcing_project_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
    )
  );