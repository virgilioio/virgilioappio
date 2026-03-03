
-- Create offer_forms table
CREATE TABLE public.offer_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'tenant',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_forms ENABLE ROW LEVEL SECURITY;

-- RLS: select - tenant members can view
CREATE POLICY "offer_forms_select" ON public.offer_forms
  FOR SELECT USING (
    (tenant_id IS NULL) OR (tenant_id = get_user_tenant_id())
  );

-- RLS: all - workspace owners can manage
CREATE POLICY "offer_forms_workspace_owner_manage" ON public.offer_forms
  FOR ALL USING (
    (tenant_id = get_user_tenant_id()) AND user_is_workspace_owner_in_tenant(tenant_id)
  ) WITH CHECK (
    (tenant_id = get_user_tenant_id()) AND user_is_workspace_owner_in_tenant(tenant_id)
  );

-- Create offer_form_fields table
CREATE TABLE public.offer_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.offer_forms(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type public.field_type NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  placeholder_text text,
  help_text text,
  accepted_file_types text,
  max_file_size_mb integer,
  organization_id uuid REFERENCES public.organizations(id),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_form_fields ENABLE ROW LEVEL SECURITY;

-- RLS: select - org members can view
CREATE POLICY "offer_form_fields_select" ON public.offer_form_fields
  FOR SELECT USING (
    (organization_id IS NULL) OR (EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = offer_form_fields.organization_id
        AND m.user_status = 'active'
    ))
  );

-- RLS: all - workspace owners can manage
CREATE POLICY "offer_form_fields_workspace_owner_manage" ON public.offer_form_fields
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = offer_form_fields.organization_id
        AND m.user_status = 'active'
        AND m.user_type = 'workspace_owner'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = offer_form_fields.organization_id
        AND m.user_status = 'active'
        AND m.user_type = 'workspace_owner'
    )
  );

-- Alter offer_letters: make template_id and content nullable, add form_id
ALTER TABLE public.offer_letters
  ALTER COLUMN template_id DROP NOT NULL,
  ALTER COLUMN content DROP NOT NULL,
  ADD COLUMN form_id uuid REFERENCES public.offer_forms(id);

-- Updated_at triggers
CREATE TRIGGER update_offer_forms_updated_at
  BEFORE UPDATE ON public.offer_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offer_form_fields_updated_at
  BEFORE UPDATE ON public.offer_form_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
