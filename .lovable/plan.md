# System Roles Migration — Completed Phases 1-5

## Architecture Change
- **System level**: Users are `Workspace Owner`, `Admin`, or `Member` (stored in `members.system_role`)
- **Job level**: Roles (`recruiter`, `hiring_manager`, `interviewer`) come from `job_assignments.role`

## Completed

### Phase 1 — Database
- ✅ Created `system_role` enum (`admin`, `member`)
- ✅ Added `system_role` column to `members` table
- ✅ Migrated data: `admin` → `admin`, all others → `member`
- ✅ Updated `resolve_org_context`, `get_member_role`, `get_user_member_data` to return `system_role`
- ✅ Updated `check_tenant_member_role` to use `system_role`
- ✅ Updated `auto_assign_job_creator_to_assignments` trigger
- ✅ Updated `audit_member_role_change` trigger

### Phase 2 — Frontend Permissions
- ✅ Removed `isRecruiter`, `isHiringManager`, `isInterviewer` from `usePermissions`
- ✅ Created `useJobRole(jobId)` hook for job-level role lookups
- ✅ Updated `jobScoping.ts` — `isRestrictedRole` no longer checks `isRecruiter`
- ✅ Updated `JobAssignmentGuard` — guards all non-admin members

### Phase 3 — UI Updates
- ✅ Updated `Header` nav — uses `isMember` instead of `isRecruiter`
- ✅ Updated `Dashboard` — sourcing panel for admin+ only
- ✅ Updated `JobSetupPanel` — readOnly for non-admin members
- ✅ Updated `BillingGuard` — members (non-admin) never blocked
- ✅ Updated `MembersTab` — paid seats = admins, collaborators = members
- ✅ Updated `Find` page RoleGate
- ✅ Updated `useScheduledBookings`, `useJobsForCandidateAssignment`, `useJobs`

### Phase 4 — Runtime Hotfixes
- ✅ Updated `is_org_owner` — `m.system_role = 'admin'` (was `m.member_role`)
- ✅ Updated `check_org_hierarchy_role_access` — `m.system_role`
- ✅ Updated `reconcile_pending_invitation` — returns `system_role`
- ✅ Updated `validate_invite_token` — returns `system_role`
- ✅ Updated `accept_invitation` — uses `system_role`

### Phase 5 — Complete Cleanup
- ✅ Updated `admin_insert_first_member` — inserts `system_role` instead of `member_role`
- ✅ Updated `admin_manage_member` — updates `system_role` column
- ✅ Updated `audit_member_role_change` trigger — only tracks `system_role`
- ✅ Updated `log_member_activation` trigger — metadata uses `system_role`
- ✅ Updated `get_tenant_billable_seat_count` — counts by `system_role`
- ✅ Updated `duplicate_job_posting` — permission check uses `system_role`
- ✅ Updated `user_can_manage_org_members` — checks `system_role = 'admin'`
- ✅ Updated `diagnose_user_auth` — reports `system_role`
- ✅ Updated `audit_platform_admin_access` — returns `system_role`
- ✅ Updated `debug_user_permissions` — returns `system_role`
- ✅ Renamed `invitations.member_role` → `invitations.system_role`
- ✅ Cleaned up frontend: `invitationReconciliation.ts`, `AcceptInvite.tsx`, `TeamTab.tsx`, `audit.ts`

## Phase 6 — Future (Optional)
- Drop `member_role` column from `members` table (already dropped)
- Drop old `member_role` enum type
- Update `MemberInviteSheet` role picker to only offer Admin/Member

# Deep Resume Parsing + Data Standardization — Completed

## What was implemented

### Phase 1: Schema Expansion
- ✅ Added to `candidates`: `current_job_title`, `standardized_title`, `seniority_level`, `functional_area`, `specialization`, `years_in_specialization`, `years_in_leadership`, `company_count`, `avg_tenure_months`
- ✅ Added to `candidate_work_experience`: `standardized_title`, `company_industry`, `company_size_category`, `duration_months`
- ✅ Added to `candidate_education`: `education_level`
- ✅ Created `candidate_certifications` table with RLS policies

### Phase 2: Enrichment Rewrite
- ✅ Rewrote `enrich-candidate-profile` edge function to use OpenAI tool calling for structured extraction
- ✅ Single AI call extracts: profile summary, work experience, education, certifications, skills (with categories + primary flags), seniority, functional area, specialization
- ✅ Standardization pass: maps titles via `standard_job_titles`, skills via `standard_skills`
- ✅ Computes derived metrics: `company_count`, `avg_tenure_months`, `duration_months`
- ✅ Upserts into `candidate_work_experience`, `candidate_education`, `candidate_certifications`

### Phase 3: UI Updates
- ✅ New **Career Summary** accordion section in `IndependentCandidateProfileSheet` showing standardized title, seniority, functional area, metrics
- ✅ **Enrichment status indicator** in header ("AI Enriching..." badge)
- ✅ **Certifications section** with `CandidateCertificationsComponent`
- ✅ Enhanced **Work Experience** display: standardized title badge, company industry/size
- ✅ Enhanced **Education** display: education level badge
- ✅ Certifications loaded alongside work experience and education

## Files changed
- `supabase/functions/enrich-candidate-profile/index.ts` — full rewrite
- `src/components/candidates/IndependentCandidateProfileSheet.tsx` — career summary, certifications, enrichment indicator
- `src/components/candidates/CandidateWorkExperience.tsx` — standardized title, industry, size badges
- `src/components/candidates/CandidateEducationComponent.tsx` — education level badge
- `src/components/candidates/CandidateCertifications.tsx` — new component
