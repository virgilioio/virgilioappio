
-- Create offer_field_select_options table (mirrors posting_field_select_options)
CREATE TABLE IF NOT EXISTS public.offer_field_select_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_field_id uuid NOT NULL REFERENCES public.offer_form_fields(id) ON DELETE CASCADE,
  option_value text NOT NULL,
  option_label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ofso_field_id ON public.offer_field_select_options(offer_field_id);

ALTER TABLE public.offer_field_select_options ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can view (same pattern as offer_form_fields)
CREATE POLICY "offer_field_select_options_select" ON public.offer_field_select_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.offer_form_fields f
      WHERE f.id = offer_field_select_options.offer_field_id
        AND (
          f.organization_id IS NULL
          OR EXISTS (
            SELECT 1 FROM members m
            WHERE m.user_id = auth.uid()
              AND m.organization_id = f.organization_id
              AND m.user_status = 'active'
          )
        )
    )
  );

-- ALL: workspace owners can manage
CREATE POLICY "offer_field_select_options_workspace_owner_manage" ON public.offer_field_select_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.offer_form_fields f
      JOIN members m ON m.organization_id = f.organization_id
      WHERE f.id = offer_field_select_options.offer_field_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
        AND m.user_type = 'workspace_owner'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offer_form_fields f
      JOIN members m ON m.organization_id = f.organization_id
      WHERE f.id = offer_field_select_options.offer_field_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
        AND m.user_type = 'workspace_owner'
    )
  );

-- ALL: platform admins can manage
CREATE POLICY "offer_field_select_options_platform_admin" ON public.offer_field_select_options
  FOR ALL USING (get_user_type_secure() = 'platform_admin')
  WITH CHECK (get_user_type_secure() = 'platform_admin');
