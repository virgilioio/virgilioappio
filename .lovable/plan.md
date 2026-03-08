

# Fix: Allow Workspace Owners to Update Their Own Tenant

## Problem
The `tenants` table RLS policies only allow:
- **Platform admins**: full access (ALL)
- **Regular users**: SELECT only (`tenants_users_select_own`)

There is **no UPDATE policy** for workspace owners, so when a SaaS customer tries to update their company profile, the update returns 0 rows (RLS blocks it), causing the PGRST116 error.

## Fix

### Database Migration
Add an UPDATE policy allowing users with tenant access to update their own tenant:

```sql
CREATE POLICY "tenants_users_update_own"
ON public.tenants
FOR UPDATE
TO authenticated
USING (user_has_tenant_access(id))
WITH CHECK (user_has_tenant_access(id));
```

This uses the existing `user_has_tenant_access()` function (same one used by the SELECT policy), so only members of a tenant can update it.

### No code changes needed
The `useTenant.ts` hook logic is correct — the RLS policy is the only blocker.

