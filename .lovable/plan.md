

# Collapsible Calendar with Styled Date Title + Correct Date Formats

## Changes

### 1. `src/components/dashboard/AgendaCalendar.tsx`

Add optional `hideHeader` prop (default `false`). When `true`, skip rendering the month header row (nav arrows + month label) since the parent handles it.

### 2. `src/components/dashboard/UpcomingActivities.tsx`

**Collapsible wrapper:**
- Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
- Import `PageTitle` from `@/components/ui/page-title`
- Add `calendarOpen` state (default `true`)
- Wrap `AgendaCalendar` in Collapsible with `hideHeader={true}`

**Trigger row:**
- `PageTitle` as `h4` showing `format(currentMonth, 'MMMM d, yyyy')` — e.g. **"April 2, 2026."** (Poppins bold + purple period)
- Month nav arrows (ChevronLeft/ChevronRight) in the trigger row so users can change months even when collapsed
- Collapse/expand chevron indicator

**Date formats throughout:**
- Collapsible header: `MMMM d, yyyy` → "April 2, 2026"
- Agenda day headers: Today → `"Today, April 2, 2026"`, Tomorrow → `"Tomorrow, April 3, 2026"`, Other → `"Wed, April 8, 2026"` (all using `MMMM d, yyyy`)

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/AgendaCalendar.tsx` | Add `hideHeader` prop |
| `src/components/dashboard/UpcomingActivities.tsx` | Collapsible wrapper with PageTitle trigger, month nav arrows, updated date formats to `MMMM d, yyyy` |

