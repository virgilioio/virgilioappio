

# Billing MetricCard Colors + Remove PerSeatPricingCard

## Issue 1: MetricCard icon colors are all `text-primary`

The billing page uses `iconColor="text-primary"` for all 4 metric cards. Other pages (Pipeline, Analytics) use semantic colors per metric type. The style guide already demonstrates this pattern with different colors per card.

**Fix in `src/pages/settings/Billing.tsx`** — assign distinct icon colors:

| Card | Current | New |
|------|---------|-----|
| Current Plan | `text-primary` | `text-primary` (purple — keep, it's the brand plan card) |
| Next Billing | `text-primary` | `text-warning` (orange — time/calendar) |
| Team Seats | `text-primary` | `text-virgilio-success` (green — people/active) |
| Enrichment Credits | `text-primary` | `text-violet-500` (violet — sparkles/AI) |

## Issue 2: PerSeatPricingCard is redundant and oversized

The `PerSeatPricingCard` is a large card with a monthly/annual toggle, feature checklist, and CTA — essentially a marketing pricing page component. Real ATS platforms (Ashby, Lever, Greenhouse) do NOT show a full pricing breakdown card on their billing page. Their billing pages show:

- Current plan + status
- Manage/upgrade buttons that redirect to Stripe or a checkout flow
- Invoice history

The "Your Plan" card already covers plan info, pricing, interval switching, and subscribe/checkout CTAs. The `PerSeatPricingCard` duplicates all of this in a much larger format. It should be removed.

**Fix in `src/pages/settings/Billing.tsx`**:
- Remove the `PerSeatPricingCard` import and its conditional render block (lines 453-460)
- The "Your Plan" card already has: plan name, price per seat, interval info, subscribe button, switch interval button, and manage subscription button — everything the user needs

## Issue 3: Style Guide — add icon color mapping examples

The MetricCardGuide already shows colored icons in the style guide (success, warning, destructive), so no changes needed there. The existing examples already demonstrate the color mapping pattern.

## Summary of changes

| File | Change |
|------|--------|
| `src/pages/settings/Billing.tsx` | Assign semantic icon colors to 4 MetricCards; remove `PerSeatPricingCard` import and render block |

## What stays untouched
- `PerSeatPricingCard` component file — kept for potential future use elsewhere
- "Your Plan" card — unchanged, already covers all billing actions
- Payment Method card — unchanged
- Invoice History — unchanged
- All hooks, business logic, permissions — unchanged

