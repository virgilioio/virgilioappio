

# Hide/Show Dashboard Cards + Add Widget Menu

## Overview

Add the ability to hide dashboard cards and re-add them from a menu. When customizing, each card gets an "X" button to hide it. A "+" button or "Add Widget" menu shows hidden cards that can be re-added to any column.

## How it works

- A `hiddenCards` set is stored alongside the column layout in localStorage
- Hiding a card removes it from its column and adds it to `hiddenCards`
- The "Add Widget" button (visible only in customize mode) opens a Sheet/Popover listing hidden cards with friendly labels and an "Add" button next to each
- Adding a card removes it from `hiddenCards` and appends it to the column with the fewest cards
- Reset layout also resets hidden cards

## Changes

### 1. `src/hooks/useDashboardLayout.ts`

- Add `hiddenCards: Set<DashboardCardId>` to state
- Persist hidden cards in localStorage alongside columns (update storage format to `{ columns, hidden }`)
- New methods:
  - `hideCard(cardId)` — remove from its column, add to hidden set, save
  - `showCard(cardId)` — remove from hidden set, add to shortest column, save
- `resetLayout` also clears hidden cards
- Update `loadColumns` to handle new storage format with backwards compatibility

### 2. `src/components/dashboard/DraggableDashboardCard.tsx`

- Add optional `onHide` prop
- When `isCustomizing` and `onHide` is provided, render an "X" button (opposite corner from drag handle) — small, circular, same style as drag handle but with X icon

### 3. `src/pages/Dashboard.tsx`

- Pass `onHide` to each `DraggableDashboardCard` when customizing
- Filter hidden cards from rendering (already handled by removing from columns)
- Add "Add Widget" button next to "Reset" and "Done" buttons (only visible in customize mode, only enabled when there are hidden cards)
- Clicking "Add Widget" opens a Sheet listing hidden cards with labels and "Add to dashboard" buttons

### 4. Card label registry

A simple map in Dashboard.tsx for display names:
```ts
const CARD_LABELS: Record<DashboardCardId, string> = {
  'agenda': 'Agenda & Calendar',
  'tasks': 'Tasks',
  'app-review': 'Application Review',
  'onboarding': 'Onboarding Checklist',
  'jobs': 'Jobs Overview',
}
```

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | Add `hiddenCards` state, `hideCard`/`showCard` methods, updated storage format |
| `src/components/dashboard/DraggableDashboardCard.tsx` | Add `onHide` prop with X button in customize mode |
| `src/pages/Dashboard.tsx` | Add "Add Widget" button + Sheet listing hidden cards; pass `onHide` to draggable cards |

