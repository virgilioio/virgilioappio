# Canonical date pickers in public reference forms

## Problem
The public reference flows don't use the canonical Gio date pickers:

1. **Candidate flow** (`PublicReferenceSubmit.tsx`) — referee fields of type `date` / `date_range` render raw native `<input type="date">` / `<input type="month">` (browser chrome, inconsistent across browsers).
2. **Referee flow** (`QuestionInstrument.tsx` → `employment_verification`) — "Start (month / year)" and "End (month / year)" are free-text inputs, so answers are unparseable and off-design.

The canonical components already exist: `DatePickerVirgilio` (full date, quick picks: Today/Tomorrow/Next week) and `MonthPicker` (month-year grid with presets, already matching DatePickerVirgilio chrome).

## Plan

### 1 · Public-styled picker wrappers — `src/components/public/PublicField.tsx`
Add two primitives that wrap the canonical pickers in the public pages' chrome (38px height, `#E3E0D6` border, 9px radius, 13px Inter, left-aligned), like `PublicPhoneField` already does for phone:

- **`PublicMonthField({ value, onChange, onBlur, placeholder })`** — wraps `MonthPicker`. Value is a `yyyy-MM` string (or `''`); converts to/from `Date` internally. Full-width trigger via `className`.
- **`PublicDateField({ value, onChange, onBlur, placeholder })`** — wraps `DatePickerVirgilio`. Value is a `yyyy-MM-dd` string (or `''`); converts to/from `Date`.
- Popover content gets `pointer-events-auto` so it stays interactive inside the public shell. MonthPicker's popover is missing this — add it in `month-picker.tsx`.
- Both fire `onChange` with the formatted string on selection (and `onBlur?.()` right after, so the referee flow's autosave-on-blur still triggers).

### 2 · Candidate flow — `src/pages/PublicReferenceSubmit.tsx`
In `RefereeFieldControl`:
- `date` type → `PublicMonthField` when `precision` is month-year, `PublicDateField` when `full_date` (replaces the native input).
- `date_range` type → two pickers with the existing `to` separator, same precision switch. Stored format stays `"from to to"` with `yyyy-MM` / `yyyy-MM-dd` parts, so nothing downstream changes.

### 3 · Referee flow — `src/components/public/QuestionInstrument.tsx`
`employment_verification`: replace the free-text Start/End `PublicInput`s with `PublicMonthField` (labels unchanged). Values stored as `yyyy-MM` in the draft answers JSON — structured and comparable to the candidate's stated range. `onBlur` after select keeps autosave working.

### 4 · Verify
- Template with a `date_range` referee field → candidate page shows two canonical month pickers; picking months fills "yyyy-MM to yyyy-MM"; submit still works.
- Full-date precision renders the day grid picker.
- Referee page employment verification uses month pickers; autosave "Saved —" line still fires after picking.
- Build passes.

## Out of scope
- Changing stored value formats (we emit the same string shapes the fields already use).
- Date constraints (e.g. end-after-start validation) — not requested.
