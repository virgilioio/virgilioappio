

# Fix Missing Vertical Spacing Between Cards in Analytics Sections

## Problem
In `AnalyticsSection.tsx` (line 70), all section children are wrapped in `<div className="animate-fade-in">` — this div has no vertical spacing utility, so the hero cards row, grouped strips row, and trend chart stack with zero gap.

## Fix
**File:** `src/components/analytics/shared/AnalyticsSection.tsx`

Change line 70 from:
```tsx
<div className="animate-fade-in">
```
to:
```tsx
<div className="animate-fade-in space-y-4">
```

This adds consistent `1rem` vertical gaps between all child elements within every analytics section — hero cards, grouped strips, charts, etc. One-line change, affects all sections uniformly.

