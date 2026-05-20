
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'purple',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tags_tenant_lower_name_idx ON public.tags (tenant_id, lower(name));
CREATE INDEX tags_tenant_idx ON public.tags(tenant_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view tags" ON public.tags
  FOR SELECT USING (user_has_tenant_access(tenant_id));
CREATE POLICY "Tenant members can create tags" ON public.tags
  FOR INSERT WITH CHECK (user_has_tenant_access(tenant_id) AND tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant members can update tags" ON public.tags
  FOR UPDATE USING (user_has_tenant_access(tenant_id));
CREATE POLICY "Tenant members can delete tags" ON public.tags
  FOR DELETE USING (user_has_tenant_access(tenant_id));

CREATE TRIGGER tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.candidate_tags (
  candidate_id UUID NOT NULL,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  tagged_by UUID,
  tagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, tag_id)
);
CREATE INDEX candidate_tags_tag_idx ON public.candidate_tags(tag_id);
CREATE INDEX candidate_tags_candidate_idx ON public.candidate_tags(candidate_id);
CREATE INDEX candidate_tags_tenant_idx ON public.candidate_tags(tenant_id);

ALTER TABLE public.candidate_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view candidate tags" ON public.candidate_tags
  FOR SELECT USING (user_has_tenant_access(tenant_id));
CREATE POLICY "Tenant members can add candidate tags" ON public.candidate_tags
  FOR INSERT WITH CHECK (user_has_tenant_access(tenant_id));
CREATE POLICY "Tenant members can remove candidate tags" ON public.candidate_tags
  FOR DELETE USING (user_has_tenant_access(tenant_id));

-- Stamp tenant_id and tagged_by from the candidate row, ensuring consistency.
CREATE OR REPLACE FUNCTION public.set_candidate_tag_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.candidates WHERE id = NEW.candidate_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Candidate % not found or has no tenant', NEW.candidate_id;
  END IF;
  NEW.tenant_id := v_tenant;
  IF NEW.tagged_by IS NULL THEN
    NEW.tagged_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER candidate_tags_set_defaults
  BEFORE INSERT ON public.candidate_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_candidate_tag_defaults();
