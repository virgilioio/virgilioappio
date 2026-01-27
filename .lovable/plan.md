
# SaaS Customer Account Creation Flow: Complete Implementation with Edge Cases

## Executive Summary

This plan implements the 14-day credit card wall for new signups, handling edge cases like page refreshes, browser closures, and interrupted flows. All screens will follow the established GoGio style guide.

---

## Current Flow Analysis

### What Exists Today

```text
User Signup → Email Verification → Onboarding (Create Workspace)
                                         ↓
                              provision-tenant sets billing_status: 'pending_trial'
                                         ↓
                              Redirect to /find (PROBLEM: Full access without CC!)
```

### Target Flow

```text
User Signup → Email Verification → Onboarding (Create Workspace)
                                         ↓
                              provision-tenant sets billing_status: 'pending_trial'
                                         ↓
                              Redirect to /trial-activation (CC Wall Page)
                                         ↓
                              Stripe Checkout (14-day trial + CC collection)
                                         ↓
                              Webhook sets billing_status: 'trialing' + grants 20 credits
                                         ↓
                              Redirect to /billing?session_id=XXX → /dashboard
```

---

## Edge Cases & Recovery Mechanisms

### 1. User Leaves During Onboarding (Before Workspace Created)

**Scenario:** User closes browser on the "Create your workspace" screen.

**Current behavior:** No state persisted. User returns, still no tenant.

**Recovery:** Works automatically:
- User returns → RequireAuth detects no org context → Redirects to /onboarding
- User simply enters workspace name again
- Provision-tenant has idempotency check—if workspace exists, returns existing ID

**No change needed.**

---

### 2. User Leaves After Onboarding, Before Stripe Checkout

**Scenario:** Workspace created, but user closes browser before reaching/completing Stripe Checkout.

**Current behavior (BROKEN):** User returns with `pending_trial` status but BillingGuard doesn't block access.

**Fix:**
- BillingGuard must detect `pending_trial` and redirect to `/trial-activation`
- User sees the trial activation page on every login until CC is added

**Implementation:**
```typescript
// BillingGuard.tsx
if (billing?.billing_status === 'pending_trial') {
  return <Navigate to="/trial-activation" replace />
}
```

---

### 3. User Refreshes During Stripe Checkout

**Scenario:** User is on Stripe Checkout page and refreshes.

**Current behavior:** Stripe handles this—checkout session remains valid for 24 hours.

**Recovery:** User stays on Stripe's page. If they close and return:
- They land on `/trial-activation` (thanks to BillingGuard)
- Clicking "Start Free Trial" creates a new checkout session
- Old session expires harmlessly

**No change needed.** Stripe's session-based checkout handles this.

---

### 4. User Completes Checkout But Webhook Fails

**Scenario:** Stripe receives payment, but webhook to update `tenant_subscriptions` fails.

**Current behavior:** User returns to `/billing?session_id=XXX` but status remains `pending_trial`.

**Recovery already exists:**
- User sees "Pending Trial" banner on /billing page
- They can click "Start Free Trial" again—Stripe will recognize existing subscription
- Webhook retry mechanism (Stripe retries for up to 72 hours)

**Enhancement (optional):** Add a "Check subscription status" button that calls `customer-portal` to refresh.

---

### 5. User Closes Browser Mid-Onboarding Animation

**Scenario:** User clicks "Create workspace," sees the `WorkspaceProvisioningLoader`, then closes browser.

**Current behavior:** If provision-tenant completed, tenant exists. If not, nothing was created.

**Recovery:**
- If tenant exists → User returns → RequireAuth sees org context → Normal flow
- If tenant doesn't exist → User returns → RequireAuth sees no org → Back to /onboarding
- Idempotency check in provision-tenant prevents duplicate tenants

**No change needed.**

---

### 6. Browser Back Button from Stripe Checkout

**Scenario:** User clicks browser back button while on Stripe Checkout.

**Current behavior:** Returns to `cancel_url` which is `/billing?canceled=true`.

**Issue:** `/billing` requires org context. For `pending_trial` users, BillingGuard should redirect them.

**Fix:** Stripe's `cancel_url` should be `/trial-activation?canceled=true` instead of `/billing`.

---

### 7. Multiple Browser Tabs / Concurrent Sessions

**Scenario:** User opens signup in two tabs.

**Recovery:** 
- provision-tenant idempotency check prevents duplicate tenants
- Second tab attempting to create workspace will get existing tenant ID
- React Query cache ensures consistent state across components

**No change needed.**

---

### 8. Session Expiry During Checkout

**Scenario:** User's Supabase session expires while on Stripe Checkout (e.g., 1 hour timeout).

**Recovery:**
- Stripe checkout completes successfully (independent of Supabase session)
- Webhook updates database correctly
- User returns to app → Session refresh → `trialing` status detected → Normal access

**No change needed.**

---

## Implementation Plan

### Phase 1: Create Trial Activation Page

**New File: `src/pages/TrialActivation.tsx`**

A dedicated CC wall page following the established auth screen pattern (split layout with graphic).

**Design Elements (Style Guide Compliance):**
- Split layout: Left side with branded graphic, right side with content card
- Background color: `#d7c5fb` (Lilac Frost) matching Login/Signup
- Logo: `<GoGioLogo size="xl" />`
- Typography: Poppins font family, `-0.06em` letter-spacing for headings
- Card: White background, rounded-2xl, shadow-lg
- CTA Button: Primary button with `h-12` height
- Icons: Lucide icons (Check, CreditCard, Sparkles)

**Key Features:**
- Value proposition with trial benefits list
- Clear "14 days free, then $99/seat/month" messaging
- Primary CTA: "Start Free Trial" → Stripe Checkout
- Secondary: "Not ready? Sign out" link
- Auto-redirect if user is already trialing/active

**Code Structure:**
```typescript
export default function TrialActivation() {
  const { data: billing, isLoading } = useBillingStatus()
  const createCheckout = useCreateCheckout()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [searchParams] = useSearchParams()
  const wasCanceled = searchParams.get('canceled') === 'true'
  
  // If already trialing or active, redirect
  useEffect(() => {
    if (billing && ['trialing', 'active'].includes(billing.billing_status)) {
      navigate('/dashboard', { replace: true })
    }
  }, [billing, navigate])
  
  // Render CC wall UI
}
```

---

### Phase 2: Update BillingGuard

**File: `src/components/auth/BillingGuard.tsx`**

Add `pending_trial` detection to redirect users to the activation page.

**Changes:**
```typescript
// After platform admin and role checks, before isBlocked calculation

// Redirect pending_trial users to trial activation page
if (billing?.billing_status === 'pending_trial') {
  return <Navigate to="/trial-activation" replace />
}
```

This ensures users cannot bypass the CC wall, even if they navigate directly to protected routes.

---

### Phase 3: Update Onboarding Page

**File: `src/pages/Onboarding.tsx`**

1. **Fix incorrect copy (line 342):**
   - Current: "30‑day free trial, no card needed"
   - Updated: "14-day free trial with credit card"

2. **Change redirect destination (line 158):**
   - Current: `navigate('/find', { replace: true })`
   - Updated: `navigate('/trial-activation', { replace: true })`

3. **Remove first-run session storage flag** (line 155):
   - Move `virgilio_first_run` flag setting to post-trial-activation

---

### Phase 4: Update Stripe Checkout URLs

**File: `supabase/functions/create-checkout/index.ts`**

Update `cancel_url` for pending_trial users:

```typescript
const isNewTrial = isTrialStart || subRow2?.billing_status === 'pending_trial';

const cancel_url = isNewTrial 
  ? `${origin}/trial-activation?canceled=true`
  : `${origin}/billing?canceled=true`;
```

This ensures users who cancel checkout return to the CC wall, not the billing page.

---

### Phase 5: Update App Routes

**File: `src/App.tsx`**

Add `/trial-activation` route as an always-accessible route (like `/billing`):

```typescript
{/* Always accessible routes */}
<Route path="/billing" element={<Settings />} />
<Route path="/trial-activation" element={<TrialActivation />} />
<Route path="/settings" element={<Settings />} />
```

---

### Phase 6: Handle Checkout Success

**File: `src/pages/TrialActivation.tsx` (or create success handler)**

When user completes checkout, Stripe redirects to `/billing?session_id=XXX`. 

The existing `/billing` page handles this correctly:
- Shows the Current Plan card with "Free Trial" status
- User can navigate to dashboard from there

**Enhancement:** Add a success toast or redirect to `/dashboard` when `session_id` is present and status is `trialing`.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/TrialActivation.tsx` | CC wall page with trial benefits and Stripe checkout CTA |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/auth/BillingGuard.tsx` | Redirect `pending_trial` to `/trial-activation` |
| `src/pages/Onboarding.tsx` | Fix copy (14 days, card required), redirect to `/trial-activation` |
| `src/App.tsx` | Add `/trial-activation` route |
| `supabase/functions/create-checkout/index.ts` | Update `cancel_url` for pending_trial users |

---

## Style Guide Compliance Checklist

The Trial Activation page will follow these established patterns:

| Element | Pattern Source | Implementation |
|---------|----------------|----------------|
| Layout | Login.tsx, SignUp.tsx | Split layout (50/50), left graphic, right content |
| Background | Login.tsx | `backgroundColor: '#d7c5fb'` |
| Logo | All auth pages | `<GoGioLogo size="xl" />` centered |
| Heading | Login.tsx | Poppins, `-0.06em` letter-spacing, accent dot |
| Card | Login.tsx | White bg, `rounded-2xl`, `shadow-lg`, `p-8` |
| Buttons | StyleGuide | Primary: `h-12`, full width; Ghost: for "Sign out" |
| Icons | Lucide | Check (benefits), CreditCard, Sparkles |
| Benefits list | PerSeatPricingCard | Check icons with benefit text |
| Footer | Login.tsx | Privacy/Terms links, copyright |

---

## Recovery Flow Summary

| Scenario | User Returns To | System Behavior |
|----------|-----------------|-----------------|
| Left before onboarding | `/onboarding` | Shows workspace creation form |
| Left after onboarding, before checkout | `/trial-activation` | Shows CC wall, can retry checkout |
| Canceled Stripe checkout | `/trial-activation?canceled=true` | Shows CC wall with "checkout canceled" message |
| Left mid-checkout | `/trial-activation` | New checkout session created on retry |
| Webhook failed | `/trial-activation` | User retries, Stripe finds existing subscription |
| Completed checkout successfully | `/billing` → `/dashboard` | Full access with trialing status |

---

## Testing Scenarios

1. **Happy path:** Signup → Verify → Onboard → Activate → Dashboard
2. **Abandon at onboarding:** Close at workspace name → Reopen → Continue from onboarding
3. **Abandon at trial activation:** Complete onboarding, close at CC wall → Reopen → Still at CC wall
4. **Cancel Stripe checkout:** Click back on Stripe → Return to trial activation
5. **Complete checkout:** Full flow → Dashboard access with trialing badge
6. **Return after trial activated:** Login → Dashboard (skips activation page)

---

## Technical Notes

### Idempotency

- `provision-tenant` checks for existing membership before creating tenant
- Stripe checkout sessions expire after 24 hours
- Webhook handler checks for already-processed events

### State Persistence

- Billing status stored in `tenant_subscriptions` table (server-side)
- No reliance on `sessionStorage` for critical flow state
- `useBillingStatus` hook fetches fresh data on mount

### Error Handling

- Toast notifications for checkout failures
- Clear error states in UI
- Retry mechanisms built into Stripe

