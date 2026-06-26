# Fix: "Refund + suspend" silently did nothing

## What actually happened
When you clicked **Refund + suspend**, the call returned an error in ~130ms (button flashed "Working…" then back). I verified server-side: tenant `42f89a19…` is still `billing_status = active`, no row was written to `tenant_fraud_signals`, and the `admin-stripe-handle-fraud` edge function has **no log entries** at all. So no refund, no cancel, no suspend — nothing was performed.

## Root causes
1. **Param name mismatch (client ↔ function).** The UI sends snake_case (`tenant_id`, `charge_id`), but the edge function reads camelCase (`tenantId`, `chargeId`). The function therefore returns `400 "tenantId is required"` before doing anything. The toast error likely flew by unnoticed.
2. **Function not registered in `supabase/config.toml`.** `admin-stripe-handle-fraud/index.ts` exists but has no `[functions.admin-stripe-handle-fraud]` block, which is why it has zero logs and may not be reachably deployed.
3. **Minor:** `runAction` also passes a `stripe_customer_id` that the function doesn't read — harmless but confusing.

## Plan

1. **Register the function** in `supabase/config.toml` with `verify_jwt = true` (admin-only, JWT-required, matches `admin-operations` pattern).
2. **Fix the client payload** in `src/pages/settings/saas-customers/SaaSCustomerDetail.tsx` (`runAction`, ~line 1517) to send `tenantId` and `chargeId` (camelCase), matching the edge function contract. Drop the unused `stripe_customer_id`.
3. **Make error feedback louder** — if the function returns a non-2xx, surface the server's `error` message in the toast (currently it falls back to a generic supabase-functions error). Also log the body to console for diagnosis.
4. **Re-run the action** against tenant `42f89a19-bee8-4b44-9cbb-852ac9af70cf` for charge `ch_3TfrxLFB3VjcLexI2Ryj5TiW` and verify:
   - `tenant_subscriptions.billing_status = 'fraud_review'`, `suspended_at` set
   - `tenants.status = 'suspended'`
   - A row in `tenant_fraud_signals` with `action_taken = 'refunded'`
   - Stripe refund + subscription cancellation visible in the Stripe dashboard
   - The fraud-review banner appears in the app header for that tenant

No DB schema changes are needed — the migration adding `tenant_fraud_signals` and the `fraud_review` billing status is already applied.

## Files to edit
- `supabase/config.toml` — add `[functions.admin-stripe-handle-fraud]` block.
- `src/pages/settings/saas-customers/SaaSCustomerDetail.tsx` — fix `runAction` body keys + error toast.

Nothing else changes; the edge function itself, the webhook handler, the banner, and the fraud-signals card are already correct.
