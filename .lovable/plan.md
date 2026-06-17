## Goal

Make the Configure Stage → **Basics → Additional settings** controls real: persist them, apply them where they matter, and surface stage instructions in the scorecard sheet's Interview Details tab.

## Current state (verified)

- `job_hiring_stages` columns: `id, job_id, stage_id, position, custom_stage_name, interviewer_scheduling_mode` — nothing else.
- `BasicsTab.tsx` holds `duration / format / slaEnabled / slaDays / instructions` in local `useState` only. No save, no read.
- `useStageConfiguration` only loads/saves `custom_stage_name`.
- Scheduling code (booking flow, `useMinimumDuration`, `InterviewDurationSelector`) does not look at any per-stage duration today.
- Stale-candidate detection (`useStaleCandidates`) uses a global activity-based heuristic — no per-stage SLA target.
- `ScorecardSheet.tsx` has an "Interview Details" section but never reads stage instructions.

## Scope of this plan

Wire all four controls end-to-end. No new tabs, no new visual design — only persistence and the downstream effects listed below.

### 1. Schema (migration)

Add columns to `public.job_hiring_stages`:

- `interview_duration_minutes int` — nullable; allowed values 15/30/45/60/90 (enforced by trigger, not CHECK, per project rules).
- `interview_format text` — nullable; one of `video | phone | onsite`.
- `sla_enabled boolean not null default false`.
- `sla_days int` — nullable; positive when `sla_enabled = true` (trigger-enforced).
- `stage_instructions text` — nullable.

Existing RLS already covers the table; no policy changes required. No GRANT changes (table already granted).

### 2. Hook layer

Extend `useStageConfiguration`:

- `StageConfiguration` interface gains the five fields above.
- `loadStageConfig` selects the new columns.
- Add `updateAdditionalSettings` mutation that patches all five in one call.
- Invalidate `job-hiring-plan`, `stage-config`, and a new `stage-config-by-job` key used by the scorecard sheet.

### 3. BasicsTab UI

- Initialize the four pieces of state from `config` (fall back to defaults: 45 min, video, SLA off / 5 days, empty instructions) instead of hardcoded values.
- Add a single auto-save trigger: debounce (~600 ms) any change to duration/format/sla/instructions and call `updateAdditionalSettings`. The sheet footer's "Auto-saved · last edit…" line already exists — drive it from the mutation timestamp.
- Keep all visual tokens unchanged.

### 4. Downstream effects

**Interview duration**

- New hook `useStageInterviewDuration(jhsId)` reads the per-stage value.
- `InterviewDurationSelector` (used when scheduling from a candidate at a given stage) accepts an optional `defaultDurationMinutes` prop and preselects the stage value when present; falls back to current behavior otherwise.
- The scheduling entry points that know the stage (`ScheduleInterviewDialog` / quick-schedule) pass `jhsId` so the duration is honored.

**Interview format**

- Same hook returns `format`. Scheduling flow uses it to preselect the location type in the new booking it creates (`scheduled_bookings.location_type`). No UI redesign — just default selection.

**Flag slow candidates (SLA)**

- Extend `useStaleCandidates` (and the pipeline's per-card "stale" indicator) so that, when a `job_candidate_associations` row has been in its current stage for `> sla_days` AND the stage has `sla_enabled = true`, it is flagged "slow at this stage". Days-in-stage already exists via `job_candidate_stage_history`.
- The stale badge/icon already used on candidate cards is reused — no new visuals; only an additional reason source.

**Stage instructions in the scorecard's Interview Details tab**

- `ScorecardSheet.tsx` already knows the candidate's stage (`jhsId`). Fetch `stage_instructions` via the new hook and, when non-empty, render a lilac note card (`#FAF8FF`, `1px #EDE4FF`, radius 12) inside the existing "Interview Details" section, above the existing content. Title "Stage instructions" (Poppins 12.5/600), body Inter 13/1.55 `#1F2230`. No card when instructions are empty.

### 5. Out of scope (explicitly)

- Editing the scheduling/availability windows themselves.
- Surfacing the duration/format in candidate-facing booking emails (already templated; only the underlying booking value changes).
- Any new tab, badge, or illustration.
- Backfilling existing stages — defaults are fine.

## Files touched

- `supabase/migrations/<new>.sql` — schema + validation trigger.
- `src/hooks/useStageConfiguration.ts` — load + save + types.
- `src/hooks/useStageInterviewDefaults.ts` — new, small read-only hook used by scheduling and the scorecard sheet.
- `src/components/jobs/stage-config/BasicsTab.tsx` — bind state to config, debounced auto-save.
- `src/components/jobs/StageConfigSheet.tsx` — pass real last-edit timestamp into the footer.
- `src/components/scheduling/InterviewDurationSelector.tsx` (+ its callers) — accept and honor `defaultDurationMinutes` / default `location_type`.
- `src/hooks/useStaleCandidates.ts` — add per-stage SLA rule.
- `src/components/candidates/ScorecardSheet.tsx` — render Stage instructions inside Interview Details when present.

## Risks / things to confirm with you

1. **Stale logic precedence** — should per-stage SLA *replace* the current activity heuristic, or be *additive* (a candidate is stale if either rule fires)? I'd default to **additive**.
2. **Format → booking location** — only preselect for new bookings created after the change. Existing bookings stay as-is. OK?
3. **Where the duration is honored** — only the in-app scheduling dialogs you launch from a candidate at that stage. Public booking pages have their own event-type duration and are out of scope unless you want them included.