## Goal

Give platform admins two distinct tools on a locked/past_due/canceled tenant:

1. **Extend Trial** (already exists) — keeps the tenant on a real trial.
2. **Grant Access** (new) — temporary unlock for sales / goodwill that is **not** a trial and **auto-reverts to locked** when the end date passes.

Both can be used; they don't replace each other.

## Behavior

- Visible only when `billing_status` is `locked`, `past_due`, or `canceled`. Hidden otherwise.
- Admin picks an end date (required) and types a reason (required).
- Sets `billing_status = 'active'` so `BillingGuard` / `SettingsLockGuard` let the tenant back in, but stores the grant separately so we know it's temporary and non-billable.
- A scheduled job runs hourly; any expired grant flips `billing_status` back to `'locked'` (the same wall they hit before).
- Action is fully audited and surfaced on the customer profile.

## Data model

New table `public.tenant_access_grants` (one active row per tenant at a time, history preserved):

- `tenant_id`, `granted_by` (user id), `reason` (text, required), `starts_at`, `ends_at`, `revoked_at`, `expired_at`, `created_at`.
- Index on `(tenant_id, ends_at)` for the expiry sweep.
- RLS: platform admins only (SELECT/INSERT/UPDATE via `has_role` / `members.user_type = 'platform_admin'`); `service_role` ALL.
- Full GRANTs per project conventions.

No new column on `tenant_subscriptions` — we read the latest non-revoked, non-expired grant for "currently granted" state.

## Edge function

Extend `supabase/functions/admin-manage-subscription/index.ts`:

- New action `grant_access` — params: `endDate` (ISO), `reason` (string, min 5 chars). Validates tenant is currently locked/past_due/canceled. Inserts grant row, sets `billing_status='active'`, clears `suspended_at/suspended_reason`. Audits as `tenant_access_granted`.
- New action `revoke_access` — ends the active grant immediately, flips status back to `'locked'`. Audits as `tenant_access_revoked`.

New edge function `expire-access-grants` (scheduled via `supabase/config.toml` cron, hourly):

- Selects grants where `ends_at <= now()` AND `revoked_at IS NULL` AND `expired_at IS NULL`.
- For each: sets `expired_at = now()`, updates `tenant_subscriptions.billing_status = 'locked'`, writes audit row `tenant_access_grant_expired`.
- Idempotent — safe to re-run.

## Frontend

`src/components/saas/QuickActionsPanel.tsx`:

- When status is locked/past_due/canceled, add **Grant Access** button next to Activate / Restore. Use neutral styling (not green, not red).
- When an active grant exists, swap it for **Revoke Access** + show "Granted until {date}" caption.

New `src/components/settings/GrantAccessDialog.tsx`:

- DatePickerVirgilio (min = tomorrow, default = today + 14 days), required reason textarea, plain `<Button>` submit per the form standard. Helper text: "The tenant regains access until this date. It will revert to locked automatically — this is not a trial."

New hooks in `src/hooks/useSaaSAdminActions.ts`: `useGrantAccess`, `useRevokeAccess` — same shape as `useExtendTrial` / `useSuspendOrganization`.

Surface the active grant on the SaaS customer profile (digest / Health signals area) — a small badge "Access granted until {date} · {reason}" with revoke action — using existing card chrome (no new visuals).

## Out of scope

- No email notification to the tenant when the grant expires (can be added later).
- No "extend grant" path — admin revokes and re-grants if they need a new date.
- No change to Stripe / billing — grants are free, internal-only.

## Technical notes

- Cron registration goes in `supabase/config.toml` under `[functions.expire-access-grants]` with a schedule expression (e.g. `0 * * * *`).
- Grant table uses a `BEFORE INSERT` SECURITY DEFINER trigger to revoke any existing active grant for the same tenant (one active at a time).
- All status mutations go through the edge function — never directly from the client — so audit logging stays consistent.
