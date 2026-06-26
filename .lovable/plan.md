
## Context

Stripe Radar fired an **early fraud warning** (`unauthorized_use_of_card`) on charge `ch_3TfrxLFB3VjcLexI2Ryj5TiW` belonging to `35nervous@dollicons.com` (tenant `42f89a19-bee8-4b44-9cbb-852ac9af70cf`).

What this means in practice:
- The cardholder's bank has told Stripe the card was used without authorization.
- A chargeback is highly likely (Stripe's own data says >80% of EFWs become disputes).
- If the chargeback lands, we lose the $99 + $15 dispute fee and the account is almost certainly a fraud signup.
- Our webhook is **not subscribed** to `radar.early_fraud_warning.created`, so this event never reached our system — we only saw it because you checked Stripe directly.

## Immediate action (this tenant)

1. **Refund the charge proactively** via Stripe (better than eating a chargeback — no $15 fee, no dispute ratio hit).
2. **Suspend the tenant** by setting `tenants.suspended_at` + `suspended_reason = 'fraud_signal'` and `tenant_subscriptions.billing_status = 'suspended'`, locking the workspace.
3. **Cancel the Stripe subscription** so no further invoices are attempted.
4. **Flag the user** so the same email/IP can't re-register without admin review.

I'll do steps 1–3 from a one-shot admin edge function call (`admin-stripe-handle-fraud`) once you approve.

## Going forward (system-wide)

### 1. Subscribe to fraud-signal webhook events

Add these event types to the Stripe webhook endpoint:
- `radar.early_fraud_warning.created` — pre-chargeback fraud alert
- `charge.dispute.created` — actual chargeback filed
- `charge.dispute.closed` — dispute resolved (won/lost)
- `charge.refunded` — track our own refunds

### 2. Extend `stripe-webhook` to handle them

In `supabase/functions/stripe-webhook/index.ts`, add handlers that:

- On `radar.early_fraud_warning.created`:
  - Resolve tenant from the charge's customer.
  - **Auto-refund** the charge (configurable, default ON for EFW).
  - Set `tenant_subscriptions.billing_status = 'fraud_review'` (new enum value).
  - Suspend the tenant (`tenants.suspended_at`, `suspended_reason = 'fraud_signal'`).
  - Cancel the active subscription (`stripe.subscriptions.cancel`).
  - Insert a row into a new `tenant_fraud_signals` table for the audit trail.

- On `charge.dispute.created`:
  - Same suspension flow if not already suspended.
  - Record dispute id, reason, amount.

- On `charge.dispute.closed`:
  - If `status = 'won'` and only fraud signal was the dispute → optionally restore access (require admin confirmation, don't auto-unsuspend).
  - If `lost` → keep suspended, log loss amount.

### 3. New table `tenant_fraud_signals`

Columns:
- `tenant_id`, `signal_type` (`early_fraud_warning` | `dispute` | `manual_flag`)
- `stripe_charge_id`, `stripe_dispute_id`, `fraud_type`, `amount`, `currency`
- `action_taken` (`refunded` | `disputed` | `suspended` | `none`)
- `raw_event` (jsonb), `created_at`

With RLS limiting reads to platform admins.

### 4. Admin UI surfacing

On `SaaSCustomerDetail.tsx`, add a **"Fraud signals"** card that lists rows from `tenant_fraud_signals` with a red banner at the top of the page when any unresolved signal exists. Add a manual **"Suspend for fraud"** and **"Clear flag"** action.

### 5. Onboarding guardrail (optional, ask before building)

Disposable-email domain check (`dollicons.com` and similar) at signup — soft-block with a "verify your work email" step instead of allowing instant trial. Not in scope unless you want it.

## Technical notes

- Stripe SDK call for refund: `stripe.refunds.create({ charge: chargeId, reason: 'fraudulent' })`. Marking `reason: 'fraudulent'` tells Stripe's Radar model and improves our risk score going forward.
- Cancelling the sub: `stripe.subscriptions.cancel(subId, { invoice_now: false, prorate: false })`.
- The webhook handler must remain idempotent — fraud events can be re-sent.
- `radar.early_fraud_warning.created` must be enabled in the Stripe Dashboard endpoint settings; we can't subscribe purely from code.

## Open questions

- **Auto-refund on EFW?** Default proposal: yes (safer, avoids dispute fee). Alternative: just suspend + alert and let you review.
- **Auto-cancel subscription?** Default: yes.
- **Do you want the disposable-email guardrail** at signup?
