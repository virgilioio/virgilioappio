

# 6-Column Grid with Per-Card Size Rules

## Overview

Refactor the dashboard from a 3-column grid to a 6-column grid. Cards get granular column-span control with per-card min/max rules. The span toggle becomes a cycle through allowed sizes. Cards show their actual span in real-time during customization (fixing the "no preview" issue).

## Size Rules

| Card | Allowed spans | Default |
|------|--------------|---------|
| `tasks` | 2 only (fixed) | 2 |
| `agenda` | 2 only (fixed) | 2 |
| `app-review` | 2, 3, 4 | 2 |
| `onboarding` | 2, 3, 4 | 2 |
| `jobs` | 2, 3, 4 | 2 |

No card can be 1, 5, or 6 columns wide. Fixed cards (tasks, agenda) have no resize button.

## Changes

### 1. `src/hooks/useDashboardLayout.ts`

- Change `CardSpans` type from `Partial<Record<DashboardCardId, 1 | 2>>` to `Partial<Record<DashboardCardId, number>>`
- Add a `CARD_SIZE_RULES` config:
  ```ts
  const CARD_SIZE_RULES: Record<DashboardCardId, { allowed: number[], default: number }> = {
    'tasks':      { allowed: [2], default: 2 },
    'agenda':     { allowed: [2], default: 2 },
    'app-review': { allowed: [2, 3, 4], default: 2 },
    'onboarding': { allowed: [2, 3, 4], default: 2 },
    'jobs':       { allowed: [2, 3, 4], default: 2 },
  }
  ```
- Export `CARD_SIZE_RULES` and a helper `getCardSpan(spans, cardId)` that returns the stored span or the card's default
- `toggleCardSpan` cycles through `allowed` array (2 → 3 → 4 → 2 for variable cards; no-op for fixed cards)
- Remove the column-move logic from `toggleCardSpan` (no longer needed since we're not anchoring to 3 logical columns for rendering)
- Keep the 3 logical columns (left/center/right) for DnD ownership only
- Bump `STORAGE_KEY` to `'dashboard-layout-v3'` to avoid conflicts with old span values
- Update `DEFAULT_COLUMNS` so cards distribute well across 6 cols (e.g. left: `['app-review', 'jobs']`, center: `['tasks', 'onboarding']`, right: `['agenda']`)

### 2. `src/pages/Dashboard.tsx`

- Change grid from `repeat(3, 1fr)` to `repeat(6, 1fr)` for both the view and customize grids
- Update `computeGridPlacements`:
  - Instead of mapping columns to grid positions 1/2/3, walk all cards across all 3 logical columns in order and place them row by row into a 6-wide grid
  - Algorithm: maintain a row-cursor array of 6 slots. For each card, find the first row where `span` consecutive slots are free, place it there
  - This produces a compact masonry-like layout within the 6-col grid
- In customize mode, cards render at their **actual current span** in the grid so the user sees real-time preview of size changes
- The DnD customize grid also uses `repeat(6, 1fr)` with explicit placement (no more 3 flex columns)
- `DroppableColumn` usage stays for DnD drop targets but they overlay the grid visually

### 3. `src/components/dashboard/DraggableDashboardCard.tsx`

- `colSpan` prop type changes from `1 | 2` to `number`
- Only show the resize toggle button when `CARD_SIZE_RULES[id].allowed.length > 1`
- Update tooltip: "Resize: 2 → 3 cols" etc.
- Icon: use `Maximize2` when not at max, `Minimize2` when at max (cycles back)

### 4. Tablet / Mobile

- Mobile: unchanged (single column stack, no spans)
- Tablet (md): use `repeat(4, 1fr)` — cards that are span-4 fill full width, span-2 cards take half, span-3 takes 3/4. Clamp spans to max 4 on tablet.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | 6-col span rules, cycle toggle, bump storage version |
| `src/pages/Dashboard.tsx` | 6-col grid, updated placement algorithm, real-time span preview |
| `src/components/dashboard/DraggableDashboardCard.tsx` | Variable span support, conditional resize button |

