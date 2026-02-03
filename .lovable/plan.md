
# Fix: Frontend Credit Display Should Respect Trial Limits

## Problem

The frontend shows **100 credits** while the backend enforces **5 credits** for trial users, causing confusion when users hit the 429 error.

### Data Mismatch

| Layer | Credit Limit | Source |
|-------|-------------|--------|
| Database (`sourcing_credits_usage`) | 5 | Correct (set by `get_tenant_credit_limits`) |
| Backend (edge function) | 5 | Correct (reads from DB) |
| Frontend (displayed to user) | 100 | **WRONG** (ignores trial status) |

### Root Cause in `useSourcingCredits.ts`

```typescript
// Lines 103-112 - The bug
const creditsPerSeat = isAnnual ? 120 : 100
const calculatedLimit = seatQuantity * creditsPerSeat  // Always 100 for 1 seat

// This MAX logic causes trial users to see 100 instead of 5
const collectLimit = Math.max(calculatedLimit, databaseLimit)
```

The frontend calculates credits purely from `seat_quantity` and `billing_interval`, completely ignoring `billing_status = 'trialing'`.

## Solution

Modify `useSourcingCredits.ts` to respect trial status when calculating the displayed limit.

### Logic Change

```typescript
// BEFORE (broken):
const creditsPerSeat = isAnnual ? 120 : 100
const calculatedLimit = seatQuantity * creditsPerSeat
const collectLimit = Math.max(calculatedLimit, databaseLimit)

// AFTER (fixed):
const isTrialing = subscription.billing_status === 'trialing'

// Trial users get fixed 5 credits, paid users get per-seat calculation
const calculatedLimit = isTrialing 
  ? 5  // Trial limit (matches get_tenant_credit_limits)
  : seatQuantity * (isAnnual ? 120 : 100)

// For paid users, allow manual overrides via Math.max
// For trial users, use the lower of calculated or DB (no inflated display)
const collectLimit = isTrialing
  ? Math.min(calculatedLimit, databaseLimit || calculatedLimit)
  : Math.max(calculatedLimit, databaseLimit)
```

This ensures:
1. **Trial users** see the real 5 credit limit
2. **Paid users** still benefit from admin overrides (Math.max behavior preserved)
3. The frontend and backend are now in sync

## File to Modify

| File | Change |
|------|--------|
| `src/hooks/useSourcingCredits.ts` | Add trial-aware credit calculation |

## Result After Fix

For the Motive tenant (`billing_status = 'trialing'`):

| Display | Before Fix | After Fix |
|---------|-----------|-----------|
| Credit indicator | 100 credits | 5 credits |
| Usage bar | 5% full | 100% full (with warning) |
| User expectation | Plenty left | "Limit reached" |

The user will now see accurate credit availability and understand why collection is blocked.
