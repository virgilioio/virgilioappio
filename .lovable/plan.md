## What's happening

Every Stripe delivery is failing at signature verification with:

> HTTP 400 — `Webhook signature verification failed: SubtleCryptoProvider cannot be used in a synchronous context. Use 'await constructEventAsync(...)' instead of 'constructEvent(...)'`

That's why `stripe_webhook_events` is empty: Stripe never gets past the signature check, so our logging code never runs. It's also why the previous tenant (`35nervous@dollicons.com`) needed manual healing — no event has ever been persisted.

### Root cause

`supabase/functions/stripe-webhook/index.ts` line 47 uses the **synchronous** Stripe verifier:

```ts
event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

Stripe's Node SDK relies on Node's sync `crypto` module. In Deno (Supabase Edge Runtime) only the async `SubtleCrypto` is available, so the sync call throws before signature verification even completes. Stripe's SDK explicitly tells us to call `constructEventAsync` in this environment.

## The fix (one-line behavior change, plus safety net)

### 1. `supabase/functions/stripe-webhook/index.ts`
- Replace the sync call with the async one:
  ```ts
  event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  ```
- While we're in the verification block, also log signature failures to `stripe_webhook_events` with `source='webhook'`, `action='signature_failed'`, and the error message, so future signature problems show up in our table instead of being invisible.

### 2. Backfill the missed events
Because Stripe has been getting 400s, it has been retrying (and eventually giving up on) every event since the webhook was last working. After deploy:
- Run the existing `reconcile-stripe-subscriptions` function once manually to heal any tenants whose subscription state drifted while the webhook was broken.
- Spot-check `stripe_webhook_events` to confirm new deliveries are landing with `source='webhook'` and no `error`.

### 3. Smoke test
- From the Stripe Dashboard → Developers → Webhooks → our endpoint → **Send test webhook** (`customer.subscription.updated`). Expect 200 and a new row in `stripe_webhook_events`.

## Out of scope (not changing now)

- Webhook endpoint URL / secret rotation — endpoint is correct.
- The reconciler, admin resync button, and webhook event schema — all already shipped last turn and working; they just never got fed because verification was failing.
- Any other edge function — only `stripe-webhook` uses sync `constructEvent`.

## Risk

Minimal. `constructEventAsync` is the Stripe-sanctioned API for non-Node runtimes and returns the same `Stripe.Event` shape. The rest of the handler is unchanged.
