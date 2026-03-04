

# Improve Offer Form Field Creation UX + Add Salary & Location Types

## Overview
Three improvements to the offer form fields manager:
1. Auto-generate `field_name` from `field_label` (hide field_name from user)
2. Add salary field type with currency/period config (matching job posting pattern)
3. Add location field type with city/state/country sub-fields (matching job posting pattern)

## Database Change

Add a `field_config` JSONB column to `offer_form_fields` to store salary/location configuration (same pattern as `job_posting_application_fields`):

```sql
ALTER TABLE offer_form_fields ADD COLUMN field_config jsonb;
```

The `field_type` enum already includes `salary` and `location` values, so no enum change needed.

## Code Changes

### 1. `src/hooks/useOfferFormFields.ts`
- Add `field_config` to the `OfferFormField` interface (optional `SalaryFieldConfig | LocationFieldConfig | null`)
- Import/re-export `SalaryFieldConfig` and `LocationFieldConfig` types from `useJobPostingFields`
- Add `salary` and `location` to the `field_type` union

### 2. `src/components/settings/OfferFormFieldsManager.tsx`

**Auto-generate field_name:**
- Remove the "Field Name" input from the dialog
- Auto-derive `field_name` from `field_label` using a `toSnakeCase` helper (e.g., "Start Date" → "start_date") when creating/updating
- Keep showing the generated `field_name` in the table as a read-only code badge (already there)

**Add salary/location field types:**
- Add `salary` and `location` to the `fieldTypes` array
- Add `field_config` state (`salaryConfig` and `locationConfig`) to `formData`
- When `salary` is selected: show currency + period selectors (same UI as `PostingFieldsBuilder`)
- When `location` is selected: show city/state/country checkbox sub-fields (same UI as `PostingFieldsBuilder`)
- Auto-set label to "Salary" or "Location" when those types are selected (matching job posting behavior)
- Pass `field_config` through to create/update calls
- Show config badges (currency/period or sub-fields) in the table view

### 3. Helper: `toSnakeCase`
Simple transform: lowercase, replace spaces/special chars with underscores, collapse multiples, trim edges.
```ts
const toSnakeCase = (str: string) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
```

## Visual Result
- Dialog simplifies to just "Field Label" (no more "Field Name" input)
- Selecting "Salary" type shows the purple config panel with currency + period dropdowns
- Selecting "Location" type shows the purple config panel with city/state/country checkboxes
- Table displays config badges for salary and location fields

