

# Consolidate Right Column into a Compact "Tasks Overview" Card

## The idea — and why it's great

Your instinct is spot on. Right now the right column stacks 3 separate cards (Upcoming Activities, Pending Activities, Stale Candidates), each with its own loading state, empty state, and expand/collapse. That's a lot of vertical space, especially when most rows are empty or have 1-2 items.

Ashby's approach (the screenshot) is exactly this — a single compact summary card with labeled rows and counters. Clicking a row navigates or opens a filtered view.

## Proposed design: "Tasks Overview" card

A single card replaces **Pending Activities** and **Stale Candidates**. (Upcoming Activities stays separate — it's a calendar/schedule widget, fundamentally different.)

```text
┌─────────────────────────────────────┐
│  Tasks                              │
│                                     │
│  Pending Scorecards           3     │
│  Needs Decision               2     │
│  Unread Emails                5     │
│  Offer Approvals              1     │
│  Stale Candidates             4     │
│                                     │
│  (rows with 0 count are hidden)     │
└─────────────────────────────────────┘
```

- Each row is clickable → opens a **dialog** listing the individual items (candidate name, job, stage, time info) with a click-through to the candidate page.
- Rows with `0` count are **hidden entirely** — no clutter.
- If ALL counts are 0 → single compact empty state ("You're all caught up").
- Counter badges use the existing activity badge color scheme (scorecard = amber, decision = blue, email = green, stale = red/warning).

## Why dialog over navigation with filters

- Faster — no page load, user stays on dashboard context.
- The items already link out to the candidate page (open in new tab), so the dialog acts as a quick triage list.
- Simpler to implement — reuses existing click handlers from PendingActivities and StaleCandidates.

## Changes

### 1. New component: `TasksOverview`

**File: `src/components/dashboard/TasksOverview.tsx`**

- Imports `usePendingActivities` and `useStaleCandidates` hooks (already exist).
- Groups pending activities by type, counts each.
- Renders a single Card with rows for each non-zero category.
- Each row: icon + label + count badge, clickable.
- Click opens a `Dialog` with the filtered list of items (reusing the existing render logic from PendingActivities/StaleCandidates for each item row).
- Empty state when all counts are 0.

### 2. Update Dashboard layout

**File: `src/pages/Dashboard.tsx`**

- Replace `<PendingActivities />` and `<StaleCandidates />` with `<TasksOverview />`.
- Right column becomes: `UpcomingActivities` + `TasksOverview` — much more compact.

### 3. Keep existing components

`PendingActivities.tsx` and `StaleCandidates.tsx` are NOT deleted — they can still be useful elsewhere or as reference. They just stop being rendered on the dashboard.

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/TasksOverview.tsx` | New — compact summary card with category rows, counters, and detail dialogs |
| `src/pages/Dashboard.tsx` | Replace PendingActivities + StaleCandidates with TasksOverview |

