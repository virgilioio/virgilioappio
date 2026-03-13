

# Formalize Application Review as a Pipeline Stage — Full Plan

## Summary
Add `application_review` as a real `stage_type_enum` value, auto-created for every job at position 0. Update all filter chips, filter options hooks, RPCs, and pipeline logic across the entire app.

---

## 1. Database Migration

**New migration file**: `supabase/migrations/[timestamp]_formalize_application_review.sql`

- Add enum value: `ALTER TYPE stage_type_enum ADD VALUE 'application_review'`
- Insert default stage: `INSERT INTO job_stages (stage_name, stage_type, is_default, is_active, stage_priority) VALUES ('Application Review', 'application_review', true, true, 0)`
  - The existing `handle_new_default_stage` trigger will auto-propagate this to all existing jobs
  - The existing `handle_new_job_defaults` trigger will add it to future jobs
- Backfill associations: Update all `job_candidate_associations` where `current_stage_id IS NULL AND status = 'active'` to point to the new Application Review `job_hiring_stages` entry for their respective job
- Update the `get_pipeline_global_metrics` RPC: change `application_review_candidates` CTE from `current_stage_id IS NULL` to filter by `js.stage_type = 'application_review'`

---

## 2. Type Updates

**`src/hooks/useJobStages.ts`**
- Add `'application_review'` to the `StageType` union

**`src/integrations/supabase/types.ts`**
- Add `'application_review'` to the `stage_type_enum` arrays (generated types)

---

## 3. Core Logic Updates

**`src/hooks/useApplicationReview.ts`**
- `loadQueue`: Query for the `application_review` stage via `job_hiring_stages` joined with `job_stages` where `stage_type = 'application_review'`, then filter associations by that `current_stage_id` instead of `IS NULL`
- `firstStageId`: Set to the first *non*-application_review stage (the actual pipeline entry point)
- After reject/advance actions, remove the candidate from the local `queue` array so they disappear immediately

**`src/hooks/usePipelineActions.ts`**
- When creating a new association, assign `current_stage_id` to the job's Application Review `job_hiring_stages` entry instead of leaving it null

**`src/pages/JobDetail.tsx`**
- Remove the `inPipelineKeys` workaround and the name/linkedin-based exclusion logic
- `applicationReviewCandidates`: Filter by `current_stage_id` matching the Application Review stage from `stageMap`
- Simplify `applicationCount` accordingly

---

## 4. Pipeline View Updates

**`src/components/jobs/PipelineOverview.tsx`**
- Exclude stages with `stage_type = 'application_review'` from the kanban/list view (it has its own dedicated tab)
- Add `'application_review'` to `stageTypeVariants` for consistent badge coloring

---

## 5. Filter Chip Updates (All Pages)

Every filter bar that shows stage/pipeline/status options needs awareness of the new `application_review` stage type:

### a. **Candidates Page** — `src/components/candidates/CandidateFiltersPanel.tsx`
- The "Pipeline" chip (`pipelineStatusOptions`) already derives from association statuses — no change needed there
- The `pipelineStatusOptions` in `src/hooks/useCandidateFilterOptions.ts` derives from `pipelineStatus` on associations — this will naturally include candidates whose stage is `application_review` since they are `active`. No code change needed, but the **stage name** "Application Review" will now appear in stage-based filters if we add a Stage chip here

### b. **Talent Intelligence** — `src/components/talent-intelligence/TalentIntelligenceFilterBar.tsx`
- The **"Stage" chip** derives options from `useTalentIntelligenceFilterOptions.ts` → `stageOptions`, which reads stage names from `stageMappings`. "Application Review" will now naturally appear as a stage option since candidates will have a real `current_stage_id`. **No code change needed** — it works automatically.
- The **"Pipeline" chip** (association status: active/rejected/hired/offer) — unchanged
- The **"Status" chip** (candidate global status) — unchanged

### c. **Pipeline Page** — `src/components/pipeline/FilterCard.tsx`
- Status chip (job status: draft/open/closed/archived) — unchanged, not stage-related

### d. **Jobs Page** — `src/components/jobs/JobsTable.tsx`
- Status/Org/User chips — unchanged, not stage-related

### e. **Analytics Page** — `src/components/analytics/AnalyticsFiltersBar.tsx`
- Recruiter/Job/Dept/Status chips — unchanged, not stage-related

### f. **Active Filter Chips (Talent Intelligence)** — `src/components/talent-intelligence/ActiveFilterChips.tsx`
- The `stages` array key is already handled — "Application Review" will render as a removable chip naturally

### g. **Settings Stage Form** — `src/components/settings/JobStageForm.tsx`
- Add `{ value: 'application_review', label: 'Application Review' }` to the `stageTypes` array so it appears as an option (or alternatively, hide it from the create form since it's auto-created and non-removable)
- Better approach: **exclude it** from the stage type selector and mark it as non-deletable in the stage list UI

---

## 6. Stage Protection

- The Application Review stage should be **non-deletable** and **non-reorderable** (always position 0)
- In `useJobStages.ts` delete logic: prevent deletion if `stage_type = 'application_review'`
- In stage reordering UI: pin the Application Review stage at position 0

---

## Files Modified
- New migration SQL file
- `src/hooks/useJobStages.ts` — StageType union + delete protection
- `src/hooks/useApplicationReview.ts` — query by stage_id, queue removal
- `src/hooks/usePipelineActions.ts` — assign AR stage on creation
- `src/pages/JobDetail.tsx` — remove inPipelineKeys hack, filter by stage
- `src/components/jobs/PipelineOverview.tsx` — exclude AR from kanban, add badge variant
- `src/components/settings/JobStageForm.tsx` — exclude `application_review` from create form
- `src/integrations/supabase/types.ts` — add enum value

