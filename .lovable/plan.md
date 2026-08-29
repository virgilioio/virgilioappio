# Year navigation in canonical date pickers

## Problem
The two canonical pickers used in the public reference forms (and app-wide) only navigate **one month at a time**:

- `MonthPicker` (`src/components/ui/month-picker.tsx`) — header shows the year with ‹ › arrows that call `subMonths/addMonths(currentMonth, 1)` — stepping a year back takes 12 clicks.
- `DatePickerVirgilio` (`src/components/ui/date-picker-virgilio.tsx`) — same single-month stepping on the day grid.

For employment dates (often years in the past) this is effectively broken.

## Plan

### 1 · Month + year quick-jump in the picker header
Apply the same pattern to **both** pickers, keeping the existing chrome (same row height, fonts, ghost chevron buttons):

- Replace the static header label (`yyyy` in MonthPicker, `MMMM yyyy` in DatePickerVirgilio) with two compact inline dropdowns:
  - **Month** select (Jan–Dec; DatePickerVirgilio only — MonthPicker already has the month grid)
  - **Year** select covering a practical range: **current year +1 → current year −60** (covers full employment history).
- Selecting a month/year just moves `currentMonth` — it does not select a value.
- Keep the existing ‹ › chevrons for one-month stepping, unchanged.
- Dropdown styling matches the menu foundation: native `<select>` elements styled with the shared menu chrome (Poppins 13px label, 12px radius panel, hover `#F1F0EC`) — implemented as tiny local components inside each picker file, no new shared abstraction.

### 2 · Files touched
- `src/components/ui/date-picker-virgilio.tsx` — month + year selects in the header.
- `src/components/ui/month-picker.tsx` — year select in the header (months already a grid).

No changes to `PublicField.tsx`, `PublicReferenceSubmit.tsx`, or `QuestionInstrument.tsx` — they consume the canonical components, so every public form (and every in-app usage) gains year navigation automatically.

### 3 · Verify
- Public referee page: open Start/End month picker → jump straight to 2015 via year select; chevrons still step months.
- Candidate page full-date field: month and year selects jump correctly; day grid updates.
- In-app usages of both pickers unaffected visually beyond the new header controls.
- Build passes.

## Out of scope
- Changing stored value formats or any form logic.
- Min/max year constraints from field config (not present today).
