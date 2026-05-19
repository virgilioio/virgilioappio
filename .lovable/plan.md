# Step 4 — "Add question" should surface Smart Fields

## What's wrong

The current `+ Add question` dropdown in Step 4 (Job Posting → Application form) lists tenant/platform entries from `useApplicationFields()`. Those are regular custom questions. The user wants **Smart Fields** — the typed primitives that map back to the candidate profile and feed AI:

- `salary`
- `location`
- `phone`
- `linkedin`
- `recruiter`
- `employment_type`
- `work_location`

These are already defined as `SMART_FIELD_TYPES` in `src/components/shared/FormFieldEditor.tsx` and used by `PostingFieldsBuilder.tsx`.

## Change

In `src/components/jobs/wizard/JobPostingStep.tsx`, replace the `useApplicationFields()`-backed dropdown with a Smart-Field-first menu:

1. **Section: Smart fields** (top of menu, grouped)
   - One item per `SMART_FIELD_TYPES` entry, with the matching icon and label via `fieldTypeLabel(t)`.
   - A small lilac "Smart" chip on the right (matches the `Smart` badge already used in `FormFieldEditor` / `PostingFieldsBuilder`).
   - Clicking inserts a posting field with that `field_type`, an auto-generated label, and sensible defaults (mirrors what `PostingFieldsBuilder` does when adding a smart field).
2. **Divider**
3. **Section: Basic question types** (text, textarea, number, email, url, date, select, checkbox, file) — keep the option to add a plain custom question.
4. **Divider**
5. **Section: From library** — keep the existing `useApplicationFields()` entries here under a "From your library" label so they remain reachable but are no longer the headline choice.

Dropdown chrome follows the Gio dropdown spec already used elsewhere in the wizard (shared `menuPanel`, 30h items, group labels in 10px caps, lilac selected state).

## Technical notes

- Reuse `SMART_FIELD_TYPES` and `fieldTypeLabel` from `@/components/shared/FormFieldEditor` so there is one source of truth.
- The wizard currently keeps application form state locally (not bound to a real posting row yet), so adding a field = pushing a new `AppField`-shaped entry with `field_type`, default label, `is_required: false`, generated id. No backend changes.
- No DB migrations. No changes to `useApplicationFields` or `useJobPostingFields`.

## Out of scope

- Renaming/refactoring the underlying `AppField` shape.
- Touching `PostingFieldsBuilder` (already smart-field aware).
- Step 5 (Summary).
