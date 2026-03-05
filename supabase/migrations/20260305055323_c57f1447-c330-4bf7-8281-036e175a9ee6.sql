
-- Create offer_approval_requests table
CREATE TABLE public.offer_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_letter_id uuid NOT NULL REFERENCES public.offer_letters(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  current_step_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_approval_requests_offer_letter_unique UNIQUE (offer_letter_id)
);

-- Create offer_approval_request_steps table
CREATE TABLE public.offer_approval_request_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.offer_approval_requests(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL,
  step_order integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offer_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_approval_request_steps ENABLE ROW LEVEL SECURITY;

-- RLS for offer_approval_requests: SELECT for org members with recruiter+ access
CREATE POLICY "Org members can view approval requests"
  ON public.offer_approval_requests
  FOR SELECT
  TO authenticated
  USING (public.check_org_hierarchy_role_access(organization_id, 'interviewer'));

-- INSERT for recruiters+
CREATE POLICY "Recruiters can create approval requests"
  ON public.offer_approval_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_org_hierarchy_role_access(organization_id, 'recruiter')
    AND requested_by = auth.uid()
  );

-- UPDATE for recruiters+ (to advance current_step_order and status)
CREATE POLICY "Recruiters and approvers can update approval requests"
  ON public.offer_approval_requests
  FOR UPDATE
  TO authenticated
  USING (public.check_org_hierarchy_role_access(organization_id, 'interviewer'));

-- RLS for offer_approval_request_steps: SELECT for org members
CREATE POLICY "Org members can view approval steps"
  ON public.offer_approval_request_steps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offer_approval_requests r
      WHERE r.id = request_id
      AND public.check_org_hierarchy_role_access(r.organization_id, 'interviewer')
    )
  );

-- INSERT for recruiters+ (creating steps when requesting approval)
CREATE POLICY "Recruiters can create approval steps"
  ON public.offer_approval_request_steps
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offer_approval_requests r
      WHERE r.id = request_id
      AND public.check_org_hierarchy_role_access(r.organization_id, 'recruiter')
    )
  );

-- UPDATE only by the approver for their own step
CREATE POLICY "Approvers can update their own steps"
  ON public.offer_approval_request_steps
  FOR UPDATE
  TO authenticated
  USING (approver_user_id = auth.uid());

-- Add updated_at trigger for offer_approval_requests
CREATE OR REPLACE FUNCTION public.update_offer_approval_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_offer_approval_requests_updated_at
  BEFORE UPDATE ON public.offer_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_offer_approval_request_updated_at();
