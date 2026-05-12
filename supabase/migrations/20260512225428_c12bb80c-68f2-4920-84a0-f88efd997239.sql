
-- ============ deal_invoices ============
CREATE TABLE public.deal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  uploaded_by UUID,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_invoices_deal ON public.deal_invoices(deal_id);
CREATE INDEX idx_deal_invoices_tenant ON public.deal_invoices(tenant_id);

-- Auto-fill tenant_id from parent deal
CREATE OR REPLACE FUNCTION public.set_deal_invoice_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.deals WHERE id = NEW.deal_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_deal_invoice_tenant
BEFORE INSERT ON public.deal_invoices
FOR EACH ROW EXECUTE FUNCTION public.set_deal_invoice_tenant();

ALTER TABLE public.deal_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_invoices tenant select" ON public.deal_invoices
  FOR SELECT USING (public.user_has_tenant_access(tenant_id));
CREATE POLICY "deal_invoices tenant insert" ON public.deal_invoices
  FOR INSERT WITH CHECK (public.user_has_tenant_access(tenant_id));
CREATE POLICY "deal_invoices tenant delete" ON public.deal_invoices
  FOR DELETE USING (public.user_has_tenant_access(tenant_id));

-- ============ deal_payments ============
CREATE TABLE public.deal_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT,
  note TEXT,
  invoice_id UUID REFERENCES public.deal_invoices(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validate positive amount via trigger (avoid CHECK; consistent with project pref)
CREATE OR REPLACE FUNCTION public.validate_deal_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.deals WHERE id = NEW.deal_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_deal_payment
BEFORE INSERT OR UPDATE ON public.deal_payments
FOR EACH ROW EXECUTE FUNCTION public.validate_deal_payment();

CREATE INDEX idx_deal_payments_deal ON public.deal_payments(deal_id);
CREATE INDEX idx_deal_payments_tenant ON public.deal_payments(tenant_id);

ALTER TABLE public.deal_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_payments tenant select" ON public.deal_payments
  FOR SELECT USING (public.user_has_tenant_access(tenant_id));
CREATE POLICY "deal_payments tenant insert" ON public.deal_payments
  FOR INSERT WITH CHECK (public.user_has_tenant_access(tenant_id) AND created_by = auth.uid());
CREATE POLICY "deal_payments author update" ON public.deal_payments
  FOR UPDATE USING (public.user_has_tenant_access(tenant_id) AND created_by = auth.uid())
  WITH CHECK (public.user_has_tenant_access(tenant_id) AND created_by = auth.uid());
CREATE POLICY "deal_payments author delete" ON public.deal_payments
  FOR DELETE USING (public.user_has_tenant_access(tenant_id) AND created_by = auth.uid());

-- ============ Storage bucket: deal-invoices ============
INSERT INTO storage.buckets (id, name, public) VALUES ('deal-invoices', 'deal-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Path layout: {tenant_id}/{deal_id}/{filename}
CREATE POLICY "deal-invoices tenant read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'deal-invoices'
    AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "deal-invoices tenant insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'deal-invoices'
    AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "deal-invoices tenant delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'deal-invoices'
    AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid)
  );
