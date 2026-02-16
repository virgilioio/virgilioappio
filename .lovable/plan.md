

## Fix Field Editor Type-Specific Configuration

### Problem
The FieldEditor component already has the correct UI for type-specific configuration (options editor for select/checkbox_group, file config, placeholder/help text). However, it doesn't work because:

1. **Options are silently dropped on save**: `PostingFieldsBuilder` passes `updateLocalField` as the `onUpdate` prop, which only stores flat `Partial<PostingField>` updates. The `select_options` key gets discarded and is never persisted when the user clicks "Save Changes."

2. **"Add Custom Field" has no type-specific config**: When adding a new custom field of type select, checkbox_group, or file, there's no UI to configure options, accepted file types, or placeholder text before adding.

### Solution

#### 1. Fix FieldEditor save flow (immediate persistence)

Change the FieldEditor to save directly to the database when the user clicks its "Save" button, rather than routing through the batch local-state pattern. The FieldEditor already has its own Edit/Save/Cancel flow with local state, so immediate save is the natural behavior.

**File: `src/components/jobs/postings/PostingFieldsBuilder.tsx`**
- Pass the hook's `updateField` function directly as `onUpdate` to FieldEditor (instead of `updateLocalField`)
- After `updateField` completes, call `refetch()` to sync state
- Keep the batch pattern for reordering and deleting (those still make sense as batch operations)

#### 2. Add type-specific config to "Add Custom Field" section

**File: `src/components/jobs/postings/PostingFieldsBuilder.tsx`**
- Add local state for: `newPlaceholder`, `newHelpText`, `newAcceptedFileTypes`, `newMaxFileSize`, `newOptions` (array of value+label pairs)
- When type is `select` or `checkbox_group`: show an inline options editor (add/remove rows with Value + Label inputs) -- same pattern as FieldEditor
- When type is `file`: show accepted file types and max file size inputs
- When type is `text`, `email`, `url`, `number`, `textarea`: show placeholder and help text inputs
- When type is `checkbox` or `date`: show help text input only
- Pass these values through `handleAddCustom` to `addCustomField`
- Reset all type-specific state when the type dropdown changes or after adding

#### 3. Visual alignment

- Options editor sections use a subtle bordered container with `border border-border/30 rounded-brand p-3` (matching the FieldEditor's existing pattern)
- "Add Option" button uses `variant="outline" size="sm"` with a Plus icon
- Remove option buttons use `variant="ghost" size="icon"` with a Trash icon
- Type-specific fields appear below the Label/Type/Required row with smooth conditional rendering

### Files Changed

| File | Change |
|---|---|
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Pass `updateField` + `refetch` to FieldEditor instead of `updateLocalField`. Add type-specific config UI to "Add Custom Field" section with options editor, file config, and placeholder/help text inputs. |

### What Users Will See

- **Editing existing fields**: Click Edit on a select/checkbox_group field, the options editor appears immediately. Click Save, options persist to the database.
- **Adding new fields**: Select "Select" or "Checkbox Group" as the type, an inline options editor appears. Add value+label pairs before clicking "Add Custom Field."
- **File fields**: Configuration for accepted types and max size appears when "File" type is selected.
- **Text-based fields**: Placeholder and help text inputs appear for text, email, url, number, textarea types.

