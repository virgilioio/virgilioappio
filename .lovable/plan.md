

## Add Type-Specific Configuration to Job Posting Field Editor

### Problem
When customizing application form fields in the job posting form builder, selecting any field type (checkbox, select, file, etc.) shows no type-specific configuration options. Users cannot:
- Define options for **Select** fields
- Configure **Checkbox** behavior (currently only a single true/false toggle with no way to add multiple choices)
- Set accepted file types or max size for **File** fields  
- Add placeholder/help text for **Text**, **Textarea**, **URL**, **Number**, **Email** fields

The Platform Library form (`ApplicationFieldForm`) already has these configuration panels, but the per-posting `FieldEditor` does not.

### Solution
Enhance the `FieldEditor` component to show type-specific configuration sections when in edit mode, matching the capabilities already available in the platform library form. Also add a new "checkbox_group" field type for multi-option checkboxes.

### What Each Field Type Will Show When Editing

| Type | Current Config | New Config Added |
|---|---|---|
| text, email, url | Label, Type, Required | + Placeholder text, Help text |
| number | Label, Type, Required | + Placeholder text, Help text |
| textarea | Label, Type, Required | + Placeholder text, Help text |
| select | Label, Type, Required | + Options editor (add/remove value+label pairs) |
| checkbox | Label, Type, Required | + Help text (remains a single true/false toggle) |
| checkbox_group | N/A (new type) | + Options editor (add/remove choices), Help text |
| date | Label, Type, Required | + Help text |
| file | Label, Type, Required | + Accepted file types, Max file size |

### Technical Details

**1. Add "checkbox_group" field type**

| File | Change |
|---|---|
| `src/hooks/useJobPostingFields.ts` | Add `'checkbox_group'` to the `FieldType` union |
| `src/components/forms/ApplicationFieldsRenderer.tsx` | Add a `checkbox_group` case that renders multiple checkboxes from stored options |

**2. Enhance `FieldEditor` component**

| File | Change |
|---|---|
| `src/components/jobs/postings/FieldEditor.tsx` | Add local state for `placeholder_text`, `help_text`, `accepted_file_types`, `max_file_size_mb`, and `select_options`. Show type-specific configuration sections in edit mode. Load existing select options from `posting_field_select_options` table when entering edit mode. Save all type-specific data on Save. |

The FieldEditor edit mode will expand to show relevant configuration based on the selected type:
- **select / checkbox_group**: An inline options editor (add/remove rows with value + label fields)
- **file**: Checkboxes for accepted file types + max file size input
- **text / textarea / email / url / number**: Placeholder text + help text inputs
- **checkbox / date**: Help text input only

**3. Save select/checkbox_group options to database**

| File | Change |
|---|---|
| `src/hooks/useJobPostingFields.ts` | Extend `updateField` to accept and persist select options to `posting_field_select_options` table (delete existing + re-insert pattern) |
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Pass options data through the save flow |

**4. Update Add Custom Field section**

| File | Change |
|---|---|
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Add `checkbox_group` to the type dropdown. Show inline options editor when `select` or `checkbox_group` is chosen. Show file config when `file` is chosen. Show placeholder/help text inputs for other types. |

**5. Update the public-facing renderer**

| File | Change |
|---|---|
| `src/components/forms/ApplicationFieldsRenderer.tsx` | Add `checkbox_group` case: render a group of checkboxes based on field options, storing selected values as an array |
| `src/pages/PublicJobPosting.tsx` | Ensure `checkbox_group` fields also fetch their options from `posting_field_select_options` |

### Summary of Files Changed
- `src/hooks/useJobPostingFields.ts` -- add type, extend updateField
- `src/components/jobs/postings/FieldEditor.tsx` -- type-specific config UI in edit mode
- `src/components/jobs/postings/PostingFieldsBuilder.tsx` -- type-specific config in "Add Field" section, add checkbox_group type
- `src/components/forms/ApplicationFieldsRenderer.tsx` -- render checkbox_group
- `src/pages/PublicJobPosting.tsx` -- fetch options for checkbox_group fields

