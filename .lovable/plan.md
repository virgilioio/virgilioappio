# Phase 1 — Schema

Scope: database + Job Setup UI only. No detectors, no LLM, no dashboard replacement yet. Phases 2–3 will land once you share their specs.

## 1. Migration

Single migration covering all schema changes:

**`jobs` — hiring targets**
- `budget_salary_min numeric`
- `budget_salary_max numeric`
- `budget_currency text default 'MXN'`
- `budget_period text default 'monthly'` (check: `monthly|annual`)
- `target_fill_date date`
- `must_have_skills text[] default '{}'`
- `location_requirement text default 'onsite'` (check: `onsite|hybrid|remote`)

All nullable / defaulted so existing jobs keep working; detectors will degrade gracefully.

**`stage_events` — append-only log**
- Columns exactly as specified (`from_stage`, `to_stage`, `occurred_at`, `actor_id`, `reason`, `entry_channel`).
- Indexes on `(job_id, occurred_at)` and `(candidate_id, job_id)`.
- GRANT + RLS: tenant-scoped via the `jobs.tenant_id` of the parent job, using the existing `user_has_tenant_access` pattern. Insert allowed to authenticated; updates/deletes blocked (append-only).
- Backfill: for every row in `job_candidate_associations`, insert an entry event at `created_at` (`from_stage=null`, `to_stage=current_stage`, `reason='backfill'`) and, if status is terminal (`hired|rejected|withdrawn`), a terminal event at `updated_at`.
- Trigger: `AFTER INSERT OR UPDATE OF current_stage, status ON job_candidate_associations` writes a new `stage_events` row going forward, so we stop relying on snapshots.

**`job_briefings` — cache**
- Exactly as specified: `job_id PK`, `snapshot_hash`, `snapshot jsonb`, `briefing jsonb`, `generated_at`.
- GRANT + RLS: read for tenant members of the parent job; write restricted to `service_role` (Phase 3 edge function will own writes).

All three follow the mandated order: CREATE TABLE → GRANT → ENABLE RLS → POLICY.

## 2. UI — "Hiring targets" section in Job Setup

Add a new section to `JobOverviewTab` (or as a sibling card inside `JobSetupPanel`'s Overview tab — whichever fits the current Setup layout best). One card, Gio foundation, no design surprises:

- Salary range: two numeric inputs + currency `<Select>` (reuse `currencies` constants) + period `<Select>` (Monthly / Annual).
- Target fill date: `<DatePickerVirgilio>`.
- Location requirement: segmented `<Select>` Onsite / Hybrid / Remote.
- Must-have skills: tag input (reuse the skills chip pattern already used elsewhere in the job form — same normalized vocabulary as candidate skills).

Fields are all optional; submit goes through the existing `updateJob` path (`useJobs`). No validation beyond min ≤ max when both present.

## 3. Out of scope for this phase

- No dashboard changes. `JobAnalyticsDashboard` stays mounted as-is until Phase 3's UI replacement lands.
- No detectors, no edge function, no briefing UI, no LLM calls.
- No new types file edits — Supabase types regenerate after the migration is approved.

## Verification checklist

- Migration approved + applied; `supabase--read_query` confirms columns/tables/indexes exist.
- Backfill row count ≈ `job_candidate_associations` row count (+ terminal extras).
- Editing a candidate's stage writes a new `stage_events` row (trigger smoke test via psql).
- Setup form persists all seven new job fields and re-reads them on reload.

Once you confirm Phase 1 is good, send Phases 2 (detector catalog + payload shapes) and 3 (LLM contract + UI), and I'll build them in order.
