# Phase 2, Cycle 2 — SaaS Admin/Owner Enhancements

**Date**: 2025-01-04  
**Status**: ✅ COMPLETE  
**Objective**: Make SaaS Admin & Owner flows functional with suspend/restore, trial management, and billing portal integration

---

## Implementation Summary

### 1. Database Migration ✅
**File**: `supabase/migrations/[timestamp]_add_saas_admin_fields.sql`

Added three new columns to `organizations` table:
- `trial_end_date` (TIMESTAMPTZ) - Tracks when trial period ends
- `suspended_at` (TIMESTAMPTZ) - Audit timestamp for suspension
- `suspended_reason` (TEXT) - Admin-provided reason for suspension

Added indexes:
- `idx_organizations_trial_end` - Partial index for active trials
- `idx_organizations_suspended` - Partial index for suspended orgs

**RLS Impact**: None - Platform admins can already update organizations table.

---

## 2. Admin Mutations Hook ✅
**File**: `src/hooks/useSaaSAdminActions.ts`

Three React Query mutations implemented:

### `useSuspendOrganization({ orgId, reason })`
- Sets `status='suspended'`, `suspended_at=now()`, `suspended_reason=reason`
- Invalidates: `['saas-customers']`, `['saas-customer', orgId]`
- Toast on success/error

### `useRestoreOrganization({ orgId })`
- Sets `status='active'`, clears `suspended_at` and `suspended_reason`
- Invalidates: `['saas-customers']`, `['saas-customer', orgId]`
- Toast on success/error

### `useExtendTrial({ orgId, newEndDate })`
- Sets `trial_end_date=newEndDate`, `status='trialing'`
- Invalidates: `['saas-customers']`, `['saas-customer', orgId]`
- Toast on success/error

**Patterns Used**:
- `withAuthRetry()` for automatic 401 refresh
- `extractErrorMessage()` for human-readable errors
- `logger` for dev debugging
- Proper React Query invalidation

---

## 3. Admin Dialogs ✅

### `src/components/settings/SuspendOrganizationDialog.tsx`
- Controlled dialog with required reason field
- Validation: Non-empty reason required
- Pending state handling
- Destructive variant for confirmation

### `src/components/settings/ExtendTrialDialog.tsx`
- Date input with min=today validation
- Smart defaults: +14d if trial exists, else +30d
- Shows current trial end date
- Confirmation flow

---

## 4. Admin UI Integration ✅

### `src/pages/settings/saas-customers/SaaSCustomersList.tsx`
**Changes**:
- Added suspend dialog state and component
- Wired "Suspend Account" dropdown item → opens dialog
- On confirm → calls `useSuspendOrganization.mutate()`
- Disabled for already-suspended orgs

### `src/pages/settings/saas-customers/SaaSCustomerDetail.tsx`
**Changes**:
- Added suspension banner showing reason and date
- Wired "Suspend Account" button (Settings tab)
- Wired "Restore Account" button (Settings tab)
- Wired "Extend Trial Period" button
- Both dialogs with proper pending states

**UI Improvements**:
- Suspension banner shows `suspended_reason` and `suspended_at`
- Conditional button states (suspend vs restore)
- Pending indicators on all buttons

---

## 5. Owner Billing Actions ✅
**File**: `src/hooks/useBillingPortal.ts`

### `useOpenBillingPortal()`
- Invokes `customer-portal` edge function
- On success: Opens Stripe portal in new tab (`window.open`)
- On error: Shows helpful toast (config vs. access errors)

### `useCreateCheckout({ interval })`
- Invokes `create-checkout` edge function
- On success: Redirects to Stripe checkout (`window.location.href`)
- On error: Shows helpful toast (config vs. access errors)

**Graceful Handling**:
- Detects "not available" / "not configured" errors
- Shows specific message for missing Stripe config
- UI stays responsive on all errors

---

## 6. Owner UI Integration ✅
**File**: `src/pages/settings/saas-customers/SaaSSubscription.tsx`

**Changes**:
- Imported `useOpenBillingPortal` and `useCreateCheckout`
- Wired "Manage Billing" button → `openPortalMutation.mutate()`
- Wired "Upgrade Plan" button → `createCheckoutMutation.mutate({ interval: 'month' })`
- Enhanced suspension banner to show `suspended_reason`
- Added pending states to all buttons

**Disabled States**:
- Upgrade disabled when suspended
- Billing portal disabled when no `billing_id`
- Buttons show "Loading..." / "Opening..." during mutations

---

## 7. Type Updates ✅
**File**: `src/hooks/useSaaSCustomer.ts`

Updated `SaaSCustomerDetail` interface:
```typescript
trial_end_date: string | null
suspended_at: string | null
suspended_reason: string | null
```

---

## 8. Optional: Stripe Readiness Hook ✅
**File**: `src/hooks/useStripeConfigured.ts`

Lightweight runtime check:
- Calls `check-subscription` edge function
- Returns boolean (configured/not configured)
- 5-minute cache
- No retry on failure (likely means not configured)

**Not wired into UI yet** - can be added later for banner warnings.

---

## Files Created (8)
1. `supabase/migrations/[timestamp]_add_saas_admin_fields.sql`
2. `src/hooks/useSaaSAdminActions.ts`
3. `src/hooks/useBillingPortal.ts`
4. `src/hooks/useStripeConfigured.ts`
5. `src/components/settings/SuspendOrganizationDialog.tsx`
6. `src/components/settings/ExtendTrialDialog.tsx`
7. `docs/migrations/phase2-cycle2-IMPLEMENTATION.md` (this file)

## Files Modified (4)
1. `src/pages/settings/saas-customers/SaaSCustomersList.tsx`
2. `src/pages/settings/saas-customers/SaaSCustomerDetail.tsx`
3. `src/pages/settings/saas-customers/SaaSSubscription.tsx`
4. `src/hooks/useSaaSCustomer.ts`

---

## Verification Checklist

### Admin Flow ✅
- [x] Suspend org → list badge shows "suspended"
- [x] Suspend org → detail page shows banner with reason
- [x] Restore org → status returns to "active"
- [x] Extend trial (+14d) → new date visible in UI
- [x] All mutations use `withAuthRetry` (401 refresh works)
- [x] Error toasts show human-readable messages

### Owner Flow ✅
- [x] "Manage Billing" opens Stripe portal in new tab (when configured)
- [x] "Upgrade Plan" redirects to Stripe checkout (when configured)
- [x] Suspension banner shows reason and helpful message
- [x] Buttons disabled appropriately (suspended, no billing_id, pending)
- [x] Graceful handling when Stripe not configured

### Code Quality ✅
- [x] React Query mutations with proper invalidations
- [x] Consistent error handling patterns
- [x] Logger used for debugging
- [x] No console errors
- [x] TypeScript types updated
- [x] Feature flag (`saas_customers_enabled`) still controls admin path

---

## Security Notes

**RLS**: No new RLS policies required. Platform admins already have update access to `organizations` table via existing policies.

**Feature Flag**: Admin SaaS features continue to be gated by `saas_customers_enabled` platform flag.

**Stripe Security**: Edge functions handle secrets server-side. No Stripe keys in client code.

---

## Known Limitations

1. **"Change Plan" workflow** - Not implemented in this cycle (button is stub)
2. **"Cancel Subscription"** - Not implemented (removed from Owner UI)
3. **Trial countdown timer** - Uses static date display, not live countdown
4. **Stripe banner** - `useStripeConfigured` hook created but not wired to show banner yet

---

## Next Steps (Future Cycles)

1. Implement "Change Plan" admin workflow
2. Add trial countdown timer component
3. Wire `useStripeConfigured` to show configuration warnings
4. Add activity tracking for usage metrics
5. Implement member management in SaaS detail view

---

## Exit Criteria — ACHIEVED ✅

✅ Admin can suspend/restore orgs  
✅ Admin can extend trial dates  
✅ Owner can open billing portal  
✅ Owner can start upgrade checkout  
✅ UI reflects suspended/trial states  
✅ All mutations go through React Query  
✅ No RLS/security regressions  
✅ Graceful Stripe-not-configured handling

**Phase 2, Cycle 2 — COMPLETE** 🎉
