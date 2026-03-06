
Goal: eliminate the remaining runtime `member_role` references causing `/jobs` to fail after the column drop.

What I found
1) The jobs query itself is fine; failure comes from RLS evaluation during `jobs` + `organizations!inner(...)`.
2) `organizations` SELECT policies call `is_org_owner(...)`.
3) `is_org_owner` still contains:
   - `m.member_role = 'admin'`
4) That causes the exact error you see: `column m.member_role does not exist`.
5) A second live error is also present in bootstrap:
   - `reconcile_pending_invitation` still selects `m.member_role`.

Why the last fix didn’t fully resolve it
- We fixed `check_org_hierarchy_role_access`, but other legacy functions still referenced by policies/runtime were not migrated.
- So jobs can still fail through a different function path (`is_org_owner`), even though the hierarchy function is now correct.

Implementation plan
1) Create one focused DB hotfix migration for active runtime blockers:
   - `is_org_owner(p_org_id uuid)`:
     - replace `m.member_role = 'admin'` with `m.system_role = 'admin'`
     - keep workspace_owner bypass logic unchanged.
   - `reconcile_pending_invitation(p_user_id uuid)`:
     - replace selected/returned `member_role` with `system_role`.
   - `validate_invite_token(token_input uuid)`:
     - replace selected/returned `member_role` with `system_role`.
   - `accept_invitation(token_input uuid, new_user_id uuid)`:
     - replace returned `member_record.member_role` with `member_record.system_role`
     - keep invitation linking logic unchanged.

2) Keep return-column compatibility where needed:
   - If frontend already migrated to `system_role`, update function return signatures to `system_role text`.
   - If any consumer still expects `member_role`, temporarily alias `system_role AS member_role` only at function boundary (no table reference to dropped column).

3) Validate immediately after migration with DB introspection:
   - confirm `is_org_owner`, `reconcile_pending_invitation`, `validate_invite_token`, `accept_invitation` definitions no longer contain `member_role`.
   - re-check policies/functions used by `jobs` and `organizations` paths.

4) Functional verification
   - Reload `/jobs` and confirm:
     - `GET /rest/v1/jobs?...organizations!inner...` returns 200.
     - no `42703 column m.member_role does not exist` in console.
   - Confirm bootstrap no longer logs invitation reconciliation errors.

5) Follow-up hardening sweep (next patch right after hotfix)
   - Migrate remaining non-blocking legacy functions still referencing `member_role`:
     - `get_tenant_billable_seat_count`
     - `duplicate_job_posting`
     - `diagnose_user_auth`
     - `audit_platform_admin_access`
     - `log_member_activation`
     - `user_can_manage_org_members`
     - `admin_manage_member`
   - This prevents future regressions in less-used flows.

Technical details
- Root failing chain for jobs:
  `jobs SELECT` -> join `organizations!inner` -> organizations RLS (`org_owners_can_view_orgs`) -> `is_org_owner()` -> stale `m.member_role`.
- Root failing chain for bootstrap:
  `reconcile_pending_invitation()` directly references `m.member_role`.
- No frontend code changes are required for the jobs hotfix itself; this is a DB function consistency issue after schema removal.
