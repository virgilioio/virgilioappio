

# Fix: RLS Error When Updating a Job

## Root Cause

`JobFormSheet.handleSubmit` (line 144) always includes `organization_id` in the update payload. When Supabase/PostgREST processes `.update({ ...data, organization_id })` on the `jobs` table, the foreign key validation and RLS policy evaluation against the `organizations` table triggers the 42501 error for non-platform-admin users.

`organization_id` should never be changed after job creation — it's set at INSERT time only.

## Fix

**File: `src/components/jobs/JobFormSheet.tsx`**

In `handleSubmit`, exclude `organization_id` from the payload when editing an existing job (when `job` prop is present). Only include it for new job creation.

```typescript
const submitData = {
  title: formData.title,
  description: formData.description || null,
  location: formData.location || null,
  salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
  salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
  currency: formData.currency || null,
  status: formData.status,
  ...(job ? {} : { organization_id: formData.organization_id }), // only on create
  skills: selectedSkills,
  auto_generated_skills: autoSkills.length > 0 ? autoSkills : undefined,
  last_skills_generation: autoSkills.length > 0 ? new Date().toISOString() : undefined,
  hiring_team: formData.hiring_team
}
```

Additionally, disable the organization selector when editing (since it can't be changed):
- Add `disabled={!!job}` to the `SearchableSelect` for organization on line ~282.

## Summary

| File | Change |
|------|--------|
| `src/components/jobs/JobFormSheet.tsx` | Exclude `organization_id` from update payload; disable org selector when editing |

One-file fix. No database or RLS changes needed.

