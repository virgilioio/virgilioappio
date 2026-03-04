

# Replace Native Date Inputs with DatePickerVirgilio Across All Forms

## Problem
Every form that renders a `date` field type uses a plain browser-native `<Input type="date">`. This looks inconsistent with the Virgilio design system, which provides a custom `DatePickerVirgilio` component with hover animations, today indicators, and styled calendar UI.

## Affected Locations (4 files)
All four places use `<Input type="date">` and need to switch to `<DatePickerVirgilio>`:

1. **`src/components/candidates/OfferComposerBody.tsx`** (line 112-120) — offer creation sheet
2. **`src/components/candidates/CreateOfferLetterDialog.tsx`** (line 115-121) — legacy offer dialog
3. **`src/pages/PublicJobPosting.tsx`** (line 848-852) — public job application form
4. **`src/components/forms/ApplicationFieldsRenderer.tsx`** (line 231-256) — reusable application fields renderer

## Changes per file

Each `case 'date'` branch will be updated to render `DatePickerVirgilio` instead of `<Input type="date">`. The value will be stored as a `Date` object (or converted from string on read). The pattern:

```tsx
case 'date':
  return (
    <DatePickerVirgilio
      value={value ? new Date(value) : undefined}
      onChange={(date) => handleFieldChange(field.field_name, date.toISOString().split('T')[0])}
      placeholder="Pick a date"
    />
  )
```

For `ApplicationFieldsRenderer` (which uses `react-hook-form`), the integration will convert between the form's string value and the `Date` object the picker expects.

## Files Changed
- **Modified**: `src/components/candidates/OfferComposerBody.tsx`
- **Modified**: `src/components/candidates/CreateOfferLetterDialog.tsx`
- **Modified**: `src/pages/PublicJobPosting.tsx`
- **Modified**: `src/components/forms/ApplicationFieldsRenderer.tsx`

