

# Fix: Date Picker Selecting Wrong Day (Timezone Bug)

## Problem

When a user selects a date (e.g., March 4), the stored value can shift by one day due to UTC/local timezone mismatch. This happens in two places:

1. **Saving**: `date.toISOString().split('T')[0]` converts local midnight to UTC before extracting the date string. In timezones east of UTC, local midnight on March 4 = March 3 in UTC.
2. **Reading**: `new Date("2026-03-04")` parses as UTC midnight, which in timezones west of UTC displays as March 3.

## Fix

Replace timezone-unsafe patterns in all affected files:

- **Saving** — use `format(date, 'yyyy-MM-dd')` from date-fns (already imported in most files), which uses local time
- **Reading** — parse `"YYYY-MM-DD"` as local time using `new Date(value + 'T00:00:00')` to avoid UTC interpretation

## Files to change

### 1. `src/components/candidates/OfferComposerBody.tsx`
- Line 118: `new Date(value)` → `new Date(value + 'T00:00:00')`
- Line 119: `date.toISOString().split('T')[0]` → `format(date, 'yyyy-MM-dd')`

### 2. `src/components/candidates/CreateOfferLetterDialog.tsx`
- Line 124: `new Date(value)` → `new Date(value + 'T00:00:00')`
- Line 125: `date.toISOString().split('T')[0]` → `format(date, 'yyyy-MM-dd')`

### 3. `src/pages/PublicJobPosting.tsx`
- Line 851: `new Date(customFieldResponses[field.id])` → `new Date(customFieldResponses[field.id] + 'T00:00:00')`
- Line 852: `date.toISOString().split('T')[0]` → `format(date, 'yyyy-MM-dd')`

### 4. `src/components/forms/ApplicationFieldsRenderer.tsx`
- Line 247: `new Date(formField.value)` → `new Date(formField.value + 'T00:00:00')`
- Line 248: `date.toISOString().split('T')[0]` → `format(date, 'yyyy-MM-dd')`

Each file already imports `format` from `date-fns` or will need a small import addition.

