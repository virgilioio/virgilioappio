
## Goal

Find out what actually happened on Stripe for `35nervous@dollicons.com` (tenant `42f89a19-bee8-4b44-9cbb-852ac9af70cf`, Stripe customer `cus_UZw9MO20ayI3ul`) and unlock their workspace if a real payment exists.

## Why this is needed

- Our DB says: `billing_status = locked`, `subscribed = false`, no `stripe_subscription_id`, trial ended June 8, 2026.
- `stripe_webhook_events` has nothing for this customer after their payment was supposedly made.
- The user reports they submitted a bank account and a payment was received.
- Either (a) Stripe processed it but our webhook never fired/failed, or (b) the payment is still pending/incomplete on Stripe's side. We can't tell without querying Stripe directly.

## Plan

### 1. Create a one-off admin diagnostic edge function: `admin-stripe-customer-lookup`

- Input: `{ tenantId }` or `{ stripeCustomerId }`.
- Auth: require caller to be a `platform_admin` (re-use the same check `saas-customer-metrics` uses).
- Uses `STRIPE_SECRET_KEY` (already configured for the seamless Stripe integration) to call:
  - `stripe.customers.retrieve(customerId)`
  - `stripe.subscriptions.list({ customer, status: 'all', limit: 10 })`
  - `stripe.paymentIntents.list({ customer, limit: 10 })`
  - `stripe.invoices.list({ customer, limit: 10 })`
  - `stripe.checkout.sessions.list({ customer, limit: 5 })`
- Returns a compact summary: customer email, default payment method, each subscription's status/price/current_period_end, recent invoice statuses, recent payment intent statuses.

### 2. Run it for this tenant

I'll invoke the function from the platform admin SaaS Customers page context and report back what Stripe actually shows for `cus_UZw9MO20ayI3ul`.

### 3. Based on the result, do one of:

- **Stripe has an active subscription** → write a migration (or call `admin-manage-subscription` with a `force_sync` action) to set `tenant_subscriptions.stripe_subscription_id`, `subscribed = true`, `subscription_status = 'active'`, `billing_status = 'active'`, and seed `current_period_start/end`. Then investigate why the webhook didn't fire (likely a separate follow-up: check Stripe Dashboard → Developers → Webhooks for delivery failures to our `stripe-webhook` endpoint).
- **Stripe has a payment but no subscription** (e.g. one-off checkout, or subscription in `incomplete`) → surface the exact state to the user so they can decide whether to refund, complete, or convert.
- **Stripe has nothing recent** → the payment the user is referring to didn't land on our Stripe account; ask the user for the Stripe receipt / charge ID so we can trace it.

## Technical details

- New file: `supabase/functions/admin-stripe-customer-lookup/index.ts`.
- Reuses `STRIPE_SECRET_KEY` env var (no new secrets).
- Read-only — does not mutate anything in Stripe or our DB.
- No frontend wiring needed for the diagnostic step; I'll invoke it via the supabase client from this session and report back.
- Any DB unlock in step 3 will be a separate, explicit migration after we know the truth.

## Out of scope

- Building a permanent reconciliation UI in Platform Admin.
- Fixing the webhook delivery gap end-to-end (logged as a follow-up after we confirm there's a gap).
