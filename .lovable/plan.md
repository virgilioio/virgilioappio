

# Fix: Notifications "Mark as Read" Not Working

## Root Cause

The RLS UPDATE policy on `email_logs` requires `auth.uid() = user_id`. However:

1. **Received emails have `user_id` set to the mail identity owner** (the Gmail account owner), not necessarily the logged-in user trying to mark it as read.
2. **Some received emails have `user_id = NULL`**, making the policy always fail.
3. **Admins viewing org-wide notifications** can see emails (via SELECT policy using org hierarchy) but cannot update them because the UPDATE policy is strictly `auth.uid() = user_id`.

This means the `.update({ is_read: true })` call silently fails (Supabase returns no error on RLS-blocked updates, it just updates 0 rows).

## Fix

**Update the RLS UPDATE policy** on `email_logs` to allow any org member who can read the email to also mark it as read. Replace the current `email_logs_users_update` policy:

**Current policy:**
```sql
auth.uid() = user_id
```

**New policy** — allow update if the user belongs to the same organization (matching the SELECT access pattern):
```sql
-- USING: user belongs to org OR is assigned to the job
(user_has_org_hierarchy_access(organization_id) OR 
 ((job_id IS NOT NULL) AND is_user_assigned_to_job(job_id)))
-- WITH CHECK: same condition
```

This mirrors the existing SELECT policy (`email_logs_select_consolidated`), ensuring anyone who can see the email can also mark it as read.

Also update the platform admin UPDATE policy's WITH CHECK to match its USING clause (already correct).

| Change | Detail |
|---|---|
| Drop `email_logs_users_update` policy | Too restrictive — only allows `user_id` match |
| Create new `email_logs_org_update` policy | Mirrors SELECT policy: org hierarchy access OR job assignment |
| No code changes needed | The `markEmailAsRead` mutation in `usePendingActivities.ts` is correct — the RLS policy is the blocker |

