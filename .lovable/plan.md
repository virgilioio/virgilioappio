

# Redesign Billing Page — Dashboard-Style Layout

## Current State

The billing page is a vertical stack of full-width cards: banners, "Current Plan" card, pricing card, credit bundles, pricing details, usage analytics, and invoice history. It works but feels like a long settings form rather than a premium billing dashboard.

## Inspiration from Reference

The reference image shows a **dashboard-style billing page** with:
- A row of **summary stat cards** across the top (Current Plan, Next Billing, Team Seats, Payment)
- Two side-by-side cards: **Your Plan** (left) and **Payment Method** (right)
- A full-width **Billing History** table below

## Redesigned Structure

Using the existing style guide (Poppins font, rounded-2xl cards, MetricCard components, smart-field badges, virgilio-purple accents):

```text
┌─────────────────────────────────────────────────────────┐
│ Billing.                                                │
│ Manage your subscription and billing                    │
├─────────────────────────────────────────────────────────┤
│ [Alert banners - trial/locked/past-due as today]        │
├────────────┬────────────┬────────────┬──────────────────┤
│ Current    │ Next       │ Team       │ Enrichment       │
│ Plan       │ Billing    │ Seats      │ Credits          │
│ GoGio ATS  │ Apr 6,2026 │ 3 of 5    │ 360/mo           │
│ $99/mo     │            │ Usage      │ 100/seat         │
├────────────┴────────────┴────────────┴──────────────────┤
│                                                         │
│  ┌─── Your Plan ────────────┐  ┌─── Payment Method ──┐  │
│  │ GoGio ATS  [Active]      │  │ Stripe Connected     │  │
│  │ Per-seat pricing         │  │ user@email.com       │  │
│  │ $99/seat/month           │  │                      │  │
│  │                          │  │ [Manage Payment]     │  │
│  │ Team Usage: 3/5 seats    │  │ [Go to Stripe]       │  │
│  │ [Switch to Annual]       │  │                      │  │
│  │ [Manage Subscription]    │  └──────────────────────┘  │
│  └──────────────────────────┘                            │
│                                                         │
│  ┌─── Billing History ──────────────────────────────────┐│
│  │ Invoice | Date | Period | Amount | Status | Actions  ││
│  │ ...                                                  ││
│  └──────────────────────────────────────────────────────┘│
│                                                         │
│  (Credit Bundles card — for active users)                │
│  (PerSeatPricingCard — for trial/pending users)         │
└─────────────────────────────────────────────────────────┘
```

## Changes

### File: `src/pages/settings/Billing.tsx` — Full restructure of layout

1. **Top stat cards row** — Replace the 3-column grid inside "Current Plan" card with 4 standalone `MetricCard` components in a horizontal row:
   - **Current Plan**: "GoGio ATS" with billing interval subtitle, using CreditCard icon
   - **Next Billing**: formatted date (trial end or subscription renewal), using Clock icon
   - **Team Seats**: "{seat_quantity} Seats" with "Paid seats" subtitle, using Users icon
   - **Enrichment Credits**: "{totalCredits}/mo" with "per seat" detail, using Sparkles icon

2. **Two-column card layout** — Replace the single "Current Plan" card with two side-by-side cards in a `grid grid-cols-1 md:grid-cols-2 gap-6`:

   **Left: "Your Plan" card**
   - Plan name + status badge
   - Price display (e.g., "$99/seat/month")
   - Billing interval info
   - Seat count with a small progress indicator
   - Action buttons: Subscribe/Switch Interval/Manage

   **Right: "Payment Method" card**
   - Shows Stripe connection status
   - "Manage in Stripe" button to open billing portal
   - For trial/pending users: shows "No payment method" with CTA

3. **Billing History** — Keep the existing `InvoiceHistoryTable` in a full-width card below the two-column section. Show for all statuses (not just active/past-due/canceled) so users can always see it.

4. **Remove "Pricing Details" card** — The static pricing info card (lines 370-423) is redundant when the PerSeatPricingCard already covers this for trial users. Remove it to declutter.

5. **Remove "Usage Analytics" card** — The billing period usage metrics card (lines 425-444) adds visual clutter. The key usage info (seats) is already shown in the top stat cards and "Your Plan" card.

6. **Keep conditional cards** — `PerSeatPricingCard` (for trial/pending) and `CreditBundleCard` (for active) remain as-is, positioned after the two-column section.

7. **Keep all alert banners** — Trial warning, locked, past due, grace period, canceled banners remain unchanged at the top.

### Files NOT changed
- `src/components/billing/InvoiceHistoryTable.tsx` — unchanged
- `src/components/billing/PerSeatPricingCard.tsx` — unchanged  
- `src/components/billing/CreditBundleCard.tsx` — unchanged
- `src/components/ui/metric-card.tsx` — unchanged
- All hooks (`useBillingStatus`, `useStripePricing`, `useInvoiceHistory`, etc.) — unchanged
- No business logic, data flow, or permissions changes

### Summary
| Section | Before | After |
|---------|--------|-------|
| Top metrics | Buried inside "Current Plan" card | 4 standalone MetricCards in a row |
| Plan + Payment | Single wide card | Two side-by-side cards |
| Pricing Details | Static text card | Removed (redundant) |
| Usage Analytics | Separate card | Removed (key info in top row) |
| Invoice History | Conditional | Always visible |
| Alert banners | Top of page | Unchanged |

