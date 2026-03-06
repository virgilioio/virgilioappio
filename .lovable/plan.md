

# Audit: Remaining `member_role` References

The column is dropped from `members`, but references persist in **10 DB functions**, **2 RLS policies** (indirectly clean), **3 frontend files**, and the `invitations` table still has a `member_role` text column.

## Database Functions (10 functions still reference `member_role`)

### Critical — will break at runtime if called

| Function | Issue | Fix |
|---|---|---|
| `admin_insert_first_member` | Inserts into `member_role` column (dropped) | Remove `member_role` from INSERT; ensure `system_role` is set |
| `admin_manage_member` | Updates `member_role` column via cast `::public.member_role` (enum dropped) | Update to `system_role` column |
| `audit_member_role_change` (trigger) | Reads `OLD.member_role` / `NEW.member_role` | Remove `member_role` refs; log only `system_role` |
| `log_member_activation` (trigger) | Reads `NEW.member_role` in metadata | Change to `NEW.system_role` |
| `get_tenant_billable_seat_count` | Reads `m.member_role IN ('admin','recruiter')` | Change to `m.system_role IN ('admin','member')` |
| `duplicate_job_posting` | Reads `m.member_role IN ('admin','recruiter')` | Change to `m.system_role IN ('admin','member')` |
| `user_can_manage_org_members` | Reads `m.member_role = 'admin'` | Change to `m.system_role = 'admin'` |
| `diagnose_user_auth` | Reads `m.member_role` in SELECT | Change to `m.system_role` |
| `audit_platform_admin_access` | Reads `m.member_role::text` | Change to `m.system_role::text` |
| `debug_user_permissions` | Calls `get_member_role()` which is clean internally, but return column is named `member_role` | Rename output alias to `system_role` |

### RLS Policies — clean
The `candidates_insert_consolidated` and `candidates_update_consolidated` policies call `check_tenant_member_role()`, which internally uses `system_role`. No changes needed.

## Frontend (3 files with legacy references)

| File | Issue | Fix |
|---|---|---|
| `src/lib/invitationReconciliation.ts` | Lines 57, 69: fallback `result.member_role` | Remove fallback; use `result.system_role` directly |
| `src/pages/AcceptInvite.tsx` | Line 68: fallback `invitation.member_role` | Remove fallback; use `invitation.system_role` |
| `src/components/jobs/stage-config/TeamTab.tsx` | Line 43: uses key name `member_role` in object literal (value derived from `system_role`) | Rename key to `system_role` or keep as display-only field name |

`src/lib/audit.ts` line 55: cosmetic — constant is `MEMBER_ROLE_CHANGED` but value is `'system_role_changed'`. Optional rename.

## Database Schema

The `invitations` table still has a `member_role` text column. This should either be renamed to `system_role` or dropped if unused. Need to check if any function/frontend reads it.

## `types.ts` (auto-generated)

`src/integrations/supabase/types.ts` has `member_role` in the `invitations` table type and in function return types. This file auto-regenerates after DB changes — it will update automatically once the functions and `invitations` schema are fixed.

## Implementation Plan

### Part 1 — DB Migration (single migration)

1. Update all 10 functions to replace `member_role` with `system_role`
2. For trigger functions (`audit_member_role_change`, `log_member_activation`), ensure they only reference existing columns
3. Rename `invitations.member_role` to `invitations.system_role` (or add `system_role` column and drop `member_role`)
4. Update `debug_user_permissions` return type alias

### Part 2 — Frontend (3 files)

1. `invitationReconciliation.ts`: Remove `member_role` fallbacks
2. `AcceptInvite.tsx`: Remove `member_role` fallback
3. `TeamTab.tsx`: Rename object key (cosmetic)
4. `audit.ts`: Rename constant key (cosmetic)

### Execution

Single DB migration + 4 frontend file edits. No edge function changes needed (already migrated).

