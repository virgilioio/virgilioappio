

# Add "Recruiter" Smart Field Type

## Overview
Add a new `recruiter` field type that renders a searchable autocomplete selector populated with active recruiters/admins from the tenant. This follows the same "smart field" pattern as salary, location, and phone.

## Changes

### 1. Type definitions
- **`src/hooks/useJobPostingFields.ts`**: Add `'recruiter'` to the `FieldType` union. No config interface needed (tenant scoping is automatic).
- **`src/hooks/useOfferFormFields.ts`**: Add `'recruiter'` to the offer field type union.

### 2. Database migration
- Add `'recruiter'` to the `public.field_type` enum (`ALTER TYPE public.field_type ADD VALUE 'recruiter'`).

### 3. Shared FormFieldEditor (`src/components/shared/FormFieldEditor.tsx`)
- Add `'recruiter'` to `ALL_FIELD_TYPES` and `fieldTypeLabel` (label: "Recruiter").
- Mark it as a smart field (purple badge, "Team Member" indicator in view mode, Users icon).
- No special config panel needed in edit mode (unlike salary/location — it auto-populates from the tenant).

### 4. Render recruiter field in offer forms
- **`src/components/candidates/OfferComposerBody.tsx`**: Add `case 'recruiter'` that renders a `SearchableSelect` populated with active members (recruiters + admins) from the tenant. Create a small hook or inline query to fetch members.
- **`src/components/candidates/CreateOfferLetterDialog.tsx`**: Same rendering.
- Store the selected member's `user_id` as the field value.

### 5. New hook: `useRecruiterOptions`
**New file**: `src/hooks/useRecruiterOptions.ts`

Small hook that:
- Queries `members` table filtered by `tenant_id`, `user_status = 'active'`, and `member_role in ('admin', 'recruiter')` (or optionally workspace owners)
- Returns `SearchableSelectOption[]` with `value = user_id`, `label = "First Last"`, `badge = role`

### 6. Render recruiter field in public job postings (if applicable)
- In `PublicJobPosting.tsx`, the recruiter field type would be hidden/skipped for public-facing forms (candidates don't select recruiters). Add a skip condition.

## Files Changed
- **New**: `src/hooks/useRecruiterOptions.ts`
- **Migration**: Add `'recruiter'` to `field_type` enum
- **Modified**: `src/hooks/useJobPostingFields.ts` — add to FieldType union
- **Modified**: `src/hooks/useOfferFormFields.ts` — add to field type union
- **Modified**: `src/components/shared/FormFieldEditor.tsx` — smart field UI
- **Modified**: `src/components/candidates/OfferComposerBody.tsx` — render SearchableSelect
- **Modified**: `src/components/candidates/CreateOfferLetterDialog.tsx` — render SearchableSelect
- **Modified**: `src/pages/PublicJobPosting.tsx` — skip recruiter fields on public forms

