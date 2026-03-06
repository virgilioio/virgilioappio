

# Fix: `check_org_hierarchy_role_access` still references `member_role`

## Root Cause

The DB function `check_org_hierarchy_role_access` contains:
```sql
SELECT organization_id, member_role::text INTO user_org_id, user_role
FROM public.members
WHERE user_id = current_user_id AND user_status = 'active'
```

The `member_role` column was dropped in Phase 4, but this function was not updated. It's called by the `jobs_select_consolidated`, `jobs_update_consolidated`, and `jobs_insert_consolidated` RLS policies, which is why job fetches fail with `column m.member_role does not exist`.

## Fix

Single DB migration to replace `check_org_hierarchy_role_access`:
- Change `member_role::text` to `system_role::text`
- Update the role hierarchy logic: `system_role = 'admin'` gets full access; `system_role = 'member'` gets access when `_required_role` is `'recruiter'`, `'hiring_manager'`, or `'interviewer'` (any non-admin role)

This is the only change needed — no frontend changes required.

