
-- ============================================================
-- Multi-currency: base currency, FX rates, conversion snapshots
-- ============================================================

-- 1. Currency rates table (daily auto + manual entries)
CREATE TABLE public.currency_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate NUMERIC(18,8) NOT NULL CHECK (rate > 0),
  rate_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto','manual')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX currency_rates_unique
  ON public.currency_rates (tenant_id, base_currency, quote_currency, rate_date, source);
CREATE INDEX currency_rates_lookup
  ON public.currency_rates (tenant_id, base_currency, quote_currency, rate_date DESC);

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read currency rates"
  ON public.currency_rates FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant admins manage currency rates"
  ON public.currency_rates FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- 2. Active overrides
CREATE TABLE public.currency_rate_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate NUMERIC(18,8) NOT NULL CHECK (rate > 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX currency_rate_overrides_lookup
  ON public.currency_rate_overrides (tenant_id, base_currency, quote_currency, effective_from DESC);

ALTER TABLE public.currency_rate_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read overrides"
  ON public.currency_rate_overrides FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant admins manage overrides"
  ON public.currency_rate_overrides FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER currency_rate_overrides_updated_at
  BEFORE UPDATE ON public.currency_rate_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tenant base currency helper
CREATE OR REPLACE FUNCTION public.get_tenant_base_currency(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF((settings->>'base_currency')::text, ''),
    'USD'
  )
  FROM public.tenants
  WHERE id = p_tenant_id;
$$;

-- 4. Conversion function — returns rate, source, date used
CREATE OR REPLACE FUNCTION public.convert_to_base(
  p_tenant_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_date DATE
)
RETURNS TABLE (
  base_amount NUMERIC,
  base_currency TEXT,
  fx_rate NUMERIC,
  fx_rate_date DATE,
  fx_rate_source TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base TEXT;
  v_rate NUMERIC;
  v_date DATE;
  v_source TEXT;
BEGIN
  v_base := public.get_tenant_base_currency(p_tenant_id);

  IF p_amount IS NULL OR p_currency IS NULL THEN
    RETURN QUERY SELECT NULL::NUMERIC, v_base, NULL::NUMERIC, NULL::DATE, NULL::TEXT;
    RETURN;
  END IF;

  -- Same currency
  IF upper(p_currency) = upper(v_base) THEN
    RETURN QUERY SELECT p_amount, v_base, 1::NUMERIC, p_date, 'identity'::TEXT;
    RETURN;
  END IF;

  -- 1) Active manual override
  SELECT o.rate, o.effective_from, 'manual'
    INTO v_rate, v_date, v_source
  FROM public.currency_rate_overrides o
  WHERE o.tenant_id = p_tenant_id
    AND upper(o.base_currency) = upper(v_base)
    AND upper(o.quote_currency) = upper(p_currency)
    AND o.effective_from <= p_date
    AND (o.effective_to IS NULL OR o.effective_to >= p_date)
  ORDER BY o.effective_from DESC
  LIMIT 1;

  -- 2) Most recent auto rate on/before p_date
  IF v_rate IS NULL THEN
    SELECT r.rate, r.rate_date, r.source
      INTO v_rate, v_date, v_source
    FROM public.currency_rates r
    WHERE r.tenant_id = p_tenant_id
      AND upper(r.base_currency) = upper(v_base)
      AND upper(r.quote_currency) = upper(p_currency)
      AND r.rate_date <= p_date
    ORDER BY r.rate_date DESC, r.created_at DESC
    LIMIT 1;
  END IF;

  IF v_rate IS NULL OR v_rate = 0 THEN
    RETURN QUERY SELECT NULL::NUMERIC, v_base, NULL::NUMERIC, NULL::DATE, NULL::TEXT;
    RETURN;
  END IF;

  -- rate is "1 base = X quote" → base_amount = quote_amount / rate
  RETURN QUERY SELECT (p_amount / v_rate)::NUMERIC, v_base, v_rate, v_date, v_source;
END;
$$;

-- 5. Add columns to deals
ALTER TABLE public.deals
  ADD COLUMN base_currency TEXT,
  ADD COLUMN base_amount NUMERIC,
  ADD COLUMN fx_rate NUMERIC(18,8),
  ADD COLUMN fx_rate_date DATE,
  ADD COLUMN fx_rate_source TEXT,
  ADD COLUMN fx_locked_at TIMESTAMPTZ;

-- 6. Add columns to deal_payments
ALTER TABLE public.deal_payments
  ADD COLUMN base_currency TEXT,
  ADD COLUMN base_amount NUMERIC,
  ADD COLUMN fx_rate NUMERIC(18,8),
  ADD COLUMN fx_rate_date DATE,
  ADD COLUMN fx_rate_source TEXT;

-- 7. Trigger: fill deal base_* on insert/update; lock when stage is won/lost
CREATE OR REPLACE FUNCTION public.deals_fill_base_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_type TEXT;
  v_should_lock BOOLEAN := FALSE;
  v_conv RECORD;
BEGIN
  -- Determine if deal is in a closed stage
  IF NEW.stage_id IS NOT NULL THEN
    SELECT stage_type INTO v_stage_type FROM public.deal_stages WHERE id = NEW.stage_id;
    IF v_stage_type IN ('won','lost') THEN
      v_should_lock := TRUE;
    END IF;
  END IF;

  -- If already locked and amount/currency unchanged on UPDATE, keep snapshot
  IF TG_OP = 'UPDATE'
     AND OLD.fx_locked_at IS NOT NULL
     AND OLD.amount IS NOT DISTINCT FROM NEW.amount
     AND OLD.currency IS NOT DISTINCT FROM NEW.currency THEN
    NEW.base_currency := OLD.base_currency;
    NEW.base_amount := OLD.base_amount;
    NEW.fx_rate := OLD.fx_rate;
    NEW.fx_rate_date := OLD.fx_rate_date;
    NEW.fx_rate_source := OLD.fx_rate_source;
    NEW.fx_locked_at := OLD.fx_locked_at;
    -- Lock state may need to update if newly closed
    IF v_should_lock AND NEW.fx_locked_at IS NULL THEN
      NEW.fx_locked_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- Compute conversion at today
  SELECT * INTO v_conv FROM public.convert_to_base(NEW.tenant_id, NEW.amount, NEW.currency, CURRENT_DATE);
  NEW.base_currency := v_conv.base_currency;
  NEW.base_amount := v_conv.base_amount;
  NEW.fx_rate := v_conv.fx_rate;
  NEW.fx_rate_date := v_conv.fx_rate_date;
  NEW.fx_rate_source := v_conv.fx_rate_source;

  IF v_should_lock THEN
    NEW.fx_locked_at := COALESCE(NEW.fx_locked_at, now());
  ELSE
    NEW.fx_locked_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER deals_fill_base_amount_trg
  BEFORE INSERT OR UPDATE OF amount, currency, stage_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_fill_base_amount();

-- 8. Trigger: freeze deal_payments fx at insert; never recompute on update
CREATE OR REPLACE FUNCTION public.deal_payments_fill_base_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_date DATE;
BEGIN
  v_date := COALESCE(NEW.paid_at::DATE, CURRENT_DATE);
  SELECT * INTO v_conv FROM public.convert_to_base(NEW.tenant_id, NEW.amount, NEW.currency, v_date);
  NEW.base_currency := v_conv.base_currency;
  NEW.base_amount := v_conv.base_amount;
  NEW.fx_rate := v_conv.fx_rate;
  NEW.fx_rate_date := v_conv.fx_rate_date;
  NEW.fx_rate_source := v_conv.fx_rate_source;
  RETURN NEW;
END;
$$;

CREATE TRIGGER deal_payments_fill_base_amount_trg
  BEFORE INSERT ON public.deal_payments
  FOR EACH ROW EXECUTE FUNCTION public.deal_payments_fill_base_amount();

-- 9. Recompute helper for open deals (called after rate change / override)
CREATE OR REPLACE FUNCTION public.recompute_open_deals_base(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_deal RECORD;
  v_conv RECORD;
BEGIN
  FOR v_deal IN
    SELECT d.id, d.tenant_id, d.amount, d.currency
    FROM public.deals d
    WHERE d.fx_locked_at IS NULL
      AND (p_tenant_id IS NULL OR d.tenant_id = p_tenant_id)
  LOOP
    SELECT * INTO v_conv FROM public.convert_to_base(v_deal.tenant_id, v_deal.amount, v_deal.currency, CURRENT_DATE);
    UPDATE public.deals
       SET base_currency = v_conv.base_currency,
           base_amount = v_conv.base_amount,
           fx_rate = v_conv.fx_rate,
           fx_rate_date = v_conv.fx_rate_date,
           fx_rate_source = v_conv.fx_rate_source
     WHERE id = v_deal.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
