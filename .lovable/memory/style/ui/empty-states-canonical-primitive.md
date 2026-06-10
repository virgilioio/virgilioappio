---
name: Empty states canonical primitive
description: Single source of truth for all empty states — <EmptyState> with four variants. No hand-rolled blocks allowed.
type: design
---

# EmptyState — single source of truth

**File:** `src/components/ui/empty-state.tsx`

One canonical primitive. Four variants. No exceptions, no hand-rolled empty blocks.

## API

```tsx
<EmptyState
  variant="page" | "table-row" | "chart" | "inline"   // default: inline
  title={...}                                         // purple period auto-appended
  description={...}
  icon={LucideIcon}                                   // alternative to mascot
  assetType="empty-state-jobs" | ...                  // DB-driven hero (page only)
  mascot={boolean}                                    // default true for page/inline
  action={{ label, onClick, variant? }}
  secondaryAction={{ label, onClick }}
  colSpan={number}                                    // REQUIRED for variant="table-row"
  size="sm" | "md" | "lg"
  className={...}
/>
```

Sub-exports: `EmptyState.Page`, `EmptyState.TableRow`, `EmptyState.Chart`, `EmptyState.Inline`, `EmptyState.Filtered`.

## Variants

| Variant     | When                                          | Visual    | Mascot default |
|-------------|-----------------------------------------------|-----------|----------------|
| page        | Full pages (Jobs, Deals, Organizations…)      | 64px      | yes            |
| table-row   | Inside `<TableBody>` (wrap in `<TableRow>`)   | 40px icon | no             |
| chart       | Analytics chart cards                         | 40px icon | no             |
| inline      | Cards, sheets, side panels                    | 48px      | yes            |

## Wrappers (deprecated, kept during migration)

- `GioEmptyState` → `<EmptyState variant="inline">`
- `AnalyticsEmptyState` → `<EmptyState variant="chart">`
- `TalentIntelligenceEmptyState` → `<EmptyState variant="inline" mascot={false}>`
- `TableEmpty` / `TableFilteredEmpty` (in `table-states.tsx`) → wrappers around `variant="table-row"` (kept for table grammar clarity)

## Rules

- **Never hand-roll empty blocks.** Always use `<EmptyState>`.
- Title is plain text — the purple period is rendered automatically.
- `platform_assets` DB-driven hero images are supported only on `variant="page"`.
- Loading skeleton is separate (`TableSkeleton`); empty/filtered share this primitive.
