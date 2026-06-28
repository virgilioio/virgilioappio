
-- 1) Broader recompute for ALL deals + payments (not just open deals)
CREATE OR REPLACE FUNCTION public.recompute_all_deal_bases(p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(deals_updated integer, payments_updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deals INTEGER := 0;
  v_pays INTEGER := 0;
  r RECORD;
  v_conv RECORD;
  v_base TEXT;
BEGIN
  -- Deals: recompute when base_amount IS NULL OR base_currency mismatches tenant base
  FOR r IN
    SELECT d.id, d.tenant_id, d.amount, d.currency, d.created_at, d.won_at, d.lost_at,
           d.base_amount, d.base_currency
    FROM public.deals d
    WHERE (p_tenant_id IS NULL OR d.tenant_id = p_tenant_id)
  LOOP
    v_base := public.get_tenant_base_currency(r.tenant_id);
    IF r.base_amount IS NULL
       OR r.base_currency IS NULL
       OR upper(r.base_currency) <> upper(v_base) THEN
      SELECT * INTO v_conv FROM public.convert_to_base(
        r.tenant_id, r.amount, r.currency,
        COALESCE(r.won_at::date, r.lost_at::date, r.created_at::date, CURRENT_DATE)
      );
      UPDATE public.deals
         SET base_currency = v_conv.base_currency,
             base_amount   = v_conv.base_amount,
             fx_rate       = v_conv.fx_rate,
             fx_rate_date  = v_conv.fx_rate_date,
             fx_rate_source= v_conv.fx_rate_source
       WHERE id = r.id;
      v_deals := v_deals + 1;
    END IF;
  END LOOP;

  -- Payments: same logic
  FOR r IN
    SELECT p.id, p.tenant_id, p.amount, p.currency, p.paid_at, p.created_at,
           p.base_amount, p.base_currency
    FROM public.deal_payments p
    WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
  LOOP
    v_base := public.get_tenant_base_currency(r.tenant_id);
    IF r.base_amount IS NULL
       OR r.base_currency IS NULL
       OR upper(r.base_currency) <> upper(v_base) THEN
      SELECT * INTO v_conv FROM public.convert_to_base(
        r.tenant_id, r.amount, r.currency,
        COALESCE(r.paid_at::date, r.created_at::date, CURRENT_DATE)
      );
      UPDATE public.deal_payments
         SET base_currency  = v_conv.base_currency,
             base_amount    = v_conv.base_amount,
             fx_rate        = v_conv.fx_rate,
             fx_rate_date   = v_conv.fx_rate_date,
             fx_rate_source = v_conv.fx_rate_source
       WHERE id = r.id;
      v_pays := v_pays + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_deals, v_pays;
END;
$$;

-- 2) Ensure payment UPDATEs also refresh base amount when amount/currency change
DROP TRIGGER IF EXISTS deal_payments_fill_base_amount_upd_trg ON public.deal_payments;
CREATE TRIGGER deal_payments_fill_base_amount_upd_trg
BEFORE UPDATE OF amount, currency, paid_at ON public.deal_payments
FOR EACH ROW EXECUTE FUNCTION public.deal_payments_fill_base_amount();

-- 3) One-shot backfill for every tenant
SELECT public.recompute_all_deal_bases(NULL);
