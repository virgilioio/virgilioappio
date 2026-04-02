

# Upcoming Activities → Calendar/Agenda Redesign + 2:2:2 Layout

## The idea

Instead of a generic card with rows, transform Upcoming Activities into an **agenda-style calendar widget** — a mini calendar at the top showing the current week (or month dots), with activities grouped by day below, similar to Google Calendar's "Schedule" view or Apple Calendar's day list. The dashboard becomes a balanced 2:2:2 grid.

## Layout: 2:2:2

**File: `src/pages/Dashboard.tsx`**

Switch from `xl:grid-cols-5` to `xl:grid-cols-3` with equal columns:

```text
┌──────────────┬──────────────┬──────────────┐
│  col 1       │  col 2       │  col 3       │
│              │              │              │
│ App Review   │ Tasks        │ Agenda /     │
│ Jobs Overview│              │ Calendar     │
└──────────────┴──────────────┴──────────────┘
```

- `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
- Each column: `col-span-1`
- On tablet: 2 columns (col 3 drops below). On mobile: single column.

This gives Upcoming Activities a full ~430px column — enough room for a proper calendar widget.

## Calendar/Agenda redesign

**File: `src/components/dashboard/UpcomingActivities.tsx`**

Replace the current flat list with an agenda-style layout:

### Top section: Mini week strip
- A horizontal row showing the next 7 days (Mon–Sun) as small date circles
- Days with activities get a **lilac dot indicator** beneath them (matching the booking page pattern)
- Today is highlighted with the brand primary ring
- Clicking a day scrolls/filters to that day's activities

### Main section: Day-grouped agenda list
- Activities grouped under day headers: **"Today"**, **"Tomorrow"**, **"Wed, Apr 8"**, etc.
- Each day header has a subtle left border accent (lilac for today, muted for others)
- Under each header, activity rows render with a **timeline connector** — a thin vertical line on the left connecting the time markers, giving it that agenda/timeline feel
- Time shown as a left-aligned label (`9:00 AM`) with the activity details to its right
- Keep the existing `ActivityRow` component for the content, but wrap it in the timeline layout

### Visual structure per day group:
```text
Today, Apr 2
│
├─ 9:00 AM   Interview · Dwight K. · [confirmed]
│
├─ 2:30 PM   Reminder · Follow up with Jane
│
Tomorrow, Apr 3
│
├─ 10:00 AM  Interview · Michael S. · [confirmed]
```

### Tabs stay
- Keep Upcoming/Past tabs — they control which activities load
- "Show more" behavior stays the same

### No changes to:
- ActivityRow internals (actions, dropdowns, badges)
- Data fetching hooks
- Alert dialogs for cancel/status update

## Files changed

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Switch to `xl:grid-cols-3` equal columns, each `col-span-1` |
| `src/components/dashboard/UpcomingActivities.tsx` | Add mini week strip at top, group activities by day with timeline connectors and day headers |

