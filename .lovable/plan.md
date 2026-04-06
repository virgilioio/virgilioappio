

# Fix: Workspace Owners Cannot Delete Members

## Root Cause

There are **two deletion paths** in `UserDeletionDialog.tsx`, and **both** are restricted to platform admins only:

1. **Invited members** (no `user_id`): calls `admin_manage_member` RPC → line 31 checks `IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Unauthorized'`
2. **Registered members** (has `user_id`): calls `delete-user` edge function → line 42-48 checks `get_user_type() !== 'platform_admin'` and returns 403

Workspace owners hit one of these walls depending on whether the member has a `user_id` or not.

## Fix

### 1. `admin_manage_member` RPC — Allow workspace owners (DB migration)

Replace the strict `is_platform_admin()` check with a check that also allows workspace owners operating within their own tenant:

```sql
CREATE OR REPLACE FUNCTION public.admin_manage_member(p_member_id uuid, p_changes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'audit'
AS $$
DECLARE v_old_values jsonb; v_user_email text; v_operation text; v_member_tenant uuid;
BEGIN
  -- Get the member's tenant
  SELECT tenant_id INTO v_member_tenant FROM public.members WHERE id = p_member_id;
  
  -- Allow platform admins OR workspace owners in the same tenant
  IF NOT public.is_platform_admin() 
     AND NOT public.user_is_workspace_owner_in_tenant(v_member_tenant) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- ... rest unchanged
END;
$$;
```

### 2. `delete-user` edge function — Allow workspace owners

Update the permission check (lines 42-48) to also accept `workspace_owner`, but only when the target user belongs to the same tenant:

```typescript
// Instead of: if (userType !== 'platform_admin')
// Check: platform_admin OR workspace_owner deleting within their tenant
const { data: userType } = await supabaseClient.rpc('get_user_type')
if (userType !== 'platform_admin' && userType !== 'workspace_owner') {
  return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403, ... })
}

// For workspace owners, verify the target user belongs to their tenant
if (userType === 'workspace_owner') {
  const { data: callerOrg } = await supabaseClient.rpc('get_user_organization_id')
  const { data: callerTenant } = await supabaseAdmin
    .from('organizations').select('tenant_id').eq('id', callerOrg).single()
  const { data: targetMember } = await supabaseAdmin
    .from('members').select('tenant_id').eq('user_id', body.userId).single()
  
  if (!callerTenant || !targetMember || callerTenant.tenant_id !== targetMember.tenant_id) {
    return new Response(JSON.stringify({ error: 'Cannot delete users outside your tenant' }), { status: 403, ... })
  }
}
```

## Files changed

| File | Change |
|------|--------|
| DB migration | Update `admin_manage_member` to allow workspace owners in same tenant |
| `supabase/functions/delete-user/index.ts` | Allow `workspace_owner` with same-tenant verification |

