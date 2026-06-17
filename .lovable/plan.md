… 

# Security Triage Plan

Goal: resolve the 7 **critical** findings blocking publish, then sweep the 9 warnings. Each item below states the finding, the decision (Fix / Ignore), and the concrete action.

---

## Critical (must clear to unblock publish)

### 1. `audit_logs_unrestricted_insert` — **Fix**
Policy `audit_logs_insert_only` has `WITH CHECK (true)` — any authenticated user can forge audit rows.
**Action:** Drop the permissive INSERT policy. Replace with one that requires `user_id = auth.uid()`, OR remove authenticated INSERT entirely and rely on existing SECURITY DEFINER triggers. Verify no client code inserts directly into `audit_logs` before tightening.

### 2. `job_suggested_candidates_cache_cross_tenant` — **Fix**
SELECT policy uses `USING (true)` — leaks AI fit scores/rationales across tenants.
**Action:** Replace SELECT policy with tenant scoping via join to `jobs` and `user_has_org_hierarchy_access(jobs.organization_id)` (mirrors pattern used elsewhere per memory).

### 3. `profiles_pii_anonymous_exposure` — **Fix**
Policy `Public can view profiles for active booking configs` exposes `email`, `phone`, `linkedin_url` to anon.
**Action:** Drop the anon policy on `profiles`. Create a SECURITY DEFINER function `get_public_booking_profile(user_id)` returning only `display_name`, `avatar_url`, `full_name` (whatever the booking UI actually renders). Update `src/pages/PublicBooking*` / booking hooks to call the function instead of selecting from `profiles`. Per memory [Public profile access](mem://architecture/security/public-profile-access-grant) this grant exists for booking — replacement must keep booking working.

### 4. `tenants_billing_anonymous_exposure` — **Fix**
`tenants_public_read_for_postings` exposes billing_* columns to anon.
**Action:** Drop policy. Create SECURITY DEFINER function `get_public_tenant_for_posting(tenant_id)` returning only `name`, `about`, `logo_url`, `careers_*` cosmetic fields. Update careers/job-posting public pages to use it.

### 5. `stripe_webhook_events_public_all` — **Fix**
Policy targets `public` role with `USING (true)` for ALL ops.
**Action:** Drop policy, recreate scoped to `service_role` only (or add `auth.role() = 'service_role'` check). Webhook edge function uses service role so no app impact.

### 6. `realtime_messages_no_rls` — **Fix**
No RLS on `realtime.messages`; any authed user can subscribe to any topic carrying `candidates`, `email_logs`, `scheduled_bookings`, `jobs`.
**Action:** Add RLS policy on `realtime.messages` requiring the topic to be a tenant-scoped channel name (e.g. `tenant:{tenant_id}:*`) AND the user belongs to that tenant via `user_has_tenant_access`. Audit existing `supabase.channel(...)` calls in `src/` and rename channels to the tenant-prefixed convention. This one touches both DB and frontend — biggest surface area.

### 7. `candidate_attachments_anonymous_upload` — **Fix**
Anon INSERT on `candidate-attachments` bucket has no MIME/size/path limits.
**Action:** Drop `public_job_applications_can_upload_files`, recreate with: path prefix `public-applications/`, MIME in (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`), size ≤ 10MB. Update public application upload code to write under `public-applications/{job_id}/...`.

---

## Warnings (clear opportunistically in the same pass)

| # | Finding | Decision | Action |
|---|---|---|---|
| 8 | `departments_all_tenants_anonymous` | **Fix** | Scope anon SELECT to departments whose tenant has ≥1 active `job_postings`. |
| 9 | `invoice_storage_jwt_metadata_admin_check` | **Fix** | Replace `auth.jwt() -> user_metadata -> user_type` check with `get_user_type_secure()` (server-side, per memory [Admin privilege source](mem://security/access-control/administrative-privilege-source-of-truth)). |
| 10 | `SUPA_anon_security_definer_function_executable` | **Review then fix or ignore** | List flagged functions; revoke `EXECUTE FROM anon` on any not intentionally public (booking/careers helpers stay; everything else revoked). |
| 11 | `SUPA_authenticated_security_definer_function_executable` | **Review then fix or ignore** | Same triage for `authenticated`. |
| 12 | `SUPA_extension_in_public` | **Ignore** | Pre-existing Supabase default; moving extensions is risky and not blocking. Document in security memory. |
| 13 | `SUPA_function_search_path_mutable` | **Fix** | Add `SET search_path = public` to flagged functions in one sweep migration. |
| 14 | `SUPA_public_bucket_allows_listing` | **Review** | Confirm which bucket; if it's a logo/asset bucket, ignore with note. Otherwise tighten SELECT to single-object access. |
| 15 | `SUPA_rls_policy_always_true` | Covered by items 1, 2, 5 | No extra action. |
| 16 | `SUPA_vulnerable_postgres_version` | **User action** | Surface in summary — requires user to click Upgrade in Supabase dashboard. |
| 17 | `SUPA_rls_enabled_no_policy` | **Fix** | Identify the table(s); either add a deny-all policy or disable RLS if intentional. |

---

## Execution order (once approved)

1. **Investigation pass** (read-only): list policies on affected tables, list current `supabase.channel(...)` topic names, identify flagged SECURITY DEFINER functions and the search-path-mutable ones, find the `RLS enabled no policy` table.
2. **Migration 1 — quick wins:** items 1, 2, 5, 8, 9, 13, 17, and the function EXECUTE revokes (10, 11).
3. **Migration 2 + frontend edits — booking/careers anon refactor:** items 3, 4 (new SECURITY DEFINER functions + update React hooks/components that currently select from `profiles` / `tenants` anonymously).
4. **Migration 3 + frontend edits — storage hardening:** item 7 (tighten policy + change upload path in public application form).
5. **Migration 4 + frontend edits — Realtime channel scoping:** item 6 (add `realtime.messages` RLS + rename all channels to tenant-prefixed names).
6. **Update `mem://` security memory** with what was ignored (items 12, 14 if applicable) and the new public-access patterns (booking via function, careers via function).
7. **Mark findings as fixed / ignored** via `security--manage_security_finding` with explanations.
8. **Re-run security scan** to confirm critical count = 0.
9. **Publish** to push cleaned bundle to `app.gogio.io` (the original goal — fixes the slow booking page).
10. **Postgres upgrade (item 16)** — flag to the user as a separate manual step in Supabase dashboard.

## Technical notes

- All schema changes go through `supabase--migration` (one tool call per logical migration).
- Frontend updates use `supabase.rpc('get_public_booking_profile', { ... })` style calls; types regenerate after each migration approval, so code edits for steps 3–5 happen *after* their migrations land.
- Channel renaming (step 5) needs a coordinated change: server-side broadcasters (edge functions / triggers) and client subscribers must agree on the new `tenant:{tenant_id}:...` convention. We'll grep `supabase.channel(` in `src/` and `.channel(` in `supabase/functions/` first.
- No data deletion. All migrations are additive policy changes plus DROP/CREATE of policies — safe to roll back per item.

## Out of scope

- Auth provider changes, password policy, MFA — not in findings.
- Application logic changes beyond what each finding requires.
