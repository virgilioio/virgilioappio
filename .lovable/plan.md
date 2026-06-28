# EEO Survey — Linked + Role-Gated Implementation

Replace the anonymity-first design with a candidate-linked model that is structurally hidden from anyone who participates in hiring decisions.

## Compliance model

- US EEOC / OFCCP requires EEO data to be **voluntary, optional, and kept separate from the hiring process**.
- We satisfy "separate" via **role-based access**, not anonymity:
  - Visible to: **Platform admins, Workspace owners, Admins** (HR/compliance roles).
  - Hidden from: **Recruiters, Hiring Managers, Interviewers, regular members**.
- Hidden everywhere a hiring decision happens: **never** rendered in the in-job candidate profile, kanban, pipeline, scorecards, comparison views, exports for non-admins, or analytics drill-downs.
- Visible only in the **independent candidate profile → Details tab → "EEO (Self-Identification)" card**, gated by role.

## Database

Drop the previously-built anonymous architecture and rebuild linked:

1. Drop `eeo_responses` (token-based) and `get_eeo_aggregate` from the prior migration.
2. Create `candidate_eeo_responses`:
   - `candidate_id` (FK → candidates, unique — one EEO record per candidate)
   - `tenant_id`
   - `job_posting_id` (nullable — which posting collected it)
   - `gender`, `race_ethnicity`, `veteran_status`, `disability_status` (enums, all nullable + "decline" option)
   - `submitted_at`, `ip_hash` (audit), `user_agent_hash`
3. **RLS** — strict allowlist:
   - SELECT: only `has_role(auth.uid(), 'admin')` OR workspace owner OR platform admin, scoped to tenant.
   - INSERT: `anon` allowed for public application submission (via edge function only), scoped by candidate_id existence.
   - UPDATE/DELETE: admins/owners only.
   - Explicitly **no policy** granting recruiters, members, hiring managers, or interviewers read access.
4. GRANTs: `INSERT` to anon (public form), `SELECT/UPDATE/DELETE` to authenticated (RLS enforces role gating), ALL to service_role.
5. Audit log entry on every SELECT by an admin (write to `audit_logs`).

## Edge function

- Update `submit-application` (or equivalent) to accept optional `eeo` payload, look up the just-created candidate, and insert into `candidate_eeo_responses` server-side using service role. Never trust client to send `candidate_id` for EEO.

## Public application form

- `<EeoSurveySection>` in `PublicJobPosting.tsx` — renders only when `job_postings.details.eeo_enabled = true`.
- Standard EEOC question set, all optional, all with "Decline to identify".
- Legal disclaimer block above the section ("Voluntary, will not be used in hiring decisions, kept confidential…").
- Submitted with the application payload.

## Frontend gating

- New hook `useCanViewEeo()` → returns true only for platform admin, workspace owner, or `admin` system role.
- New hook `useCandidateEeoResponse(candidateId)` — only fetches if `useCanViewEeo()` is true (avoids unnecessary 403s).
- New component `<EeoResponseCard>` in independent candidate profile → Details tab.
  - Visual: same Gio card pattern as Contact Info card, with a subtle "Confidential — HR access only" badge.
  - Shows the 4 fields with human-readable labels, "Declined to identify" italicized, "Not collected" muted when null.
  - Edit affordance for admins (rare correction case).
- **Explicit exclusion** in:
  - `CandidateProfileSheet` (in-job) — no EEO card, no EEO section, no EEO field anywhere.
  - Kanban cards, scorecard views, comparison panels, candidate exports for non-admins.
  - Any candidate CSV export — strip EEO fields unless requested by an admin via a separate "Compliance export".

## Analytics (later, separate ticket)

- Out of scope for this plan. When built, aggregate-only widget with k-anonymity suppression, available only to admins/owners.

## Out of scope

- Aggregated EEO analytics widget.
- Compliance export CSV.
- EEO for internally-added candidates (only collected via public application).

## Technical notes

- Reuse the enums already created in the prior migration (`eeo_gender`, `eeo_race_ethnicity`, `eeo_veteran_status`, `eeo_disability_status`) — drop only the table and aggregate function.
- `useCanViewEeo` should derive from `user_type` (platform admin/owner) OR `members.system_role = 'admin'`, following the existing user-type precedence rule.
- The independent profile route must itself be gated to roles that can legitimately access it; if any non-admin role can open it today, the EEO card still hides via `useCanViewEeo`, but we should audit who reaches that route.
