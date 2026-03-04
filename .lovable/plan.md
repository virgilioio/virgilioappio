

# Fix Select Options + Simplify to Label-Only Input

## Problem
When configuring select field options in `FormFieldEditor`, the user is asked for both a **Value** and a **Label** per option (two inputs). This is unnecessarily complex — only the label should be required, with the value auto-derived (snake_case of label), matching the pattern used for field names throughout the app.

Additionally, the approved plan for `offer_field_select_options` table + persistence logic still needs to be implemented.

## Changes

### 1. Simplify select option inputs in `FormFieldEditor.tsx`
- Remove the "Value" input from each option row — show only a single "Option label" input
- Auto-generate `option_value` from the label using the existing `toSnakeCase` pattern (e.g., "Full Time" → "full_time")
- Update `addOption` to only need a label
- Update `updateOption` to auto-set `option_value` when label changes

**Before** (lines 202-207):
```
<Input ... placeholder="Value" />
<Input ... placeholder="Label" />
```

**After**:
```
<Input ... placeholder="Option label" />
// option_value auto-derived on save
```

### 2. Database migration: `offer_field_select_options` table
Create the table mirroring `posting_field_select_options`:
- `id` (uuid PK), `offer_field_id` (FK → offer_form_fields ON DELETE CASCADE), `option_value`, `option_label`, `display_order`, `created_at`
- RLS enabled with appropriate policies

### 3. Update `useOfferFormFields.ts`
- In `updateField`: handle `select_options` — delete existing + re-insert (same pattern as job posting fields)
- In `createField`: persist `select_options` if field type is `select`

### 4. Update `OfferFieldEditor.tsx`
- Add `loadSelectOptions` callback querying `offer_field_select_options`
- Pass it to `FormFieldEditor`

## Files Changed
- **Modified**: `src/components/shared/FormFieldEditor.tsx` — single label input, auto-derive value
- **Migration**: New `offer_field_select_options` table
- **Modified**: `src/hooks/useOfferFormFields.ts` — select options persistence
- **Modified**: `src/components/settings/OfferFieldEditor.tsx` — loadSelectOptions prop

