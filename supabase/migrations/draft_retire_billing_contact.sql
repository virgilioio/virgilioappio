-- Retire the billing contact (Allan, 2026-10-13).
-- We don't sell the ATS any more, so workspaces don't need a billing contact:
-- the CRM holds that for the companies we bill. The app stopped reading and
-- writing these columns on 2026-10-13 (Organization settings, SaaS customers,
-- saas-customer-metrics). Nothing in the database reads them.
--
-- organizations.billing_poc_updated_by also pointed at auth.users with no
-- cascade rule, which stopped one person's login from being removed.

alter table public.organizations
  drop column billing_poc_additional_email,
  drop column billing_poc_phone,
  drop column billing_poc_updated_by,
  drop column billing_poc_updated_at;

alter table public.tenants
  drop column billing_email,
  drop column billing_contact_name,
  drop column billing_phone,
  drop column billing_address,
  drop column billing_city,
  drop column billing_state,
  drop column billing_postal_code,
  drop column billing_country;
