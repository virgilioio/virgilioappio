
CREATE TABLE public.tenant_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX tenant_notes_tenant_id_created_at_idx ON public.tenant_notes (tenant_id, created_at DESC);

GRANT SELECT, INSERT ON public.tenant_notes TO authenticated;
GRANT ALL ON public.tenant_notes TO service_role;

ALTER TABLE public.tenant_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view tenant notes"
  ON public.tenant_notes FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can insert tenant notes"
  ON public.tenant_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin() AND author_id = auth.uid());
