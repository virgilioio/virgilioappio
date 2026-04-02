

# Polish Dashboard Customize Mode

## Current state

The customize mode infrastructure already exists: toggle button, reset, add widget sheet, drag handles, size cycling, hide buttons, and DnD only in customize mode. The request is largely fulfilled.

## Refinements to apply

### 1. `src/pages/Dashboard.tsx` — Header button label
- Change "Customize" label to "Customize dashboard" for a more intentional feel
- Change "Done" to "Done editing"

### 2. `src/components/dashboard/DraggableDashboardCard.tsx` — Always-visible affordances
- Remove `opacity-0 group-hover/card:opacity-100` from drag handle, size button, and hide button so they're **always visible** in customize mode — hovering to discover controls feels uncertain; a proper edit mode should make all affordances immediately apparent
- Tone down the visual weight: use `bg-muted text-muted-foreground` instead of `bg-primary` for the drag handle, and a softer red for hide
- Make the dashed ring subtler: `ring-border/40` instead of `ring-primary/20`

### 3. `src/pages/Dashboard.tsx` — Subtle background tint in customize mode
- Add a very faint background tint or top banner ("You're customizing your dashboard") to make the mode unmistakable, then remove it when done

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/DraggableDashboardCard.tsx` | Remove hover-gating on affordances, soften visual styling |
| `src/pages/Dashboard.tsx` | Update button labels, add subtle customize-mode indicator |

