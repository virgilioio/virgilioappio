ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS source text;
CREATE INDEX IF NOT EXISTS idx_deals_tenant_won_at ON public.deals(tenant_id, won_at);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_created_at ON public.deals(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_stage ON public.deals(tenant_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deal_payments_tenant_paid_at ON public.deal_payments(tenant_id, paid_at);