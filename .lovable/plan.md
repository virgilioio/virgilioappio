

## Add "Location" Smart Field + Smart Fields Style Guide

### Overview
Add "Location" as a new Smart Field type in the job posting form builder, following the exact same pattern as Salary. Also create a Smart Fields section in the Style Guide for documentation.

### Step 1: Database Migration
Add `location` to the `field_type` enum:
```sql
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'location';
```

### Step 2: Type Definitions
**File: `src/hooks/useJobPostingFields.ts`**
- Add `'location'` to `FieldType` union
- Add `LocationFieldConfig` interface: `{ fields: ('city' | 'state' | 'country')[] }`
- Update `PostingField.field_config` type to include `LocationFieldConfig`

### Step 3: Builder -- Add Field Section
**File: `src/components/jobs/postings/PostingFieldsBuilder.tsx`**
- Add `'location'` to the type dropdown (alongside salary) with label "Location"
- Add `LocationFieldConfig` state, defaulting to `{ fields: ['city', 'state', 'country'] }`
- When `type === 'location'`: show purple "Syncs to Candidate Profile" container (same pattern as salary) with checkboxes for City, State/Province, Country
- Auto-set label to "Location" when type is selected (same as salary auto-sets "Salary Expectations")
- Pass `field_config` to `addCustomField`
- Reset location config state when type changes

### Step 4: Builder -- Field Editor (View + Edit Mode)
**File: `src/components/jobs/postings/FieldEditor.tsx`**
- Add `'location'` to `ALL_FIELD_TYPES` array
- Import `MapPin` icon from lucide-react
- **View mode**: When `field.field_type === 'location'`, display:
  - Orange/teal MapPin badge "Location" (similar green pattern as salary's DollarSign)
  - Blue "Syncs to Profile" badge with Link2 icon
  - Gray badge showing configured sub-fields (e.g., "City, State, Country")
- **Edit mode**: Add `showLocationConfig` flag. When true, show purple container with:
  - "Syncs to Candidate Profile" header with Link2 icon
  - Info box explaining location sync
  - Checkboxes for city/state/country sub-fields
- Add `localLocationConfig` state, initialize from `field.field_config`
- Include `field_config` in save handler for location type

### Step 5: Public Form Rendering
**File: `src/components/forms/ApplicationFieldsRenderer.tsx`**
- Add `location` case that renders a group of text inputs based on `field_config.fields`:
  - City input (if 'city' in fields)
  - State/Province input (if 'state' in fields)
  - Country input (if 'country' in fields)
- Store value as JSON object `{ city: "...", state: "...", country: "..." }` via `formField.onChange`
- Green help text: "This will be added to your candidate profile."
- Import MapPin icon for the field group header

### Step 6: Submission Sync
**File: `src/pages/PublicJobPosting.tsx`**
- Add `'location'` to the local `FieldType` union
- In submission handler, detect location fields and build `location_sync` object:
  ```ts
  location_sync: { city?: string; state?: string; country?: string }
  ```
- Pass alongside existing `salary_sync` in the payload

**File: `supabase/functions/public-submit-application/index.ts`**
- Add `location_sync` to `SubmitApplicationPayload` interface
- After salary sync block, add location sync: update `location_city`, `location_state`, `location_country` on the candidate record (same pattern as salary sync)

### Step 7: Style Guide
**New file: `src/components/settings/styleguide/SmartFieldsGuide.tsx`**
- Title: "Smart Fields"
- Description: Fields that sync data to the candidate profile for filtering and automation
- Show examples of both Salary and Location Smart Fields:
  - Builder view mode badges (green/orange type badge + blue sync badge + gray config badge)
  - Purple config container pattern
  - Public form rendering with green help text

**File: `src/components/settings/StyleGuide.tsx`**
- Import and add `SmartFieldsGuide` component

### Files Changed Summary

| File | Action |
|---|---|
| Database migration | Add `location` to `field_type` enum |
| `src/hooks/useJobPostingFields.ts` | Add `LocationFieldConfig` + update types |
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Location in type dropdown + purple config container |
| `src/components/jobs/postings/FieldEditor.tsx` | Location badges in view mode + config in edit mode |
| `src/components/forms/ApplicationFieldsRenderer.tsx` | Location multi-input rendering + green help text |
| `src/pages/PublicJobPosting.tsx` | Location type + `location_sync` in submission |
| `supabase/functions/public-submit-application/index.ts` | Handle `location_sync` and update candidate |
| `src/components/settings/styleguide/SmartFieldsGuide.tsx` | New style guide component |
| `src/components/settings/StyleGuide.tsx` | Add SmartFieldsGuide |

