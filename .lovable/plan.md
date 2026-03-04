

# Unify Form Field Builders + Add Phone Number Smart Field

## Problem
The field editor logic is duplicated between `FieldEditor.tsx` (job postings) and `OfferFieldEditor.tsx` (offers). Adding a new smart field type like "Phone" means updating both files independently — error-prone and inconsistent.

## Solution

### 1. Create a shared `FormFieldEditor` component
**New file**: `src/components/shared/FormFieldEditor.tsx`

Extract the common field editor UI into a single, generic component that both form builders consume. It will:
- Accept a generic field shape via props (label, type, required, help_text, field_config, etc.)
- Render the identical view mode (drag handle, label, type badge, required indicator, edit/delete buttons) and edit mode (inline form with type-specific config panels)
- Include **all** smart field types: salary, location, and the new **phone**
- Accept optional props for context-specific features (e.g., `source` badge for job posting fields, `select_options` support)

The existing `FieldEditor.tsx` and `OfferFieldEditor.tsx` become thin wrappers that map their domain-specific data to the shared component's props.

### 2. Add `phone` as a new field type

**Type definitions** — update `src/hooks/useJobPostingFields.ts`:
- Add `'phone'` to the `FieldType` union
- Add `PhoneFieldConfig` interface: `{ defaultCountryCode?: string }` (optional default country)

**Type definitions** — update `src/hooks/useOfferFormFields.ts`:
- Add `'phone'` to the offer field type union
- Import `PhoneFieldConfig`

**Shared FormFieldEditor** — add phone-specific sections:
- **Edit mode**: Purple "Syncs to Profile" config panel (matching salary/location pattern) with a default country code selector
- **View mode**: Phone badge (teal, with Phone icon) + "Syncs to Profile" badge

### 3. Add phone field rendering to public forms
**`src/pages/PublicJobPosting.tsx`** — add a `field_type === 'phone'` rendering branch that uses the existing `PhoneInput` component (`src/components/ui/phone-input.tsx`) with the configured default country code. On submission, sync the value to the candidate's `phone` profile field.

### 4. Add phone field rendering to offer forms
Wherever offer form fields are rendered for input, add the same `phone` rendering branch using `PhoneInput`.

### 5. Migrate existing editors to use the shared component
- **`FieldEditor.tsx`**: Replace internal state/rendering with `<FormFieldEditor>`, passing job-posting-specific props (`source`, `isDefaultLibraryField`, `select_options` loading from `posting_field_select_options`)
- **`OfferFieldEditor.tsx`**: Replace internal state/rendering with `<FormFieldEditor>`, passing offer-specific props

## Files Changed
- **New**: `src/components/shared/FormFieldEditor.tsx` — unified field editor UI
- **Modified**: `src/hooks/useJobPostingFields.ts` — add `phone` to FieldType, add PhoneFieldConfig
- **Modified**: `src/hooks/useOfferFormFields.ts` — add `phone` to field type
- **Modified**: `src/components/jobs/postings/FieldEditor.tsx` — thin wrapper around FormFieldEditor
- **Modified**: `src/components/settings/OfferFieldEditor.tsx` — thin wrapper around FormFieldEditor
- **Modified**: `src/pages/PublicJobPosting.tsx` — render phone fields with PhoneInput, sync to profile
- **Modified**: Offer form rendering (wherever offer fields are rendered for input)

