
-- Table 1: offer_approval_chains (one per job)
CREATE TABLE public.offer_approval_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  is_enabled boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_approval_chains_job_id_unique UNIQUE (job_id)
);

-- Table 2: offer_approval_chain_steps (ordered approvers)
CREATE TABLE public.offer_approval_chain_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.offer_approval_chains(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL,
  step_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_approval_chain_steps_order_unique UNIQUE (chain_id, step_order),
  CONSTRAINT offer_approval_chain_steps_user_unique UNIQUE (chain_id, approver_user_id)
);

-- Indexes
CREATE INDEX idx_offer_approval_chains_org ON public.offer_approval_chains(organization_id);
CREATE INDEX idx_offer_approval_chain_steps_chain ON public.offer_approval_chain_steps(chain_id);

-- Enable RLS
ALTER TABLE public.offer_approval_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_approval_chain_steps ENABLE ROW LEVEL SECURITY;

-- RLS for offer_approval_chains
CREATE POLICY "Recruiters+ can view offer approval chains"
  ON public.offer_approval_chains FOR SELECT
  TO authenticated
  USING (check_org_hierarchy_role_access(organization_id, 'recruiter'));

CREATE POLICY "Admins can insert offer approval chains"
  ON public.offer_approval_chains FOR INSERT
  TO authenticated
  WITH CHECK (check_org_hierarchy_role_access(organization_id, 'admin'));

CREATE POLICY "Admins can update offer approval chains"
  ON public.offer_approval_chains FOR UPDATE
  TO authenticated
  USING (check_org_hierarchy_role_access(organization_id, 'admin'))
  WITH CHECK (check_org_hierarchy_role_access(organization_id, 'admin'));

CREATE POLICY "Admins can delete offer approval chains"
  ON public.offer_approval_chains FOR DELETE
  TO authenticated
  USING (check_org_hierarchy_role_access(organization_id, 'admin'));

-- RLS for offer_approval_chain_steps (join to chain for org access)
CREATE POLICY "Recruiters+ can view offer approval chain steps"
  ON public.offer_approval_chain_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offer_approval_chains c
      WHERE c.id = offer_approval_chain_steps.chain_id
      AND check_org_hierarchy_role_access(c.organization_id, 'recruiter')
    )
  );

CREATE POLICY "Admins can insert offer approval chain steps"
  ON public.offer_approval_chain_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offer_approval_chains c
      WHERE c.id = offer_approval_chain_steps.chain_id
      AND check_org_hierarchy_role_access(c.organization_id, 'admin')
    )
  );

CREATE POLICY "Admins can update offer approval chain steps"
  ON public.offer_approval_chain_steps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offer_approval_chains c
      WHERE c.id = offer_approval_chain_steps.chain_id
      AND check_org_hierarchy_role_access(c.organization_id, 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offer_approval_chains c
      WHERE c.id = offer_approval_chain_steps.chain_id
      AND check_org_hierarchy_role_access(c.organization_id, 'admin')
    )
  );

CREATE POLICY "Admins can delete offer approval chain steps"
  ON public.offer_approval_chain_steps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offer_approval_chains c
      WHERE c.id = offer_approval_chain_steps.chain_id
      AND check_org_hierarchy_role_access(c.organization_id, 'admin')
    )
  );
