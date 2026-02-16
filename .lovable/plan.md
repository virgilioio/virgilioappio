

## Simplify Custom Field Configuration

### Current State
When adding or editing a custom form field, users see separate inputs for:
- **Label** (e.g., "Portfolio URL") -- displayed above the field
- **Placeholder** (e.g., "Enter your portfolio URL") -- hint text inside the field  
- **Help Text** (e.g., "Provide a link to your work") -- small text below the field

This is more complexity than needed. Most users just want to name the field and pick a type.

### Proposed Simplification
- **Remove the Placeholder input** from both the "Add Custom Field" form and the FieldEditor edit mode
- **Auto-generate placeholder** from the label at render time in the public form:
  - Text/Email/URL/Number: "Enter your {label}" (e.g., "Enter your Portfolio URL")
  - Textarea: "Enter your {label}"
  - Select: "Select {label}" (e.g., "Select Department")
  - File: "Upload {label}"
- **Keep Help Text** but make it a single optional field (collapsed or clearly optional)
- The `placeholder_text` database column stays, but is only set if the auto-generated value isn't good enough (future power-user option)

### What Changes

**PostingFieldsBuilder.tsx (Add Custom Field section)**
- Remove `newPlaceholder` state and the Placeholder input field
- For text-based types, show only the Help Text input (not a 2-column grid)
- Stop passing `placeholder_text` to `addCustomField` (let it default to null; the renderer handles it)

**FieldEditor.tsx (Edit existing field)**
- Remove the Placeholder input from the edit mode UI
- Remove `localPlaceholder` state
- Stop saving `placeholder_text` in `handleSave` (keep whatever was already stored)
- For text-based types, show only the Help Text input

**ApplicationFieldsRenderer.tsx (Public form rendering)**
- Update placeholder logic: if `placeholder_text` is null/empty, auto-generate from `field_label`
- Add a helper function: `getPlaceholder(field)` that returns the appropriate auto-generated string based on type

### Result
The "Add Field" form becomes: **Label + Type + Required + (type-specific config)**. No placeholder input. Fewer fields = faster configuration, matching how tools like Greenhouse and Ashby handle custom questions (they only ask for the question text and answer type).

### Files Changed
| File | Change |
|---|---|
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Remove placeholder state and input from Add Custom Field section |
| `src/components/jobs/postings/FieldEditor.tsx` | Remove placeholder input from edit mode |
| `src/components/forms/ApplicationFieldsRenderer.tsx` | Auto-generate placeholder from label when not explicitly set |

