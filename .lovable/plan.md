## Problem

Creating a stage from **Platform Settings → Job Defaults → Stages** fails with RLS error `new row violates row-level security policy for table "job_stages"`.

The hook inserts the row with `tenant_id = NULL` (platform-default), but the only write policy on `job_stages` today is:

```
job_stages_workspace_owner_manage:
  tenant_id = get_user_tenant_id() AND user_is_workspace_owner_in_tenant(tenant_id)
```

There is no policy that allows a **platform admin** to insert/update/delete rows where `tenant_id IS NULL` (the platform defaults). So every attempt from the Platform settings page is rejected.

## Fix

Add a dedicated RLS policy on `public.job_stages` that lets platform admins manage platform-default rows.

### Migration

```sql
CREATE POLICY job_stages_platform_admin_manage
ON public.job_stages
FOR ALL
TO authenticated
USING (
  tenant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_type = 'platform_admin'
      AND m.user_status = 'active'
  )
)
WITH CHECK (
  tenant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_type = 'platform_admin'
      AND m.user_status = 'active'
  )
);
```

Existing policies (`select_consolidated`, `workspace_owner_manage`) stay unchanged, so tenant workspace owners keep managing their own stages and everyone keeps reading platform defaults.

## No code changes required

`useJobStages.createStage` already sets `tenant_id = null` correctly for the `platform-defaults` context. Once the policy exists, the insert will succeed.

## Verification

1. As a platform admin, add / rename / delete a stage in Platform Settings → Job Defaults → Stages — succeeds without toast error.
2. As a regular workspace owner, the same screen should still be unreachable / read-only (no regression on tenant management).
