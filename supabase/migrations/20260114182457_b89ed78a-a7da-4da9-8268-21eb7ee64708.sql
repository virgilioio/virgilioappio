-- Create candidate_reminders table
CREATE TABLE public.candidate_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  is_team_visible BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_candidate_reminders_candidate_id ON public.candidate_reminders(candidate_id);
CREATE INDEX idx_candidate_reminders_created_by ON public.candidate_reminders(created_by);
CREATE INDEX idx_candidate_reminders_organization_id ON public.candidate_reminders(organization_id);
CREATE INDEX idx_candidate_reminders_due_at ON public.candidate_reminders(due_at);
CREATE INDEX idx_candidate_reminders_completed_at ON public.candidate_reminders(completed_at) WHERE completed_at IS NULL;

-- Enable RLS
ALTER TABLE public.candidate_reminders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own reminders
CREATE POLICY "Users can view their own reminders"
ON public.candidate_reminders
FOR SELECT
USING (auth.uid() = created_by);

-- Policy: Users can view team-visible reminders in their organization
CREATE POLICY "Users can view team-visible reminders in their organization"
ON public.candidate_reminders
FOR SELECT
USING (
  is_team_visible = true 
  AND organization_id IN (
    SELECT organization_id FROM members 
    WHERE user_id = auth.uid() AND user_status = 'active'
  )
);

-- Policy: Users can create reminders in their organization
CREATE POLICY "Users can create reminders in their organization"
ON public.candidate_reminders
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND organization_id IN (
    SELECT organization_id FROM members 
    WHERE user_id = auth.uid() AND user_status = 'active'
  )
);

-- Policy: Users can update their own reminders
CREATE POLICY "Users can update their own reminders"
ON public.candidate_reminders
FOR UPDATE
USING (auth.uid() = created_by);

-- Policy: Users can delete their own reminders
CREATE POLICY "Users can delete their own reminders"
ON public.candidate_reminders
FOR DELETE
USING (auth.uid() = created_by);

-- Trigger for updated_at
CREATE TRIGGER update_candidate_reminders_updated_at
BEFORE UPDATE ON public.candidate_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();