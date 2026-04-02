

# Fix Agenda Card: Tablet Layout + Mobile Adjustments

## Changes

### 1. Hide calendar widget on mobile

**File: `src/components/dashboard/UpcomingActivities.tsx`**

- Import `useIsMobile` from `@/hooks/use-mobile`
- Wrap the entire `Collapsible` block (lines 423-476) in a condition: only render when `!isMobile`
- On mobile, the card shows just the title, tabs, and agenda list — no calendar widget at all

### 2. Reorder columns on mobile

**File: `src/pages/Dashboard.tsx`**

Use CSS `order` utilities to control mobile stacking order without changing the DOM for desktop:

- Agenda column: `order-first md:order-none` — appears first on mobile
- Tasks column: `order-2 md:order-none` (or default)
- Application Review / Jobs column: `order-3 md:order-none`

Current grid (line 49): `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`

On tablet (`md`), the Agenda card currently spans 2 columns (`md:col-span-2`) which causes it to stretch too wide. Fix: remove `md:col-span-2` and let all three columns flow naturally. At `md` (2-col), the third item just wraps to the next row at normal width.

### 3. Fix tablet Agenda width

The issue is line 64: `md:col-span-2 xl:col-span-1` makes the Agenda card stretch across the full tablet width. Change to just render normally without spanning:

```
md:col-span-1 xl:col-span-1
```

This way on tablet (2-col grid), the Agenda sits in one column cell, same width as everything else.

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/UpcomingActivities.tsx` | Hide Collapsible calendar on mobile using `useIsMobile` |
| `src/pages/Dashboard.tsx` | Remove `md:col-span-2` from Agenda column; add `order-first md:order-none` for mobile-first positioning |

