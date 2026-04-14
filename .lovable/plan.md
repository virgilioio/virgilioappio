
## Immediate Fix Plan for the Still-Broken Job Creation Error

## What I found
The previous fix was incomplete.

Live database state shows:
- `organizations_select_consolidated` is already using the new `user_is_member_of_org_hierarchy(...)` helper.
- But `jobs_insert_consolidated` is still using the older `check_org_hierarchy_role_access(organization_id, 'recruiter')`.
- That older helper still queries `public.organizations` internally during the jobs insert permission check.

So the failure is still happening in the job-create path because the jobs RLS logic is calling the old hierarchy helper, not because the UI is wrong.

## Root cause
The create flow in `useJobs.ts` inserts into `jobs`, and the active jobs INSERT policy evaluates:

```sql
check_org_hierarchy_role_access(organization_id, 'recruiter')
```

That helper still depends on direct reads from `organizations`, which is exactly why the error remains:

```text
42501: query would be affected by row-level security policy for table "organizations"
```

In short:
- `organizations` policy was patched
- `jobs` policy path was not fully patched
- SaaS users still hit the old helper during job creation

## Fix to implement

### 1. Patch the hierarchy helper used by jobs RLS
Create a new migration that replaces `check_org_hierarchy_role_access(...)` with an RLS-safe version.

New version should:
- avoid querying `organizations` in a way that depends on caller RLS
- rely on security-definer-safe membership/hierarchy logic
- support current role model correctly:
  - workspace owners
  - admins
  - members/recruiters as intended

Best approach:
- use `user_is_member_of_org_hierarchy(_organization_id)` for hierarchy reachability
- query `members` once for the caller’s role/system role
- evaluate role inheritance in the function itself
- keep `SECURITY DEFINER` and explicit `search_path`

### 2. Recreate the jobs policies to use the safe path consistently
Update live `jobs` policies so they no longer depend on the broken helper behavior.

Specifically review and recreate:
- `jobs_insert_consolidated`
- `jobs_select_consolidated`
- `jobs_update_consolidated`

Goal:
- job creation in child departments works for SaaS workspace owners/admins
- existing visibility/edit behavior does not regress

### 3. Clean up stale overlapping policy/function behavior
There are leftover overlapping policies/helpers on `organizations` and `jobs`.
I’ll keep the urgent fix narrow, but I should also remove or normalize any stale policy pieces that can keep reintroducing confusion in future RLS evaluations.

Priority cleanup candidate:
- review whether `org_owners_can_view_orgs` should remain alongside `organizations_select_consolidated`

### 4. Verify the exact failing scenarios after the migration
Test the flows that matter most:
- SaaS workspace owner creates a job in their root org
- SaaS workspace owner creates a job in a child department
- platform admin still creates jobs successfully
- jobs list still loads after creation
- no new 403/42501 errors in the wizard

## Files / areas involved
- New Supabase migration
- possibly no frontend code changes required for the core fix
- optional follow-up hardening in:
  - `src/hooks/useJobs.ts`

## Technical details
Current live evidence:
- `organizations_select_consolidated` already includes `user_is_member_of_org_hierarchy(id)`
- `jobs_insert_consolidated` still uses:
```sql
check_org_hierarchy_role_access(organization_id, 'recruiter'::text)
```
- live `check_org_hierarchy_role_access(...)` still reads from `public.organizations`
- the affected SaaS user is a `workspace_owner` in the Motive tenant, with child departments present, so this should work once the jobs helper is fixed

## Scope
- 1 migration
- likely no UI changes
- focused RLS repair for the job creation path
