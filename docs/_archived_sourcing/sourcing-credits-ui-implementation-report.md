# Sourcing Credits UI & Wiring — Implementation Report

**Date**: 2025  
**Status**: ✅ Complete (UI + Stripe Integration)  
**CoreSignal Integration**: 🚫 Not implemented (as requested)

---

## 1. Components Created

### 1.1 Hook: `src/hooks/useOrgCredits.ts`

**Purpose**: Fetches organization sourcing credits via `get_org_credits` RPC

**API**:
```typescript
const { credits, isLoading, error, refetch } = useOrgCredits();

// credits structure:
{
  search: { remaining: number; limit: number },
  collect: { remaining: number; limit: number },
  lastRefill: string | null,
  nextRefill: string | null
}
```

**Features**:
- Auto-refetches every 60 seconds
- 30-second stale time
- Returns zeros if no credits allocated yet
- Scoped to current organization via `OrgContext`

---

### 1.2 Utility: `src/utils/sourcingCredits.ts`

**Exported Functions**:

```typescript
// Check if search is allowed
canRunExternalSearch({ searchRemaining }): CreditCheck

// Check if collect is allowed
canCollect({ collectRemaining }): CreditCheck

// Get warning level based on percentage
getCreditWarningLevel(remaining, limit): 'none' | 'warning' | 'critical'

// Format refill date for display
formatRefillDate(dateString): string
```

**Disabled Reason Strings**:
- `"No search credits remaining. Contact your administrator to refill credits."`
- `"No collect credits remaining. Contact your administrator to refill credits."`

**Warning Thresholds**:
- **Critical**: 0% remaining (red)
- **Warning**: <20% remaining (yellow)
- **None**: ≥20% remaining

---

### 1.3 Component: `src/components/sourcing/CreditsMeter.tsx`

**Props**:
```typescript
{
  searchCredits: { remaining: number; limit: number };
  collectCredits: { remaining: number; limit: number };
  lastRefill?: string | null;
  nextRefill?: string | null;
  onRefresh?: () => void;
  isLoading?: boolean;
  compact?: boolean; // Header vs full page display
}
```

**Features**:
- **Combined horizontal bar**: `totalRemaining / totalLimit`
- **Dropdown breakdown**: Search and Collect with individual progress bars
- **Color-coded warnings**:
  - 🔴 Red (critical): 0 credits
  - 🟡 Yellow (warning): <20%
  - ⚪ Default: ≥20%
- **Refill dates**: "Last refill" and "Next refill" with smart formatting (e.g., "In 5 days", "Tomorrow")
- **Accessibility**: `aria-live="polite"` on credit value for screen readers
- **Empty state**: Shows "No sourcing credits allocated" if `totalLimit === 0`

**Screenshots**:

#### Healthy State (≥20% remaining)
![CreditsMeter - Healthy](placeholder-healthy.png)
- Combined bar shows green/default color
- Dropdown shows both search and collect breakdowns
- No warning icons

#### Warning State (<20% remaining)
![CreditsMeter - Warning](placeholder-warning.png)
- Yellow warning triangle icon
- Yellow progress bars
- Warning message in dropdown: "⚠️ Running low on credits. Consider refilling soon."

#### Critical State (0 credits)
![CreditsMeter - Critical](placeholder-critical.png)
- Red alert circle icon
- Red progress bars
- Error message: "⚠️ Credits depleted. Contact your administrator to refill."

---

## 2. Integration Points

### 2.1 Global Header: `src/components/layout/Header.tsx`

**Changes**:
- Imported `useOrgCredits` hook and `CreditsMeter` component
- Added conditional rendering:
  ```typescript
  const showCreditsMeter = canViewCandidates && credits && 
    (credits.search.limit > 0 || credits.collect.limit > 0)
  ```
- Meter only shows if:
  - User has `canViewCandidates` permission (sourcing proxy)
  - Credits have been allocated (limit > 0)
- Positioned between `GlobalCreateButton` and `Workspace Switcher`
- Uses `compact` prop for smaller size

**Screenshot**:
![Header with CreditsMeter](placeholder-header.png)

---

### 2.2 Sourcing Step: `src/components/jobs/wizard/SourcingStep.tsx`

**Purpose**: Placeholder step for job creation wizard (content to be filled in later slices)

**Structure**:
```tsx
<SourcingStep jobId="..." jobTitle="Senior React Developer" />
```

**Features**:
- Header with job title (if provided)
- Full-size `CreditsMeter` in top-right
- Placeholder card with "Coming Soon" message
- Loading state with skeleton
- Error state with alert

**Screenshot**:
![Sourcing Step](placeholder-sourcing-step.png)

---

## 3. Hard Stop UX (Stub Implementation)

**Utilities Exported**:
```typescript
import { canRunExternalSearch, canCollect } from '@/utils/sourcingCredits';

// Example usage (for future edge functions):
const searchCheck = canRunExternalSearch({ searchRemaining: 0 });
if (!searchCheck.canProceed) {
  return new Response(
    JSON.stringify({ error: searchCheck.reason }),
    { status: 402 } // Payment Required
  );
}
```

**Disabled States** (ready for reuse):
- Search disabled: `searchRemaining <= 0`
- Collect disabled: `collectRemaining <= 0`
- Both include user-friendly error messages

---

## 4. Stripe Webhook Integration

### 4.1 File Updated: `supabase/functions/stripe-webhook/index.ts`

**Function Modified**: `handlePaymentSucceeded`

**Changes**:
1. After successful payment, fetch tenant subscription tier
2. Map tier to credit limits:
   ```typescript
   const CREDIT_LIMITS = {
     "Basic": { search: 50, collect: 25 },
     "Premium": { search: 150, collect: 75 },
     "Enterprise": { search: 500, collect: 250 },
   };
   ```
3. Call `refill_org_sourcing_credits` RPC with tier-based limits
4. Log success/failure

**Lines Changed**: 202-258 (added 40 lines)

**Error Handling**:
- Wrapped in try-catch to prevent webhook failure if credit refill fails
- Logs errors but continues processing payment success

---

### 4.2 Credit Limits Configuration

**Current Implementation** (hard-coded in webhook):
```typescript
const CREDIT_LIMITS: Record<string, { search: number; collect: number }> = {
  "Basic": { search: 50, collect: 25 },
  "Premium": { search: 150, collect: 75 },
  "Enterprise": { search: 500, collect: 250 },
};
```

**Future: Feature Flag / Environment Variable** (recommended):
```bash
# .env (example)
CREDITS_BASIC_SEARCH=50
CREDITS_BASIC_COLLECT=25
CREDITS_PREMIUM_SEARCH=150
CREDITS_PREMIUM_COLLECT=75
CREDITS_ENTERPRISE_SEARCH=500
CREDITS_ENTERPRISE_COLLECT=250
```

Or store in `platform_settings` table for runtime configuration.

---

## 5. Accessibility Features

### 5.1 ARIA Live Region
```tsx
<span 
  className="font-semibold tabular-nums"
  aria-live="polite"
  aria-atomic="true"
>
  {totalRemaining}/{totalLimit}
</span>
```
- Announces credit changes to screen readers
- Uses `polite` to avoid interrupting user
- `atomic="true"` reads entire value on change

### 5.2 ARIA Labels
```tsx
<Button
  aria-label={`Sourcing credits: ${totalRemaining} of ${totalLimit} remaining`}
>
```
- Provides context for button purpose
- Includes current credit values

### 5.3 Semantic Colors
- Red/yellow warnings use text + icons (not color alone)
- High contrast in both light/dark modes

---

## 6. Testing the Implementation

### 6.1 Test Scenario 1: Fresh Organization (No Credits)
```sql
-- No row in org_credit_usage
SELECT * FROM get_org_credits('68ac2c0e-00fd-419a-afec-bdcfc0d8a558');
-- Returns: []

-- UI shows: "No sourcing credits allocated"
```

### 6.2 Test Scenario 2: Healthy Credits (100/100)
```sql
-- Refill credits
SELECT refill_org_sourcing_credits(
  '68ac2c0e-00fd-419a-afec-bdcfc0d8a558',
  100, -- search
  50   -- collect
);

-- UI shows:
-- - Green/default colors
-- - "150/150" total
-- - No warnings
```

### 6.3 Test Scenario 3: Warning State (15/100)
```sql
-- Consume 85 search credits
SELECT consume_sourcing_credits(
  '68ac2c0e-00fd-419a-afec-bdcfc0d8a558',
  'search',
  85
);

-- UI shows:
-- - Yellow warning triangle
-- - "65/150" total (15 search + 50 collect)
-- - "⚠️ Running low on credits"
```

### 6.4 Test Scenario 4: Critical State (0/100)
```sql
-- Consume all remaining credits
SELECT consume_sourcing_credits(..., 'search', 15);
SELECT consume_sourcing_credits(..., 'collect', 50);

-- UI shows:
-- - Red alert circle
-- - "0/150" total
-- - "⚠️ Credits depleted. Contact your administrator to refill."
```

### 6.5 Test Scenario 5: Stripe Renewal (Auto-Refill)
```bash
# Trigger Stripe test webhook (requires Stripe CLI)
stripe trigger invoice.payment_succeeded \
  --override customer:metadata.tenant_id=68ac2c0e-00fd-419a-afec-bdcfc0d8a558

# Check logs:
# [STRIPE-WEBHOOK] Refilled sourcing credits - {"tenantId":"68...","tier":"Premium","limits":{"search":150,"collect":75}}

# Verify in DB:
SELECT * FROM org_credit_usage WHERE organization_id = '68ac2c0e-00fd-419a-afec-bdcfc0d8a558';
-- Expected: search_remaining=150, collect_remaining=75, last_refill_at=now()
```

---

## 7. Progress Component Enhancement

### File Modified: `src/components/ui/progress.tsx`

**Changes**:
- Added `indicatorClassName` prop to customize indicator color
- Allows per-progress-bar warning colors:
  ```tsx
  <Progress 
    value={percentage} 
    indicatorClassName="bg-destructive" // Red for critical
  />
  ```

**Before**:
```typescript
const Progress = React.forwardRef<..., ComponentPropsWithoutRef<...>>
```

**After**:
```typescript
interface ProgressProps extends ComponentPropsWithoutRef<...> {
  indicatorClassName?: string;
}
const Progress = React.forwardRef<..., ProgressProps>
```

---

## 8. Known Limitations & Future Work

### 8.1 Limitations
- ❌ No CoreSignal integration (as requested)
- ❌ No actual search/collect UI (placeholder only)
- ⚠️ Credit limits hard-coded in Stripe webhook (move to config)
- ⚠️ No admin UI for manual credit refills (use SQL for now)

### 8.2 Future Slices
1. **CoreSignal Integration**:
   - `sourcing-search` edge function
   - `sourcing-collect` edge function
   - Results table with filters
2. **Sourcing Step Content**:
   - Left filter panel (title, location, skills, company)
   - Results table (sortable, paginated)
   - Right-side profile preview drawer
3. **Admin Credit Management**:
   - Platform admin page to manually refill credits
   - Org-level credit history/audit log
4. **Configuration**:
   - Move credit limits to `platform_settings` table
   - Feature flag: `ENABLE_SOURCING_AUTO_REFILL`

---

## 9. File Summary

### Files Created (6)
1. `src/hooks/useOrgCredits.ts` — React Query hook for fetching credits
2. `src/utils/sourcingCredits.ts` — Utility functions for credit checks
3. `src/components/sourcing/CreditsMeter.tsx` — Main credits UI component
4. `src/components/jobs/wizard/SourcingStep.tsx` — Placeholder sourcing step
5. `docs/sourcing-credits-ui-implementation-report.md` — This report

### Files Modified (3)
1. `src/components/layout/Header.tsx` — Added CreditsMeter to global header
2. `src/components/ui/progress.tsx` — Added `indicatorClassName` prop
3. `supabase/functions/stripe-webhook/index.ts` — Auto-refill on payment success

---

## 10. Lovable Final Report Checklist

- [x] **Hook Created**: `useOrgCredits` fetches via RPC, returns structured data
- [x] **Component Created**: `CreditsMeter` with combined bar + dropdown
- [x] **Warning States**: <20% yellow, 0% red, visual + text indicators
- [x] **Accessibility**: aria-live, aria-labels, semantic colors
- [x] **Global Header Integration**: Conditional rendering based on permissions + credits
- [x] **Sourcing Step Placeholder**: Header + CreditsMeter + "Coming Soon" card
- [x] **Hard Stop Utils**: `canRunExternalSearch`, `canCollect` with reason strings
- [x] **Stripe Webhook**: Auto-refill on successful renewal (tier-based limits)
- [x] **Progress Component**: Enhanced with `indicatorClassName` for custom colors
- [x] **Error Handling**: Graceful fallbacks for no credits, API errors
- [x] **Testing Guide**: SQL examples for all credit states
- [x] **Documentation**: Complete implementation report with screenshots (placeholders)
- [x] **No CoreSignal**: As requested, no external provider integration yet

---

## 11. Next Steps

1. **Test webhook locally**:
   ```bash
   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
   stripe trigger invoice.payment_succeeded
   ```

2. **Seed test data**:
   ```sql
   SELECT refill_org_sourcing_credits(
     'your-org-id',
     100, -- search credits
     50   -- collect credits
   );
   ```

3. **Verify UI**:
   - Navigate to `/dashboard` → Check header for CreditsMeter
   - Click meter → Verify dropdown shows breakdown
   - Consume credits via SQL → Verify warning states

4. **Ready for build slices**:
   - ✅ DB foundations complete
   - ✅ UI + wiring complete
   - 🚀 Ready for CoreSignal integration (next slice)

---

**Report Generated**: 2025  
**Status**: ✅ **READY FOR NEXT SLICE (CoreSignal Integration)**
