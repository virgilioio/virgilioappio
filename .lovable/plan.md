

# Expand Talent Intelligence Filters + Rename "available" → "active"

## Summary
Four changes:
1. **Rename** `candidates.status = 'available'` → `'active'` via data migration
2. Add **Job** filter (multi-select by job title)
3. Add **Pipeline Status** filter (active/rejected/hired/offer from `job_candidate_associations.status`)
4. Add **Pipeline Stage** filter (Recruiter Screening, Final Interview, etc. from `job_stages.stage_name`)

Candidate-level status filter (`active`/`new`/`inactive`) is also added but may be less useful analytically — included for completeness.

## Database Migration
```sql
UPDATE candidates SET status = 'active' WHERE status = 'available';
```
Single migration, no schema change needed (it's a text field).

Also update any hardcoded references to `'available'` in the codebase.

## Implementation

### 1. Filter Context (`TalentIntelligenceFilterContext.tsx`)
Add 4 new array keys to `TalentIntelligenceFilters`:
- `jobs: string[]` — job IDs
- `candidateStatuses: string[]` — candidate.status values
- `pipelineStatuses: string[]` — job_candidate_associations.status values  
- `stages: string[]` — stage names

### 2. Data Hook (`useTalentIntelligenceData.ts`)
- Add `status` to the candidates select
- Fetch `job_candidate_associations` (candidate_id, job_id, status, current_stage_id) for tenant candidates
- Fetch `jobs` (id, title) for the tenant
- Fetch `job_hiring_stages` + `job_stages` to map stage IDs → names
- Apply filters: when jobs/pipelineStatuses/stages are set, narrow candidates to those with matching associations

### 3. Filter Options (`useTalentIntelligenceFilterOptions.ts`)
Derive new option lists:
- `jobOptions` — from jobs query (value=id, label=title)
- `candidateStatusOptions` — from candidates.status
- `pipelineStatusOptions` — from association statuses
- `stageOptions` — from stage names

### 4. Filter Bar (`TalentIntelligenceFilterBar.tsx`)
Add 4 new `FilterChipPopover` components:
- **Job** — searchable
- **Candidate Status** — no search (3 values)
- **Pipeline Status** — no search (4 values)
- **Stage** — searchable (9+ values)

### 5. Active Filter Chips (`ActiveFilterChips.tsx`)
Add chip rendering for all 4 new filter keys. Jobs display title (not ID) — requires passing a job lookup map.

### 6. Page (`TalentIntelligence.tsx`)
Pass new option arrays to filter bar.

### 7. Codebase: rename "available" references
Search for hardcoded `'available'` status references and update to `'active'`.

## Files
- **Migration**: rename available → active
- **Modified**: `TalentIntelligenceFilterContext.tsx`, `useTalentIntelligenceData.ts`, `useTalentIntelligenceFilterOptions.ts`, `TalentIntelligenceFilterBar.tsx`, `ActiveFilterChips.tsx`, `TalentIntelligence.tsx`
- **Search & update**: any files referencing `status = 'available'` or similar

