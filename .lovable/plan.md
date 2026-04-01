

# Redesign Public Booking Page: Inline Slots, Auto-select, Quick Schedule, Lilac Available Dates

## Overview

Redesign the candidate scheduling page to match a Calendly-style inline layout with smooth animations, auto-navigation, and a Quick Schedule feature.

## Changes

### 1. Lilac highlight for available dates + auto-select first date + auto-advance month

**File: `src/components/booking/MonthCalendar.tsx`**

- Available dates that are not selected get a lilac background (`bg-virgilio-purple/15 text-virgilio-purple`) instead of plain text — matching Calendly's blue circles but in our brand color.
- Accept new prop `noAvailabilityInMonth?: boolean` — when true, show a subtle banner below the grid: "No available times this month."
- The parent page handles auto-advancing month and auto-selecting the first date.

### 2. Auto-select first available date + auto-advance empty months

**File: `src/pages/PublicBookingPage.tsx`**

- Add `useEffect` watching `availableDates` + `isLoadingAvailability`:
  - If dates exist and nothing selected → auto-select the first one.
  - If no dates and not loading → auto-advance `currentMonth` forward (max 6 months lookahead). Track a counter in a ref to cap the search.

### 3. Inline time slots (Calendly-style) — calendar card expands

**File: `src/pages/PublicBookingPage.tsx`**

- When a date is selected and time slots exist, the middle calendar card smoothly expands to show `TimeSlotsList` side-by-side to the right of the calendar using `transition-all duration-300 ease-out`.
- Layout: calendar card uses an inner flex container. Left side = MonthCalendar + timezone. Right side = TimeSlotsList (appears with `w-0 opacity-0` → `w-[260px] opacity-100` transition).
- The right column is freed up for QuickSchedulePanel (or confirmation form once a slot is picked).

**File: `src/components/booking/TimeSlotsList.tsx`**

- Reduce ScrollArea height from 500px to ~400px for inline fit.
- Remove the "Select a date" empty state (since it only renders when a date is selected now).

### 4. Quick Scheduling panel (right column)

**New file: `src/components/booking/QuickSchedulePanel.tsx`**

- Shows "Quick Schedule" heading with the next 3–5 available slots across all upcoming dates.
- Each option: a card/button showing day + time (e.g., "Mon, Apr 7 · 10:30 AM").
- Clicking one sets both `selectedDate` + `selectedSlot`, jumping directly to the confirmation form.
- Styled as outlined cards with hover effects matching our design system.

**File: `src/pages/PublicBookingPage.tsx`**

- Right column shows `QuickSchedulePanel` when `!selectedSlot`, `BookingConfirmationForm` when a slot is selected.

### 5. Layout changes summary

```text
Current:  [Interviewer] [Calendar card] [Time slots / Form]
New:      [Interviewer] [Calendar + inline slots] [Quick Schedule / Form]
```

## Files changed

| File | Change |
|------|--------|
| `src/pages/PublicBookingPage.tsx` | Auto-select, auto-advance, inline time slots in calendar card, QuickSchedulePanel in right column |
| `src/components/booking/MonthCalendar.tsx` | Lilac background for available dates, optional no-availability banner |
| `src/components/booking/TimeSlotsList.tsx` | Reduce height, remove unused empty state |
| `src/components/booking/QuickSchedulePanel.tsx` | New — next 3-5 slots for one-click scheduling |

