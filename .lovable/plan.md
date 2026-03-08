

# Metric Card Visual Redesign — Opinion and Proposal

## What the reference image does well

The image shows three distinct card patterns, each serving a different purpose:

1. **Grouped summary card** — A single card containing multiple related metrics (Gain/Loss/Total) with a shared context header. The metrics sit in labeled rows inside the card rather than being separate cards. This reduces visual noise and communicates relationships between numbers.

2. **Standalone KPI with trend** — A compact card with large value, label below, and a trend percentage. Clean and minimal.

3. **Sparkline KPI cards** — Metrics with inline mini-charts above the value, showing the shape of the data at a glance. Multiple related metrics share one card surface with vertical dividers.

## What is wrong with our current approach

Right now every metric is its own card. On the Analytics overview, we have **8 identical cards in a row** — same size, same visual weight, same icon circle. The problems:

- **No hierarchy.** "Hires" and "Scheduled" look equally important.
- **No grouping.** Related metrics (Scheduled vs Completed, Offers vs Hires) are siblings with no visual relationship.
- **Too many borders.** 8 individual cards = 8 borders + 8 shadows. It reads as a wall of boxes.
- **The icon circle adds bulk** without adding information — especially when you have 8 of them.

## Proposed new system

Instead of one card type used everywhere, introduce **three card variants** that can be mixed:

### Variant A: "Hero KPI" (standalone)
For the 2-3 most important numbers on a page. Larger value (`text-3xl`), optional trend badge, optional sparkline. No icon circle — the size itself communicates importance.

Use for: **Applications**, **Hires**, **Avg Time to Hire** on analytics. **Active Jobs** on pipeline.

### Variant B: "Grouped KPI strip"
A single card surface containing 2-4 related metrics separated by subtle vertical dividers (like the bottom-right card in the reference). Shared header/context. Each metric has label + value, optionally a tiny sparkline.

Use for:
- **Interviews** group: Scheduled | Completed | Upcoming (one card, three values)
- **Pipeline flow** group: Active | Offers | Rejected (one card)
- **Offer** group: Sent | Converted | Rate (one card)

### Variant C: "Compact KPI" (current style, refined)
Keep for secondary metrics and grids. Remove the icon circle (or make it optional and off by default). Slightly smaller padding. Used in tables/grids where you need many metrics.

## Implementation plan

### 1. Add variants to `MetricCard`

Add a `variant` prop to `src/components/ui/metric-card.tsx`:
- `default` — current compact style (slightly refined: optional icon)
- `hero` — larger value, more padding, optional sparkline slot
- `inline` — minimal version for use inside grouped strips

### 2. Create `MetricCardGroup` component

New component `src/components/ui/metric-card-group.tsx`:
- Single Card surface
- Optional `title` header
- Renders children (inline MetricCards) in a flex row with vertical dividers
- Consistent with existing Card/border tokens

### 3. Migrate Analytics Overview

Replace the 8-card grid with:
- **Row 1:** 3 Hero KPIs — Applications, Hires, Avg Time to Hire
- **Row 2:** 2 Grouped strips
  - "Pipeline" group: Active | Offers | Rejected
  - "Interviews" group: Scheduled | Completed

This reduces 8 separate cards to 5 visual elements with clear hierarchy.

### 4. Migrate Pipeline page

- Hero: Active Jobs
- Group: Application Review | Interview | Offer Stage | Avg Time to Hire

### 5. Update Style Guide

Add all three variants + the group component to `MetricCardGuide.tsx`.

### Files to create
1. `src/components/ui/metric-card-group.tsx`

### Files to modify
1. `src/components/ui/metric-card.tsx` — add `variant` prop (hero/default/inline)
2. `src/components/analytics/sections/OverviewSection.tsx` — use hero + grouped layout
3. `src/pages/Pipeline.tsx` — use hero + grouped layout
4. `src/components/settings/styleguide/MetricCardGuide.tsx` — document all variants
5. `src/components/analytics/sections/InterviewHealthSection.tsx` — use grouped strip
6. `src/components/analytics/sections/OfferAnalyticsSection.tsx` — use grouped strip

