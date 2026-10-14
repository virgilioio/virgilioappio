-- CoreSignal is no longer part of Gio (Allan, 2026-10-14). The credit table and
-- the sourcing preview table were renamed long ago, but their keys, indexes,
-- security rules and the limits trigger still carried the CoreSignal name.
-- Renames only: no data, behaviour or permission changes. Nothing in the app,
-- the edge functions or the database refers to these names.

alter function public.auto_set_coresignal_limits() rename to auto_set_sourcing_credit_limits;
alter trigger trg_auto_set_coresignal_limits on public.sourcing_credits_usage
  rename to trg_auto_set_sourcing_credit_limits;

alter table public.sourcing_credits_usage
  rename constraint coresignal_usage_pkey to sourcing_credits_usage_pkey;
alter table public.sourcing_credits_usage
  rename constraint coresignal_usage_tenant_billing_cycle_key to sourcing_credits_usage_tenant_billing_cycle_key;
alter table public.sourcing_credits_usage
  rename constraint coresignal_usage_tenant_cycle_unique to sourcing_credits_usage_tenant_cycle_unique;
alter table public.sourcing_credits_usage
  rename constraint coresignal_usage_tenant_id_fkey to sourcing_credits_usage_tenant_id_fkey;
alter index public.idx_coresignal_usage_tenant rename to idx_sourcing_credits_usage_tenant;
alter index public.idx_coresignal_usage_tenant_cycle rename to idx_sourcing_credits_usage_tenant_cycle;

alter policy "Platform admins can insert CoreSignal usage records" on public.sourcing_credits_usage
  rename to "Platform admins can insert sourcing credit usage records";
alter policy "Platform admins can update CoreSignal usage records" on public.sourcing_credits_usage
  rename to "Platform admins can update sourcing credit usage records";
alter policy "Tenant members can view their tenant's CoreSignal usage" on public.sourcing_credits_usage
  rename to "Tenant members can view their tenant's sourcing credit usage";

alter table public.sourcing_preview_candidates
  rename constraint coresignal_preview_candidates_pkey to sourcing_preview_candidates_pkey;
alter table public.sourcing_preview_candidates
  rename constraint coresignal_preview_candidates_sourcing_project_id_fkey to sourcing_preview_candidates_sourcing_project_id_fkey;
alter index public.idx_coresignal_preview_project rename to idx_sourcing_preview_candidates_project;
