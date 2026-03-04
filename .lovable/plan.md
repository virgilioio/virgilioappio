

# Offer Form Fields → Document Placeholders: What We Have and What's Missing

## What Already Exists

The system has all the core pieces:

1. **Offer Form Fields** (`offer_form_fields` table) — Each field has a `field_name` (snake_case, auto-derived from label). When a recruiter fills out an offer form, the values are saved as a JSON object in `offer_letters.field_values` keyed by `field_name` (e.g., `{ "start_date": "2026-04-01", "base_salary": {...}, "reporting_manager": "..." }`).

2. **Offer Letter Templates** (`offer_letter_templates` table) — Rich text templates with `{{placeholder}}` syntax. The `PlaceholderHelper` sidebar already shows available placeholders including static ones (`{{candidate.name}}`, `{{job.title}}`) and dynamic ones from `offer_template_fields`.

3. **Placeholder Replacement** (`processOfferLetterTemplate` in `offerLetterUtils.ts`) — Already replaces `{{field.xyz}}` placeholders using `data.fieldValues`.

4. **PlaceholderHelper** — Already renders dynamic field placeholders as `{{field.<field_name>}}` for offer template fields.

## What's Missing

The current architecture has a **disconnect** between the two field systems:

- **`offer_form_fields`** belong to an **Offer Form** (the data-collection step)
- **`offer_template_fields`** belong to an **Offer Letter Template** (the document-generation step)

These are separate, unlinked entities. The PlaceholderHelper shows `offer_template_fields` placeholders, but the actual saved data comes from `offer_form_fields`. There's no guarantee the `field_name` values match between the two.

### The fix is straightforward:

Since the form-first architecture means **Offer Forms are the source of truth for field data**, the PlaceholderHelper (used in the Offer Letter Template editor) should show placeholders derived from **Offer Form fields**, not from the legacy `offer_template_fields` table.

## Proposed Changes

### 1. Update PlaceholderHelper to show Offer Form field placeholders

When editing an Offer Letter Template, the PlaceholderHelper should list all fields from available Offer Forms as `{{field.<field_name>}}` placeholders. This way, template authors know exactly which placeholders they can use based on the forms that will feed data into the template.

- Add an optional `formId` or `offerFormFields` prop to `PlaceholderHelper`
- Show the form's dynamic fields as insertable `{{field.<field_name>}}` placeholders
- Keep showing static placeholders (candidate, job, org, sender) as-is

### 2. Ensure `processOfferLetterTemplate` handles smart field types

The current `formatFieldValue` in `offerLetterUtils.ts` only handles basic types. It needs to format:
- **Salary** fields (JSON `{amount, currency, period}`) → human-readable string
- **Location** fields (JSON `{city, state, country}`) → comma-separated string
- **Recruiter** fields (UUID) → resolved name (requires a lookup)
- **Employment type** / **Work location** → mapped labels (`full_time` → "Full-time")
- **Date** fields → properly formatted dates

### 3. Link Offer Form to Offer Letter Template (optional association)

Allow an Offer Letter Template to be associated with a specific Offer Form so the PlaceholderHelper automatically shows the right field placeholders. This could be a simple `form_id` column on `offer_letter_templates`, or just a dropdown selector in the template editor UI.

## Files to Change

- `src/components/settings/PlaceholderHelper.tsx` — accept form fields, show them as dynamic placeholders
- `src/utils/offerLetterUtils.ts` — enhance `formatFieldValue` for smart field types (salary, location, employment_type, work_location, recruiter)
- `src/components/settings/templates/OfferLetterSheet.tsx` — pass form context to PlaceholderHelper
- Possibly a migration to add `form_id` to `offer_letter_templates` if we want explicit linkage

