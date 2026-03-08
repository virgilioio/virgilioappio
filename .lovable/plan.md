

# Add Smart "LinkedIn" Field Type

## Overview
Add `linkedin` as a new Smart Field type across the entire form builder system, with LinkedIn-specific URL input, icon branding, and automatic sync to `candidate.linkedin_url` on public application submission.

## Changes

### 1. Database Migration
Add `linkedin` to the `field_type` enum:
```sql
ALTER TYPE field_type ADD VALUE 'linkedin';
```

### 2. `src/hooks/useJobPostingFields.ts`
Add `'linkedin'` to the `FieldType` union type.

### 3. `src/components/shared/FormFieldEditor.tsx`
- Add `'linkedin'` to `ALL_FIELD_TYPES` and `SMART_FIELD_TYPES`
- Add `case 'linkedin': return 'LinkedIn'` to `fieldTypeLabel()`
- Add `'linkedin'` to the `isSmartField` check (line 178)
- Add view-mode badge block after `work_location` badges (~line 387): LinkedIn icon (blue) + "Syncs to Profile" badge
- Import `Linkedin` from lucide-react (or use `LinkedInFilled`)

### 4. `src/components/jobs/postings/PostingFieldsBuilder.tsx`
Add auto-label in the `useEffect` (~line 76):
```tsx
if (type === 'linkedin' && !label) setLabel('LinkedIn Profile')
```

### 5. `src/pages/PublicJobPosting.tsx`
- Import `Linkedin` icon
- Add `linkedinSync` variable alongside `phoneSync` (~line 447)
- Detect `field.field_type === 'linkedin'` in the submission loop to capture URL
- Add rendering block (~after line 943): `<Input type="url">` with LinkedIn icon, placeholder `https://linkedin.com/in/yourprofile`, green "Syncs to your candidate profile" text
- Pass `linkedin_sync: linkedinSync` in the submission body (~line 488)

### 6. `supabase/functions/public-submit-application/index.ts`
- Add `linkedin_sync?: string | null` to the `SubmitApplicationPayload` interface
- After the location sync block (~line 349), add LinkedIn sync: update `candidate.linkedin_url` when `body.linkedin_sync` is present (same pattern as salary/location sync)

### 7. `src/components/settings/styleguide/SmartFieldsGuide.tsx`
Add LinkedIn example to badge patterns and public form sections (LinkedIn icon + "Syncs to Profile" badge, URL input preview).

## No changes needed
- `OfferFieldEditor.tsx` — no config panel needed, works automatically via FormFieldEditor
- No new tables or columns — `candidate.linkedin_url` already exists

