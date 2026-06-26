## Status

The signature-verification fix from last turn is working. The `invoice.payment_failed` event for `tcundiff@oatesenergy.com` was verified, logged (`action='processed'`), and the tenant was correctly flipped to `billing_status='past_due'`. Stripe's `200 {"received": true}` is the expected ACK.

Three small upgrades remain.

## 1. Backfill `tenant_id` on `stripe_webhook_events`

**Why:** the row written today has `tenant_id = null` even though we resolved the tenant during handling. Filtering events by tenant is currently impossible.

**Webhook patch — `supabase/functions/stripe-webhook/index.ts`**
- Resolve `tenant_id` from `stripe_customer_id` (via `tenant_subscriptions`) as soon as we have the event's customer.
- Pass `tenant_id` into every `stripe_webhook_events` insert path (signature failure already writes; success path needs it added).

**Historical backfill (one-time SQL via insert tool):**
```sql
UPDATE public.stripe_webhook_events e
SET tenant_id = ts.tenant_id
FROM public.tenant_subscriptions ts
WHERE e.tenant_id IS NULL
  AND e.stripe_customer_id IS NOT NULL
  AND ts.stripe_customer_id = e.stripe_customer_id;
```

## 2. Surface `past_due` to the customer (in-app)

**Status:** the amber banner in `HeaderContextBands.tsx` already shows for `past_due`. But its CTA is `Upgrade → /settings?tab=subscription`, which is the wrong action for past_due — they need to **update their card**, not pick a plan.

**Changes — `src/components/layout/HeaderContextBands.tsx`**
- When `pastDue`: change CTA label to **"Update payment method"** and wire it to call the existing `customer-portal` edge function, then `window.location.href = data.url` (same pattern already used in `src/pages/settings/Billing.tsx`).
- Keep the existing `Upgrade` CTA for `trialing` / `gracePeriod` unchanged.
- Make the past_due band non-dismissible (or auto-restore after 24h) — losing access silently is a worse UX than nagging. Smallest change: remove the dismiss button for `pastDue` only.

**Optional small polish — `src/pages/settings/Billing.tsx`**
- If `billing_status === 'past_due'`, surface an inline red banner at the top of the Billing tab with the same "Update payment method" action so users who navigate directly there also see it.

## 3. Backfill the affected tenant's billing visibility

No code change — just verify in the DB that tenant `a6de5ad0-0057-4315-8727-c7279d98e152` shows `past_due` (it does). When they open the app they'll now see the corrected banner; when they click it, the Stripe Customer Portal opens and they can update the card. Stripe will then fire `invoice.payment_succeeded` / `customer.subscription.updated`, our webhook will set them back to `active`, and the banner disappears.

## Out of scope

- No schema migration needed — `stripe_webhook_events.tenant_id` column already exists.
- Not adding an email notification for past_due in this pass (Stripe's Smart Retries + dunning emails already handle that side; we can add an in-app notification later if you want).
- Reconciler / admin resync button — already shipped and unchanged.

## Risk

Low. The webhook patch only adds a field to an existing insert. The banner change reuses the already-deployed `customer-portal` function. The SQL backfill is idempotent.
