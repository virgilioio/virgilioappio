

# Fix Tasks Card: Add Icon + Fix Dialog Horizontal Scroll

## Changes

### 1. Add icon to Tasks card title

**File: `src/components/dashboard/TasksOverview.tsx`**

Other dashboard cards (UpcomingActivities, JobsOverview) use `<Icon className="h-5 w-5" />` inside `CardTitle`. Add `ClipboardList` (or `ListChecks`) from lucide-react to match the pattern:

```tsx
<CardTitle className="text-lg font-semibold flex items-center gap-2" withPeriod={false}>
  <ListChecks className="h-5 w-5" />
  Tasks
  ...
</CardTitle>
```

### 2. Fix horizontal scroll in dialog

**File: `src/components/dashboard/TasksOverview.tsx`**

The dialog content at line 144 uses `overflow-y-auto` but has no horizontal overflow constraint. Long email subjects or candidate names can push content wider than the dialog. Fix:

- Add `overflow-x-hidden` to `DialogContent`
- Ensure the inner activity row container has `overflow-hidden` on text elements (already has `truncate` and `min-w-0`, but the parent `flex` container at line 213 needs `overflow-hidden` as well)

```tsx
<DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto overflow-x-hidden">
```

And on the ActivityRow button, ensure the flex container clips:
```tsx
<div className="flex items-start justify-between gap-2 overflow-hidden">
```

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/TasksOverview.tsx` | Add `ListChecks` icon to card title; add `overflow-x-hidden` / `overflow-hidden` to dialog and row containers |

