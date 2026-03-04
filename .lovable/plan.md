

# Smart Employment Type and Work Location Fields

## Overview

Add two new smart field types — `employment_type` and `work_location` — that render standardized select dropdowns with fixed options. These follow the same pattern as existing smart fields (salary, location, phone) but with pre-defined options that cannot be customized, ensuring consistency across all job postings and offers.

The values already exist as enums in the database (`employment_type_enum`) and as hardcoded options in `PostingSheet.tsx`, so this standardizes them into the smart field system.

## Fixed Options

**Employment Type**: Full-time, Part-time, Temporary, Internship (matches existing `employment_type_enum`)

**Work Location**: Remote, Hybrid, On-site (matches existing `location_type` values in `PostingSheet`)

## Changes

### 1. Database: Add enum values to `field_type`
Run a migration to add `'employment_type'` and `'work_location'` to the `field_type` enum in Supabase.

### 2. `src/hooks/useJobPostingFields.ts` — Add to FieldType union
Add `'employment_type' | 'work_location'` to the `FieldType` type. No config interfaces needed — these fields have no configurable options (fixed dropdowns).

### 3. `src/components/shared/FormFieldEditor.tsx` — Builder support

- Add to `ALL_FIELD_TYPES` array
- Add `fieldTypeLabel` cases: "Employment Type" and "Work Location"
- Mark as smart fields in `isSmartField` check
- **View mode**: Add badge rows — Employment Type gets a briefcase icon with an indigo badge; Work Location gets a building icon with a cyan badge. No "Syncs to Profile" badge (these don't sync to candidate profile — they describe the job, not the candidate).
- **Edit mode**: No config panel needed — the options are fixed and standardized. Show a small info note: "Options are standardized and cannot be customized."

### 4. `src/components/forms/ApplicationFieldsRenderer.tsx` — Public form rendering
Add `case 'employment_type':` and `case 'work_location':` that render a `<Select>` with the fixed options. No free-text input.

### 5. `src/pages/PublicJobPosting.tsx` — Public form rendering
Same select rendering for the public job posting form.

### 6. `src/components/candidates/OfferComposerBody.tsx` — Offer form rendering
Same select rendering for the offer composer.

### 7. `src/components/candidates/CreateOfferLetterDialog.tsx` — Offer letter dialog
Same select rendering.

### 8. `src/components/settings/OfferFormFieldsManager.tsx` — Add to offer field types
Already uses a local `ALL_FIELD_TYPES` — add the two new types.

### 9. `src/components/settings/styleguide/SmartFieldsGuide.tsx` — Documentation
Add examples for Employment Type and Work Location badges and rendering.

## Summary of file changes
- **Migration**: Add `employment_type` and `work_location` to `field_type` enum
- **`useJobPostingFields.ts`**: Update `FieldType` union
- **`FormFieldEditor.tsx`**: Builder view/edit support with badges
- **`ApplicationFieldsRenderer.tsx`**: Public form select rendering
- **`PublicJobPosting.tsx`**: Public form select rendering
- **`OfferComposerBody.tsx`**: Offer form select rendering
- **`CreateOfferLetterDialog.tsx`**: Offer letter select rendering
- **`OfferFormFieldsManager.tsx`**: Add to type list
- **`SmartFieldsGuide.tsx`**: Documentation update

