

## Fix: Select Field Options Not Saving in Form Builder

### Root Cause

The `posting_field_select_options` table is missing RLS policies for INSERT, UPDATE, and DELETE. It only has a single SELECT policy (for public viewing of active postings). When a recruiter edits a select field and clicks Save, the code does:

1. `DELETE FROM posting_field_select_options WHERE posting_field_id = ?` -- **blocked by RLS**
2. `INSERT INTO posting_field_select_options (...)` -- **blocked by RLS**

Both fail silently (Supabase returns no error for zero-affected rows with RLS), so options are never persisted.

### Solution

Add INSERT, UPDATE, and DELETE RLS policies on `posting_field_select_options` matching the same access pattern used on the parent `job_posting_application_fields` table: allow org members with recruiter role or users assigned to the job, plus platform admins.

### Technical Changes

**1. Database Migration -- Add RLS policies for `posting_field_select_options`**

Three new policies, mirroring the parent table's access pattern:

- **INSERT**: Allow if the user is a platform admin OR has recruiter-level access to the org that owns the posting, OR is assigned to the job.
- **DELETE**: Same condition as INSERT.
- **UPDATE**: Same condition (for completeness).
- **SELECT for org members**: Allow authenticated org members to view options for their postings (currently only public/active postings have a SELECT policy).

The policies join through: `posting_field_select_options` -> `job_posting_application_fields` (via `posting_field_id`) -> `job_postings` -> `jobs` -> org check.

**2. No code changes needed**

The existing code in `useJobPostingFields.ts` (the delete + re-insert pattern at lines 202-213) and `FieldEditor.tsx` (passing `select_options` on save at lines 84-86) are already correct. They will work once RLS allows the operations.

### Files Modified

| Target | Change |
|---|---|
| New SQL migration | Add INSERT, DELETE, UPDATE, and org-member SELECT policies on `posting_field_select_options` |

