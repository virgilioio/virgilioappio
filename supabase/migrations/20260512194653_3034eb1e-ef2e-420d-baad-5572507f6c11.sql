
-- =========================
-- deal_stages
-- =========================
CREATE TABLE public.deal_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text,
  stage_type text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_stages_tenant ON public.deal_stages(tenant_id, position);

ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_stages tenant select"
  ON public.deal_stages FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));
CREATE POLICY "deal_stages tenant insert"
  ON public.deal_stages FOR INSERT TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));
CREATE POLICY "deal_stages tenant update"
  ON public.deal_stages FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));
CREATE POLICY "deal_stages tenant delete"
  ON public.deal_stages FOR DELETE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER trg_deal_stages_updated_at
  BEFORE UPDATE ON public.deal_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- deals
-- =========================
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  title text NOT NULL,
  amount numeric(14,2),
  currency text NOT NULL DEFAULT 'USD',
  owner_id uuid,
  stage_id uuid REFERENCES public.deal_stages(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  expected_close_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deals_tenant ON public.deals(tenant_id);
CREATE INDEX idx_deals_stage ON public.deals(stage_id, position);
CREATE INDEX idx_deals_org ON public.deals(organization_id);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals tenant select"
  ON public.deals FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));
CREATE POLICY "deals tenant insert"
  ON public.deals FOR INSERT TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));
CREATE POLICY "deals tenant update"
  ON public.deals FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));
CREATE POLICY "deals tenant delete"
  ON public.deals FOR DELETE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER trg_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- deal_notes
-- =========================
CREATE TABLE public.deal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  author_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deal_notes_deal ON public.deal_notes(deal_id, created_at DESC);

ALTER TABLE public.deal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_notes tenant select"
  ON public.deal_notes FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));
CREATE POLICY "deal_notes tenant insert"
  ON public.deal_notes FOR INSERT TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id) AND author_id = auth.uid());
CREATE POLICY "deal_notes author update"
  ON public.deal_notes FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id) AND author_id = auth.uid())
  WITH CHECK (public.user_has_tenant_access(tenant_id) AND author_id = auth.uid());
CREATE POLICY "deal_notes author delete"
  ON public.deal_notes FOR DELETE TO authenticated
  USING (public.user_has_tenant_access(tenant_id) AND author_id = auth.uid());

CREATE TRIGGER trg_deal_notes_updated_at
  BEFORE UPDATE ON public.deal_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- Seed default stages helper
-- Callable from the client; idempotent per tenant.
-- =========================
CREATE OR REPLACE FUNCTION public.ensure_default_deal_stages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid;
  v_count integer;
BEGIN
  v_tenant := public.get_user_tenant_id();
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_count FROM public.deal_stages WHERE tenant_id = v_tenant;
  IF v_count > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.deal_stages (tenant_id, name, position, stage_type, color) VALUES
    (v_tenant, 'New', 0, 'open', 'hsl(220 70% 55%)'),
    (v_tenant, 'Qualified', 1, 'open', 'hsl(260 60% 60%)'),
    (v_tenant, 'Proposal', 2, 'open', 'hsl(35 90% 55%)'),
    (v_tenant, 'Negotiation', 3, 'open', 'hsl(15 85% 55%)'),
    (v_tenant, 'Won', 4, 'won', 'hsl(140 60% 45%)'),
    (v_tenant, 'Lost', 5, 'lost', 'hsl(0 70% 55%)');
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_deal_stages() TO authenticated;
