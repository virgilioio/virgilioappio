
-- Drop the table that was partially created (if it exists from failed migration)
DROP TABLE IF EXISTS public.workspace_automations;

-- Create workspace_automations table (generic, future-proof)
CREATE TABLE public.workspace_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  automation_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  subject text,
  body text,
  from_email text,
  config jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, automation_type)
);

-- Enable RLS
ALTER TABLE public.workspace_automations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view workspace automations"
  ON public.workspace_automations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.members
    WHERE members.tenant_id = workspace_automations.tenant_id
      AND members.user_id = auth.uid() AND members.user_status = 'active'
  ));

CREATE POLICY "Members can create workspace automations"
  ON public.workspace_automations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.members
    WHERE members.tenant_id = workspace_automations.tenant_id
      AND members.user_id = auth.uid() AND members.user_status = 'active'
  ));

CREATE POLICY "Members can update workspace automations"
  ON public.workspace_automations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.members
    WHERE members.tenant_id = workspace_automations.tenant_id
      AND members.user_id = auth.uid() AND members.user_status = 'active'
  ));

CREATE POLICY "Members can delete workspace automations"
  ON public.workspace_automations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.members
    WHERE members.tenant_id = workspace_automations.tenant_id
      AND members.user_id = auth.uid() AND members.user_status = 'active'
  ));

-- Updated_at trigger using inline function
CREATE OR REPLACE FUNCTION public.set_workspace_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspace_automations_updated_at
  BEFORE UPDATE ON public.workspace_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_automations_updated_at();
