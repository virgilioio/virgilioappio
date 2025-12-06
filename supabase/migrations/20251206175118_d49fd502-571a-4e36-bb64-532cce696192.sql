-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create rejection category enum
CREATE TYPE public.rejection_category AS ENUM ('recruiter_rejected', 'candidate_declined');

-- Create rejection_reasons table
CREATE TABLE public.rejection_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category public.rejection_category NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'tenant',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create index for efficient querying
CREATE INDEX idx_rejection_reasons_tenant_id ON public.rejection_reasons(tenant_id);
CREATE INDEX idx_rejection_reasons_category ON public.rejection_reasons(category);

-- Enable RLS
ALTER TABLE public.rejection_reasons ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Platform admins can manage all reasons
CREATE POLICY "Platform admins can manage all rejection reasons"
ON public.rejection_reasons
FOR ALL
USING (get_user_type_secure() = 'platform_admin');

-- Workspace owners can manage tenant reasons
CREATE POLICY "Workspace owners can manage tenant rejection reasons"
ON public.rejection_reasons
FOR ALL
USING (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
)
WITH CHECK (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
);

-- All tenant members can view their tenant's reasons + platform defaults
CREATE POLICY "Tenant members can view rejection reasons"
ON public.rejection_reasons
FOR SELECT
USING (
  tenant_id IS NULL 
  OR tenant_id = get_user_tenant_id()
);

-- Trigger for updated_at
CREATE TRIGGER update_rejection_reasons_updated_at
BEFORE UPDATE ON public.rejection_reasons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed platform default rejection reasons (tenant_id = NULL)

-- "We Rejected Them" reasons
INSERT INTO public.rejection_reasons (tenant_id, name, category, description, source, display_order) VALUES
(NULL, 'Insufficient experience', 'recruiter_rejected', 'Candidate lacks required experience level', 'platform', 1),
(NULL, 'Skills mismatch', 'recruiter_rejected', 'Candidate skills do not match job requirements', 'platform', 2),
(NULL, 'Salary expectations too high', 'recruiter_rejected', 'Compensation expectations exceed budget', 'platform', 3),
(NULL, 'Culture fit concerns', 'recruiter_rejected', 'Concerns about alignment with team/company culture', 'platform', 4),
(NULL, 'Failed technical assessment', 'recruiter_rejected', 'Did not pass technical evaluation', 'platform', 5),
(NULL, 'Better qualified candidates', 'recruiter_rejected', 'Other candidates better suited for the role', 'platform', 6),
(NULL, 'Position filled', 'recruiter_rejected', 'Role has been filled by another candidate', 'platform', 7),
(NULL, 'Unresponsive', 'recruiter_rejected', 'Candidate did not respond to outreach', 'platform', 8);

-- "They Rejected Us" reasons
INSERT INTO public.rejection_reasons (tenant_id, name, category, description, source, display_order) VALUES
(NULL, 'Accepted another offer', 'candidate_declined', 'Candidate accepted a different position', 'platform', 1),
(NULL, 'Salary/compensation', 'candidate_declined', 'Compensation package did not meet expectations', 'platform', 2),
(NULL, 'Role not a fit', 'candidate_declined', 'Candidate felt the role was not right for them', 'platform', 3),
(NULL, 'Location/remote concerns', 'candidate_declined', 'Work location or remote policy issues', 'platform', 4),
(NULL, 'Timing not right', 'candidate_declined', 'Candidate not ready to make a move', 'platform', 5),
(NULL, 'Personal reasons', 'candidate_declined', 'Personal circumstances prevent acceptance', 'platform', 6),
(NULL, 'Counter-offer accepted', 'candidate_declined', 'Candidate accepted counter-offer from current employer', 'platform', 7),
(NULL, 'Company concerns', 'candidate_declined', 'Concerns about company stability, culture, or direction', 'platform', 8);