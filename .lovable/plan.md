

# Phase 4: Drop `member_role` Legacy Column — Complete Cleanup

## Summary

The `system_role` column is live and all frontend reads were migrated in the previous phase. This phase eliminates the remaining `member_role` references across **10 DB functions**, **13 RLS policies**, **9 Edge Functions**, and **5 frontend files** that still carry legacy fallback code, then drops the column and enum.

## Part 1 — Database Migration (single SQL migration)

### 1A. Update DB Functions (10 functions)

| Function | Current `member_role` usage | Change |
|---|---|---|
| `check_org_member_access` | Reads `m.member_role` to compare against `_required_role` | Read `m.system_role`; map `_required_role = 'recruiter'` → allow `system_role IN ('admin','member')` |
| `check_org_hierarchy_role_access` | Reads `member_role` for role hierarchy logic | Read `system_role`; admin = all access, member = access if `_required_role` is recruiter/HM/interviewer |
| `is_org_owner` | `m.member_role = 'admin'` | `m.system_role = 'admin'` |
| `get_tenant_billable_seat_count` | `m.member_role IN ('admin','recruiter')` | `m.system_role = 'admin'` (only admins are billable now) |
| `accept_invitation` | Returns `member_record.member_role` | Return `member_record.system_role` |
| `validate_invite_token` | Returns `m.member_role::text` | Return `m.system_role::text` |
| `reconcile_pending_invitation` | Selects and returns `m.member_role` | Select and return `m.system_role` |
| `admin_insert_first_member` | Inserts `member_role = 'admin'` | Also insert `system_role = 'admin'` (keep `member_role` write until column drop) |
| `admin_manage_member` | Updates `member_role` column | Update `system_role` column instead |
| `duplicate_job_posting` | Checks `m.member_role IN ('admin','recruiter')` | Check `m.system_role IN ('admin','member')` |
| `audit_member_role_change` | Logs both old/new `member_role` | Log `system_role` only |
| `log_member_activation` | Includes `member_role` in metadata | Include `system_role` |
| `diagnose_user_auth` | Shows `m.member_role` | Show `m.system_role` |
| `debug_user_permissions` | Calls `get_member_role()` | Already updated — no change needed |
| `user_can_manage_org_members` | `m.member_role = 'admin'` | `m.system_role = 'admin'` |
| `audit_platform_admin_access` | Shows `m.member_role` | Show `m.system_role` |

### 1B. Replace RLS Policies (13 policies across 7 tables)

All policies that inline-check `m.member_role IN ('admin','recruiter')` will be replaced. The new logic:
- Where old policy said `member_role IN ('admin', 'recruiter')` → use `system_role IN ('admin', 'member')` (any active member)
- Where old policy said `member_role = 'admin'` → use `system_role = 'admin'`

Affected tables: `jobs`, `candidate_comments`, `email_logs`, `job_assignments`, `posting_field_select_options`, `stage_automations`, `stage_automation_emails`

### 1C. Drop Column & Enum (deferred to end of migration)

After all functions and policies are updated:
```sql
ALTER TABLE public.members DROP COLUMN member_role;
DROP TYPE IF EXISTS public.member_role;
```

## Part 2 — Edge Functions (9 files)

| Edge Function | Change |
|---|---|
| `accept-invitation-with-metadata` | Use `result.system_role` instead of `result.member_role` in metadata injection |
| `send-invitation` | Read `member.system_role` for metadata |
| `saas-customer-members` | Select and return `system_role` instead of `member_role` |
| `platform-admin-metrics` | Select `user_type, system_role` |
| `grant-tenant-credits` | Check `system_role` or `user_type` for platform_admin (this actually checks `user_type` semantically) |
| `chrome-api-me` | Select/return `system_role` |
| `chrome-api-gateway` | Select/return `system_role` |
| `provision-tenant` | Insert `system_role: 'member'` alongside legacy `member_role` (until column is dropped) |
| `request-new-invitation` | Find admins via `system_role = 'admin'` |

## Part 3 — Frontend Cleanup (remove legacy fallbacks)

| File | Change |
|---|---|
| `useMembers.ts` | Remove `member_role` from interface, `CreateMemberData`, `UpdateMemberData`. Remove legacy fallback `member_role === 'admin' ? 'admin' : 'member'`. Remove `member_role` write in `createMember`. |
| `useCustomerMembers.ts` | Remove `member_role` from interface and select |
| `useSaaSCustomerMembers.ts` | Remove `member_role` from `SaaSMember` interface |
| `invitationReconciliation.ts` | Remove `member_role` from `ReconciliationResult` and fallback logic |
| `useAuthBootstrap.ts` | Remove `|| reconcileResult?.member_role` fallback |
| `MemberInviteSheet.tsx` | Remove `member_role` legacy compat line from `onFormSubmit` |
| `organizationMetadata.ts` | Remove `member_role` from interface |
| `PendingInvitationAlert.tsx` | Change `member_role` to `system_role` in interface and display |
| `OrganizationDetailsDialog.tsx` | Use `system_role` for `getRoleBadge` |
| `OfferApprovalChainConfig.tsx` | Use `system_role` for badge |
| `MembersList.tsx` | Remove `member_role` fallback in search/badge |
| `audit.ts` | Rename constant (cosmetic) |
| `lib/organizationMetadata.ts` | Already done — just remove comment |

## Execution Order

1. Run DB migration (functions → policies → drop column)
2. Deploy all 9 Edge Functions
3. Update ~12 frontend files to remove legacy references

## Risk Mitigation

- The DB migration will update all functions/policies **before** dropping the column, so there's no window where queries fail
- Edge Functions will be deployed before the column drop — they'll read `system_role` which already exists
- Frontend fallback removal is safe since `system_role` is already populated for all rows

