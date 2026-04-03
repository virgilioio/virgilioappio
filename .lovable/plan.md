

# Redesign World Clock Widget + Add 1-Column Size

## Overview
Simplify the World Clock card layout and introduce a new `xsmall` (1-column) widget size for compact widgets.

## Changes

### 1. `src/hooks/useDashboardLayout.ts` — Add `xsmall` size
- Add `'xsmall'` to `WidgetSize` type
- Add `xsmall: 1` to `SIZE_TO_COLS`
- Update `world-clock` registry entry: `allowedSizes: ['xsmall']`, `defaultSize: 'xsmall'`
- Update `CARD_SIZE_RULES` for world-clock to `['xsmall']`
- Update default layout entry for world-clock to `size: 'xsmall'`
- Add xsmall to `SIZE_ICONS` and `SIZE_LABELS` in DraggableDashboardCard

### 2. `src/components/dashboard/WorldClockWidget.tsx` — Redesign layout
- **Remove** CardHeader entirely (no icon + "World Clock" title)
- **Top row**: City name (left, Poppins semibold) + UTC badge (right, black `default` variant)
- **Center**: Time in larger font (`text-5xl` Poppins bold, tabular-nums)
- **Remove** date line, remove time-of-day icon/label row
- **Bottom row**: Dot navigation (left) + small "+" button (right) to add timezones
- Keep pagination arrows if multiple timezones exist
- Keep the lilac `bg-accent/40` background
- Tighter padding to fit 1-column width

### 3. `src/components/dashboard/DraggableDashboardCard.tsx` — Support xsmall in size cycling
- Add `xsmall` entry to `SIZE_ICONS` and `SIZE_LABELS`

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | Add `xsmall` size (1 col), update world-clock registry |
| `src/components/dashboard/WorldClockWidget.tsx` | Redesign: remove header/date, city+badge top, bigger time, "+" bottom-right |
| `src/components/dashboard/DraggableDashboardCard.tsx` | Add xsmall to size icon/label maps |

