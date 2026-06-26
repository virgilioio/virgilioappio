# Stripe ↔ Database Reconciliation Plan

## Problem recap
Tenant `42f89a19…` paid on Stripe (active `$99/mo` sub since May 25, last invoice June 8) but our `tenant_subscriptions` row stayed on the expired trial because our `stripe-webhook` never persisted the subscription/invoice events. We unlocked manually. We need to (a) understand why the webhook missed it and (b) ensure no tenant ever stays locked while paying.

## Goals
1. Detect & alert when Stripe and DB disagree.
2. Auto-heal common drift (active sub on Stripe, locked/trial in DB).
3. Make `stripe-webhook` resilient to missed/out-of-order events.
4. Give platform admins a one-click "resync this tenant" tool.

## Workstream 1 — Diagnose the webhook miss (no code, investigation first)
- Check Stripe Dashboard → Developers → Webhooks for the endpoint pointed at `stripe-webhook`:
  - Delivery attempts around **May 25** (subscription created) and **June 8** (invoice paid) for customer `cus_UZw9MO20ayI3ul`.
  - Look for 4xx/5xx responses, signature failures, or "endpoint disabled" notices.
- Check whether multiple Stripe accounts / environments (test vs live) are in play; the customer may have been created on a Stripe account whose webhook isn't wired to this project.
- Confirm `STRIPE_WEBHOOK_SECRET` matches the live endpoint's signing secret.
- Output: a short note in chat with the root cause (or "unknown — recommend periodic sync as safety net").

## Workstream 2 — Periodic reconciliation edge function
New scheduled function **`reconcile-stripe-subscriptions`**:
- Runs every 6h via `pg_cron` + `pg_net` (insert tool, not migration — contains URL + anon key).
- For each tenant in `tenant_subscriptions` where `stripe_customer_id IS NOT NULL`:
  - Fetch active subscriptions from Stripe for that customer.
  - Compare to DB row: `billing_status`, `subscribed`, `stripe_subscription_id`, `current_period_end`, `plan_id`.
  - If Stripe has active sub but DB says `locked`/`trial_expired`/`trialing` past end → update DB to `active`, populate IDs and period end, log to `stripe_webhook_events` with `source='reconciler'`.
  - If Stripe has cancelled/past_due and DB says `active` → flip DB to match.
- Batched (e.g. 50 customers per tick) with cursor in a small `reconciliation_state` table to stay within Stripe rate limits.
- Emits structured logs; failures don't block the batch.

## Workstream 3 — Webhook hardening
Update `stripe-webhook`:
- On every relevant event (`customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`), always fetch the **current** subscription from Stripe (don't trust the event payload alone) and upsert the DB row. This makes the handler idempotent and self-healing against out-of-order delivery.
- Always write to `stripe_webhook_events` (success and failure) with `event_id`, `type`, `customer_id`, `status`, `error`. Add a unique index on `event_id` to dedupe retries.
- On unknown `customer_id` (no matching tenant), log and skip rather than 500 (prevents Stripe disabling the endpoint after repeated failures).

## Workstream 4 — Admin "Resync tenant" action
- Promote the existing `admin-stripe-customer-lookup` into the admin UI:
  - Add a **Resync from Stripe** button on the SaaS customer detail view (platform-admin only).
  - Calls a new `admin-stripe-resync-tenant` function that runs the same reconcile logic for a single tenant and returns the diff.
- No new tables required.

## Workstream 5 — Observability
- Add a simple admin dashboard tile: "Tenants with Stripe/DB drift in last 24h" sourced from `stripe_webhook_events` where `source='reconciler' AND action='healed'`.
- Optional: email platform admins if drift count > N in a single run.

## Rollout order
1. WS1 investigation (immediate, manual).
2. WS3 webhook hardening (low risk, fixes future events).
3. WS2 periodic reconciler (safety net for past + future).
4. WS4 admin button (quality of life).
5. WS5 dashboard tile (after a week of reconciler data).

## Out of scope
- Refactoring the billing data model.
- Changing pricing tiers or lock behavior.
- Migrating to Stripe Billing Portal.
