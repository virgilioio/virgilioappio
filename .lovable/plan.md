

# Align Offer Form Field Builder to Job Posting Field Builder Pattern

## Problem
The offer form field management (`OfferFormFieldsManager`) uses a **Dialog** modal for creating/editing fields and displays them in a **Table** layout. The job posting field builder (`PostingFieldsBuilder` + `FieldEditor`) uses an **inline card-based pattern** with drag handles, inline editing, and a compact "Add Custom Field" row at the bottom. These need to be consistent.

## Solution
Rewrite `OfferFormFieldsManager` to use the same inline `FieldEditor`-style pattern used by the job posting form builder:

### 1. Create `src/components/settings/OfferFieldEditor.tsx`
A new component modeled after `src/components/jobs/postings/FieldEditor.tsx` but adapted for offer form fields:
- **View mode**: Inline card with drag handle, field label, type badge, required indicator, edit/delete buttons — identical visual pattern to `FieldEditor`
- **Edit mode**: Inline expanded form (label, type, required, help text, salary/location config, file config) — same layout as `FieldEditor`
- Adapts the data model to use `OfferFormField` instead of `PostingField` (minor differences: `form_id` instead of `posting_id`, no `column_span`/`source`/`application_field_id`)

### 2. Rewrite `src/components/settings/OfferFormFieldsManager.tsx`
Replace the current Dialog+Table approach with:
- A list of `OfferFieldEditor` cards (one per field), with drag-to-reorder using `@dnd-kit/sortable`
- An "Add Custom Field" inline row at the bottom (label input + type select + required checkbox + Add button) — matching the PostingFieldsBuilder's add-field section
- Remove the Dialog entirely
- Keep the branded Gio empty state
- Delete confirmation stays as AlertDialog (consistent with FieldEditor)

### 3. No style guide changes needed
The `FieldEditor` component pattern already exists in the job posting builder. This change brings offer forms into alignment with that existing pattern rather than introducing a new one.

## Files Changed
- **New**: `src/components/settings/OfferFieldEditor.tsx`
- **Rewritten**: `src/components/settings/OfferFormFieldsManager.tsx`

