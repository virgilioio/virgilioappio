

# Fix Critical Privilege Escalation Vulnerability

## The Problem
Any authenticated user can escalate to `platform_admin` by calling:
```js
supabase.auth.updateUser({ data: { user_type: 'platform_admin' } })
```
This writes to `raw_user_meta_data`, which all three permission functions trust as the **first check**, short-circuiting the database lookup entirely.

## The Fix — 1 Migration

Rewrite all three functions to remove the `raw_user_meta_data` / JWT metadata shortcut and determine `platform_admin` status exclusively from the `members` table.

### `get_user_type_secure()` (SECURITY DEFINER)
- Remove the `IF EXISTS (SELECT 1 FROM auth.users WHERE raw_user_meta_data->>'user_type' = 'platform_admin')` block
- Keep the existing `members` table query (already present as fallback)
- The `members.user_type` column already stores `'platform_admin'` for real admins

### `get_user_type()` (SECURITY DEFINER)
- Remove the `IF (auth.jwt()->'user_metadata'->>'user_type') = 'platform_admin'` block
- Keep the existing `members` table query

### `check_tenant_member_role()`
- Remove the `IF (SELECT raw_user_meta_data->>'user_type' = 'platform_admin' FROM auth.users)` block
- Add a `members` table check for `platform_admin` user_type instead

All three functions are already `SECURITY DEFINER`, so querying the `members` table bypasses RLS — no recursive policy issues.

## Scope
- 1 database migration (rewrites 3 functions)
- 0 frontend changes
- 0 edge function changes

## Risk
Low. The `members` table is already the source of truth and the fallback path. We're just removing the unsafe shortcut that runs before it.

