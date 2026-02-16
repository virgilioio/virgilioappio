
## Add "Location" Smart Field + Style Guide for Smart Fields

### Overview
Add a new "Location" answer type to the job posting form builder that mirrors the candidate profile's location structure (`location_city`, `location_state`, `location_country`). It follows the exact same "Smart Field" pattern as Salary -- purple config container, colored badges in view mode, green help text on the public form, and automatic sync to the candidate profile on submission.

Additionally, create a **Smart Fields Guide** in the Style Guide to document these reusable profile-syncing field patterns for future reference.

### What Are Smart Fields?
Smart Fields are answer types in the form builder that:
- Sync submitted data directly to the candidate's profile fields
- Have a distinctive purple configuration UI with "Syncs to Candidate Profile" header
- Display colored badges (green type badge, blue sync badge, gray config badge) in the builder's view mode
- Show green help text on the public form explaining the profile sync

Currently: **Salary**. After this change: **Salary + Location**.

### Technical Details

**1. Database: Add `location` to `field_type` enum**

Migration: `ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'location'`

No new columns needed -- the existing `field_config` JSONB column will store `{ "fields": ["city", "state", "country"] }` (all three enabled by default; future-proofs if we want to make sub-fields optional).

**2. Type updates**

| File | Change |
|---|---|
| `src/hooks/useJobPostingFields.ts` | Add `'location'` to `FieldType` union. Add `LocationFieldConfig` interface: `{ fields: ('city' \| 'state' \| 'country')[] }`. Update `field_config` type to `SalaryFieldConfig \| LocationFieldConfig \| null`. |

**3. Builder UI**

| File | Change |
|---|---|
| `PostingFieldsBuilder.tsx` | Add `'location'` to type dropdown (with MapPin icon). When selected: show purple "Syncs to Candidate Profile" container (same as salary). Auto-set label to "Location". Pass `field_config: { fields: ['city', 'state', 'country'] }` to `addCustomField`. Add `LocationFieldConfig` state. |
| `FieldEditor.tsx` | **View mode**: Show orange/teal MapPin badge "Location", blue "Syncs to Profile" badge, gray "City, State, Country" config badge. **Edit mode**: Purple container with sync header + info box explaining location sync. Config options for which sub-fields to include (city/state/country checkboxes). |

**4. Public form rendering**

| File | Change |
|---|---|
| `ApplicationFieldsRenderer.tsx` | Add `location` case: render a group of up to 3 inputs (City, State/Province, Country) based on `field_config.fields`. Each is a simple text input. Green help text: "This will be added to your candidate profile." |

**5. Candidate profile sync**

| File | Change |
|---|---|
| `PublicJobPosting.tsx` | Add `'location'` to the local `FieldType` union. On submission, detect location fields and build a `location_sync` object: `{ city?: string, state?: string, country?: string }`. Pass it alongside `salary_sync` in the payload. |
| `supabase/functions/public-submit-application/index.ts` | Accept `location_sync` in the payload interface. If present, update `location_city`, `location_state`, `location_country` on the candidate record (same pattern as salary sync). |

**6. Public form data handling**

For the location field, the form value will be stored as a JSON string `{"city":"...","state":"...","country":"..."}` in `customFieldResponses`. The renderer will manage the three sub-inputs internally and combine them into this structure via `onChange`.

**7. Style Guide -- Smart Fields Guide**

| File | Change |
|---|---|
| New: `src/components/settings/styleguide/SmartFieldsGuide.tsx` | A style guide card titled "Smart Fields" showing: (1) the badge patterns for Salary and Location in builder view mode, (2) the purple config container pattern, (3) the public form rendering with green help text. Interactive examples using existing Badge, Input, and Select components. |
| `src/components/settings/StyleGuide.tsx` | Import and add `SmartFieldsGuide` to the guide list. |

### Visual Consistency

The Location field uses the same three-tier visual system as Salary:

| Context | Visual Treatment |
|---|---|
| **Builder view mode** | Orange-teal MapPin badge "Location" + Blue "Syncs to Profile" badge + Gray "City, State, Country" badge |
| **Builder edit/add mode** | Purple container (`bg-virgilio-purple/5`) with Link2 icon header, info box, and sub-field config checkboxes |
| **Public form** | Labeled group of text inputs (City, State/Province, Country) + green help text about profile sync |

### Files Changed

| File | Action |
|---|---|
| New migration | Add `location` to `field_type` enum |
| `src/hooks/useJobPostingFields.ts` | Add location type + `LocationFieldConfig` interface |
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Location in type dropdown + purple config container |
| `src/components/jobs/postings/FieldEditor.tsx` | Location badges in view mode + purple config in edit mode |
| `src/components/forms/ApplicationFieldsRenderer.tsx` | Location multi-input rendering + green help text |
| `src/pages/PublicJobPosting.tsx` | Location type + `location_sync` in submission payload |
| `supabase/functions/public-submit-application/index.ts` | Handle `location_sync` and update candidate fields |
| New: `src/components/settings/styleguide/SmartFieldsGuide.tsx` | Style guide documenting Smart Field patterns |
| `src/components/settings/StyleGuide.tsx` | Add SmartFieldsGuide to the guide |
