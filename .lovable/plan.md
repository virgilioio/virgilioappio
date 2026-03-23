

# Fix create-checkout Edge Function — Variable Order Bug

## Root Cause

Line 140 of `supabase/functions/create-checkout/index.ts` references `isNewTrial` to build the `cancel_url`, but `isNewTrial` is declared 5 lines later on line 145. In Deno's strict mode, this causes a `ReferenceError` (temporal dead zone for `const`), which crashes the function with a 500 error. **Every single checkout attempt fails** — banner, billing page, trial activation, BillingGuard, all of them.

## Fix

Move the `isNewTrial` declaration (line 145) to **before** the `cancel_url` assignment (line 140). That's it — one line move.

```
Line 140-145 currently:
  const cancel_url = isNewTrial          ← uses isNewTrial (not yet declared)
    ? `${origin}/trial-activation?canceled=true`
    : `${origin}/billing?canceled=true`;
  const isNewTrial = isTrialStart || ... ← declared here (too late)

Fix:
  const isNewTrial = isTrialStart || subRow2?.billing_status === 'pending_trial';
  const cancel_url = isNewTrial
    ? `${origin}/trial-activation?canceled=true`
    : `${origin}/billing?canceled=true`;
```

## Surfaces Affected (all use the same edge function)
- TrialCountdownBanner ("Subscribe Now")
- BillingGuard lockout screen ("Start Subscription")
- Billing settings page (multiple subscribe/reactivate buttons)
- Trial Activation page ("Start Free Trial")
- SaaS Subscription admin page ("Upgrade Plan")

All will work once the edge function is fixed. No client-side changes needed.

## Files

| File | Change |
|------|--------|
| `supabase/functions/create-checkout/index.ts` | Move `isNewTrial` declaration before `cancel_url` (swap lines 140-145) |

