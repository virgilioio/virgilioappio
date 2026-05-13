## Problem

The migration `20260513040411` recreated `public.user_is_crm_admin_in_tenant(_tenant_id uuid)` as a `LANGUAGE sql` function marked `STABLE` with `SET search_path = public, pg_temp`. Postgres rejects `SET` clauses on non-VOLATILE SQL-language functions, throwing:

```
0A000: SET is not allowed in a non-volatile function
```

Because this function is referenced by RLS policies on `deals`, `deal_stages`, `deal_payments` (and is co-loaded with related schemas), PostgREST raises this error across many unrelated hooks: Members, Sourcing Credits, Stale Candidates, Billing Status, Organization Tree, Sourcing Projects, etc.

## Fix

Create a new migration that recreates `user_is_crm_admin_in_tenant` as a `LANGUAGE plpgsql` function (matching the original from migration `20260512233512`), keeping the new "sales" admission rule:

```sql
CREATE OR REPLACE FUNCTION public.user_is_crm_admin_in_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR _tenant_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = v_uid
      AND m.tenant_id = _tenant_id
      AND m.user_status = 'active'
      AND (
        m.user_type IN ('platform_admin', 'workspace_owner')
        OR m.system_role IN ('admin', 'sales')
      )
  );
END;
$$;
```

`plpgsql` allows the `SET search_path` clause with `STABLE`, and the body preserves the Sales role grant. No frontend changes needed.

## Verification

- After migration runs, reload the app and confirm the `0A000` errors disappear from the console
- Confirm Members table, Stale Candidates, Billing Status, Organization Tree all load
- Confirm Sales-role users still have CRM access (Deals/Companies)
