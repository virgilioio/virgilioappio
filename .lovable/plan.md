

# Auto-Create Default Department During Signup

## Problem
12 SaaS tenants have no child organizations. The `jobs_before_insert` trigger requires `parent_organization_id IS NOT NULL`, so these tenants cannot create jobs at all.

## Fix: Two Changes

### 1. Add a default child org in `provision-tenant` edge function
After the root organization is created (line 269), insert a child organization named "General" (or matching the workspace name) with `parent_organization_id = tenantId` and `org_kind = 'department'`.

This ensures every new signup has at least one department to post jobs under.

### 2. Backfill existing tenants via migration
A one-time migration creates a "General" child org for each of the 12 affected tenants that currently have zero children.

```sql
INSERT INTO organizations (id, name, org_kind, status, tenant_id, parent_organization_id)
SELECT gen_random_uuid(), 'General', 'department', 'active', t.id, t.id
FROM tenants t
WHERE t.tenant_type = 'saas' AND t.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.tenant_id = t.id AND o.parent_organization_id IS NOT NULL
  );
```

## Scope
- 1 edge function edit (`provision-tenant/index.ts` — ~10 lines added after root org creation)
- 1 migration (backfill)
- 0 frontend changes

