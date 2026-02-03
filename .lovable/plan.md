
# Fix: Admin Credit Assignments Should Override Trial Limits

## Problem Identified

When you assign 200 credits to Motive via the SaaS Customer profile, the database correctly stores 200 credits. However, the frontend still displays only 5 credits.

### Current Data State

| Field | Value |
|-------|-------|
| Database `collect_credits_limit` | 200 (correct) |
| `billing_status` | trialing |
| Frontend displayed | 5 (wrong) |

### Root Cause

The recent fix introduced this logic:

```typescript
// Lines 117-119 in useSourcingCredits.ts
const collectLimit = isTrialing
  ? Math.min(calculatedLimit, databaseLimit || calculatedLimit)  // BUG: caps at 5
  : Math.max(calculatedLimit, databaseLimit)
```

For trial users, `Math.min(5, 200) = 5` - the admin's override is being ignored.

## Solution

Change the logic so that:
- **If admin assigned credits** (database limit > default trial limit): respect the override
- **If no admin assignment**: use the default trial limit of 5

```typescript
// Fixed logic
const calculatedLimit = isTrialing 
  ? 5 
  : seatQuantity * (isAnnual ? 120 : 100)

const databaseLimit = data?.collect_credits_limit || 0

// Admin overrides should ALWAYS win - use Math.max for both cases
// This respects manual credit assignments regardless of billing status
const collectLimit = Math.max(calculatedLimit, databaseLimit)
```

This reverts to using `Math.max` for all users, which means:
- Trial user with no admin override: `Math.max(5, 0) = 5`
- Trial user with admin override of 200: `Math.max(5, 200) = 200`
- Paid user with 2 seats: `Math.max(200, 200) = 200`

## File Change

| File | Change |
|------|--------|
| `src/hooks/useSourcingCredits.ts` | Replace `Math.min` with `Math.max` for trial users |

## Expected Result

After the fix, Motive will see **200 credits** (the admin-assigned value) instead of 5.

| Before Fix | After Fix |
|-----------|-----------|
| 5 credits displayed | 200 credits displayed |
| "Limit reached" errors | Full access to assigned credits |
