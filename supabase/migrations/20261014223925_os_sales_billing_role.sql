-- People & Access: Gio Sales has a Billing role (Allan, 2026-10-14).
--
-- Gio Sales added `billing` (F&A: the Billing page only) in its migration
-- 20261014222047_billing_role. People & Access learns the role name, and the
-- F&A job role now grants it, so picking F&A gives someone Gio Sales Billing.
-- Nobody holds the F&A job role yet, so no existing grant changes.

update public.os_apps
set roles = array['billing', 'read_only', 'rep', 'admin', 'owner']
where key = 'sales';

update public.os_bundles
set grants = '[{"app":"sales","role":"billing"},{"app":"docs","role":"member"}]'::jsonb,
    updated_at = now()
where name = 'F&A'
  and tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
  and archived_at is null;
