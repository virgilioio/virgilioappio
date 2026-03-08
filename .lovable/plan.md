

# Analytics Dashboard Upgrade — Prep Phase

## Audit Summary

### Currently Implemented Metrics
| Metric | Source | Calculation |
|--------|--------|-------------|
| Applications | `job_candidate_associations` | Count where stage_type = 'application' in date range |
| Active Candidates | `job_candidate_associations` | Count where status = 'active' (all time) |
| Hires | `job_candidate_associations` | Count where status = 'hired' in date range |
| Rejected | `job_candidate_associations` | Count where status = 'rejected' (all time) |
| Offers | `job_candidate_associations` | Count where status = 'offer' in date range |
| Interviews Scheduled | `scheduled_bookings` | Count created in date range |
| Interviews Completed | `scheduled_bookings` | Count where scheduled_start in past + in range |
| Avg Time to Hire | `job_candidate_associations` | (updated_at - created_at) for hired candidates |
| Status Distribution | `job_candidate_associations` | Grouped by status |
| Stage Distribution | `job_candidate_associations` | Grouped by current stage name (top 10) |
| Trend (daily) | `job_candidate_associations` + `scheduled_bookings` | Per-day counts |
| Pipeline Overview | `usePipelineOverviewData` | Per-job stage counts table |
| Recruitment Funnel | Derived | Applications → Active → Offers → Hired with conversion % |

### Derivable from Existing Data NOW (No Schema Changes)

**From `job_candidate_stage_history`** (has `association_id`, `from_stage_id`, `to_stage_id`, `moved_at`, `moved_by`):
- Stage conversion rates (count moved from stage A → stage B / count who entered stage A)
- Time in stage (diff between consecutive `moved_at` timestamps per association)
- Stuck candidates (current stage entered_stage_at vs now, threshold e.g. >14 days)
- Stage entry volume by date range (count `to_stage_id` transitions within range)

**From `job_candidate_associations` fields already available**:
- `added_by` → Recruiter workload (candidates added per recruiter)
- `entered_stage_at` → Time in current stage
- `rejected_at`, `rejection_reason_id` → Rejection reason breakdown
- `offered_at` → Offer timing, offer-to-hire conversion
- `source` (from `candidates` table join) → Source effectiveness

**From `candidates` table**:
- `source` → Source breakdown (Applied, Sourced, Referred, etc.)
- `location_country` → Geographic distribution

**From `scheduled_bookings`**:
- `interviewer_id` → Interview load per interviewer
- `duration_minutes` → Interview throughput
- `cancellation_reason`, `cancelled_at` → Cancellation rate
- `rescheduled_at` → Reschedule rate
- `job_hiring_stage_id` → Interviews by stage

**From `job_stage_scorecards`**:
- `rating` → Scorecard completion rate, average ratings by stage
- `is_ai_draft` → AI vs human scorecard split

**From `jobs`**:
- `department` → Department-level rollups
- `created_at` → Job age / time-to-fill

### Requires Future Schema Changes
- Candidate activity log (for detailed engagement tracking)
- Offer details table (salary offered, acceptance/decline tracking)
- DEI/diversity fields
- Passthrough rate tracking (explicit stage pass/fail decisions)

## Implementation Plan

### 1. Filter Bar — Already Done
The `AnalyticsFiltersBar` already uses `FilterChipPopover`. No changes needed.

### 2. Reusable Analytics Building Blocks

Create `src/components/analytics/shared/`:

- **`AnalyticsSection.tsx`** — Collapsible section wrapper with title, subtitle, icon. Uses existing Card surface, Poppins heading, muted description.
- **`AnalyticsKpiCard.tsx`** — Standardized KPI card with: title, value, icon, tooltip, optional trend indicator (↑/↓ with % change), optional subtitle. Replaces the inline metric card rendering in Analytics.tsx. Uses existing `MetricCard` as base or builds on the same Card primitive.
- **`AnalyticsChartCard.tsx`** — Wrapper card for charts with: title, optional subtitle, optional action buttons (download, expand), loading spinner, empty state. Extracts the repeated pattern from all existing chart components.
- **`AnalyticsTableCard.tsx`** — Wrapper for tabular data sections. Title, subtitle, scrollable content, optional footer row. Extends existing Card patterns.
- **`AnalyticsEmptyState.tsx`** — Standard empty state with icon, title, description. Already partially exists in PipelineOverviewTable.
- **`AnalyticsInsightCallout.tsx`** — Alert-style card for surfacing AI or derived insights (e.g. "3 candidates stuck in Phone Screen for >14 days"). Uses existing border-l-4 + muted bg pattern.

### 3. Sectioned Page Layout

Restructure `Analytics.tsx` from flat layout to sections:

```text
┌─ Header (title, export, time filter) ─────────────┐
├─ Filter Chips Bar ─────────────────────────────────┤
│                                                     │
│ ┌─ Overview ──────────────────────────────────────┐ │
│ │ KPI row (7 cards) + Trend chart                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Pipeline Health ───────────────────────────────┐ │
│ │ Pipeline Overview Table + Funnel + Status Pie   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Stage Performance ─────────────────────────────┐ │
│ │ Stage Distribution + Conversion Rates + Time    │ │
│ │ in Stage (new, derived from stage_history)      │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Source Performance ────────────────────────────┐ │
│ │ Source breakdown bar chart (from candidates)    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Interview Health ──────────────────────────────┐ │
│ │ Interview metrics + completion rate chart       │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

Sections that need new data hooks will render empty states with "Coming in next phase" messaging — no mock data.

### 4. Prep Phase Deliverables

**Files to create:**
1. `src/components/analytics/shared/AnalyticsSection.tsx`
2. `src/components/analytics/shared/AnalyticsKpiCard.tsx`
3. `src/components/analytics/shared/AnalyticsChartCard.tsx`
4. `src/components/analytics/shared/AnalyticsTableCard.tsx`
5. `src/components/analytics/shared/AnalyticsEmptyState.tsx`
6. `src/components/analytics/shared/AnalyticsInsightCallout.tsx`

**Files to modify:**
1. `src/pages/Analytics.tsx` — Restructure into sections using new wrappers, replace inline metric card rendering with `AnalyticsKpiCard`, organize existing charts into sections
2. Existing chart components (`ApplicationsTrendChart`, `CandidateStatusPieChart`, `StageDistributionChart`, `RecruitmentFunnelChart`) — Refactor to use `AnalyticsChartCard` wrapper for consistent loading/empty states

**Implementation notes embedded as code comments:**
- Each section will include a `// PHASE 1: derivable now` or `// FUTURE: requires schema` comment documenting what metrics slot in where

### Design Rules
- All new components use existing Virgilio tokens: `border-virgilio-border`, `text-virgilio-text`, `text-virgilio-muted`, `bg-virgilio-purple/10`
- Font: `font-poppins` headings, `font-inter` body (existing pattern)
- Card surface: existing `Card` with `border-virgilio-border` class
- Loading: existing spinner pattern (`border-2 border-virgilio-purple border-t-transparent animate-spin`)
- No mock data — sections without data hooks show proper empty states

