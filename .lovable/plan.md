

# Bypass Credit Card Wall via Feature Flag

## Approach

Use your existing **feature flag system** to add a `skip_cc_wall` flag. When active, new signups go straight into a 14-day trial (`trialing`) instead of being stuck at `pending_trial`. You can toggle this on/off from your platform admin dashboard without any code changes.

This means:
- **Flag ON** (demo/promo mode): New users skip the credit card page and land directly on the dashboard with a full 14-day trial.
- **Flag OFF** (normal mode): Users see the credit card wall as usual.

You keep full control and can flip it back the moment you're done promoting.

## Changes

### 1. Backend: `supabase/functions/provision-tenant/index.ts`

After tenant creation, check the `skip_cc_wall` feature flag. If active, set `billing_status = 'trialing'` with `trial_started_at = now` and `trial_ends_at = now + 14 days` instead of `pending_trial`.

```
// Pseudocode inside provision-tenant
const { data: skipCCWall } = await supabase.rpc('get_feature_flag', { flag_name_param: 'skip_cc_wall' })

if (skipCCWall) {
  // Start trial immediately, no CC required
  billing_status = 'trialing'
  trial_started_at = new Date()
  trial_ends_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
} else {
  // Normal CC wall flow
  billing_status = 'pending_trial'
}
```

### 2. Frontend: `src/components/auth/BillingGuard.tsx`

No changes needed -- it already allows `trialing` users through. Since the backend sets them to `trialing` directly, they'll never hit the `pending_trial` redirect.

### 3. Database: Add the feature flag

Insert a new row into `platform_feature_flags`:

```sql
INSERT INTO platform_feature_flags (flag_name, is_active, description)
VALUES ('skip_cc_wall', true, 'When active, new signups skip the credit card wall and start a 14-day trial immediately');
```

You can toggle `is_active` to `false` from your admin dashboard whenever you want to re-enable the CC wall.

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/provision-tenant/index.ts` | Check `skip_cc_wall` flag; set `trialing` instead of `pending_trial` when active |
| Database (`platform_feature_flags`) | Insert new `skip_cc_wall` flag row |

## What This Gives You

- **Instant toggle**: Flip it on from admin dashboard before a demo, flip it off after.
- **Real-time**: The flag system uses Postgres realtime, so changes propagate immediately.
- **No code deploys**: Once implemented, toggling is purely a database flag change.
- **Trial still enforced**: Users still get exactly 14 days, and all grace period / lockout logic works normally after the trial expires.

