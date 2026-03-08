

# Candidate Page Filter Audit — Full Report

## Step 1: Existing Candidate Fields (from `candidates` table)

The `candidates` table has **55+ columns**. Here are all fields relevant to filtering:

### Candidate Profile Fields
| Field | Type | Population (of 1,416) | Notes |
|---|---|---|---|
| `status` | text | 1,416 (100%) | Values: `available`, `inactive`, `new` |
| `source` | text | 1,416 (100%) | 15 distinct values (direct, apollo, LinkedIn, public_posting, etc.) |
| `location_country` | text | 1,200 (85%) | Well populated |
| `location_state` | text | — | Exists, likely similar population to country |
| `location_city` | text | 1,137 (80%) | Well populated |
| `skills` | text[] | 719 (51%) | Raw skills array |
| `standardized_skills` | text[] | 681 (48%) | AI-normalized skills |
| `years_experience` | integer | 599 (42%) | Numeric range filterable |
| `salary_amount` | numeric | 305 (22%) | With `salary_currency` and `salary_period` |
| `seniority_level` | text | 593 (42%) | Values: entry, mid, senior, lead, director, vp, c_level |
| `functional_area` | text | 592 (42%) | Enrichment-derived |
| `specialization` | text | 592 (42%) | Enrichment-derived |
| `standardized_title` | text | 592 (42%) | AI-normalized job title |
| `role_current` | text | 1,166 (82%) | Current role/title |
| `company_current` | text | 338 (24%) | Current employer |
| `enrichment_status` | text | 1,414 (100%) | Values: pending, complete, completed, failed, skipped |
| `created_by` | uuid | 1,379 (97%) | References user who added the candidate |
| `created_at` | timestamptz | 1,416 (100%) | Always set |
| `updated_at` | timestamptz | 1,416 (100%) | Always set |
| `email_status` | text | 582 (41%) | Email verification status |

### Pipeline Fields (from `job_candidate_associations` table)
This table links candidates to jobs and tracks their pipeline state:

| Field | Type | Notes |
|---|---|---|
| `job_id` | uuid | Which job the candidate is associated with |
| `status` | text | Values: `active`, `rejected`, `hired`, `offer` |
| `current_stage_id` | uuid | Current pipeline stage |
| `entered_stage_at` | timestamptz | When they entered current stage |
| `added_by` | uuid | Who added them to the job |
| `created_at` | timestamptz | When associated |
| `rejected_at` | timestamptz | Rejection timestamp |
| `rejected_by` | uuid | Who rejected |
| `rejection_reason_id` | uuid | References rejection reasons |
| `rejection_notes` | text | Free text |
| `offered_at` | timestamptz | Offer timestamp |
| `offered_by` | uuid | Who made the offer |
| `ai_fit_score` | integer | AI match score |

### Stage History (from `job_candidate_stage_history`)
| Field | Type | Notes |
|---|---|---|
| `from_stage_id` / `to_stage_id` | uuid | Stage transitions |
| `moved_by` | uuid | Who moved them |
| `moved_at` | timestamptz | When moved |

---

## Step 2: Categorized Available Fields

**Candidate Status**: `status`, `enrichment_status`

**Source**: `source`

**Location**: `location_country`, `location_state`, `location_city`

**Candidate Attributes**: `seniority_level`, `functional_area`, `specialization`, `standardized_title`, `role_current`, `company_current`, `skills`/`standardized_skills`, `years_experience`, `salary_amount`

**Dates**: `created_at`, `updated_at`

**Ownership**: `created_by`

**Pipeline (via join to `job_candidate_associations`)**: `job_id`, association `status` (active/rejected/hired/offer), `current_stage_id`, `rejected_at`, `offered_at`, `ai_fit_score`

---

## Step 3: Filter Readiness Assessment

### Ready for Filtering (categorical/enum/range — well populated)

| Filter | Field | Type | UI Control |
|---|---|---|---|
| Status | `status` | 3 values | Multi-select |
| Source | `source` | 15 values | Multi-select with search |
| Country | `location_country` | categorical | Multi-select with search |
| State | `location_state` | categorical | Multi-select with search (cascading from country) |
| City | `location_city` | categorical | Multi-select with search (cascading from state) |
| Seniority | `seniority_level` | 7 values | Multi-select |
| Functional Area | `functional_area` | categorical | Multi-select with search |
| Specialization | `specialization` | categorical | Multi-select with search |
| Skills | `standardized_skills` / `skills` | array | Multi-select with search |
| Years of Experience | `years_experience` | integer | Range slider |
| Salary | `salary_amount` | numeric | Range slider (normalize by period) |
| Created Date | `created_at` | timestamptz | Date range picker |
| Enrichment Status | `enrichment_status` | 5 values | Multi-select |
| Created By | `created_by` | uuid | Multi-select (resolve to user names) |

### Conditionally Filterable (require join queries)

| Filter | Source Table | Notes |
|---|---|---|
| Associated Job | `job_candidate_associations.job_id` | Requires join |
| Pipeline Status | `job_candidate_associations.status` | active/rejected/hired/offer |
| Has Been Rejected | `job_candidate_associations.rejected_at IS NOT NULL` | Boolean |
| Has Offer | `job_candidate_associations.offered_at IS NOT NULL` | Boolean |
| AI Fit Score | `job_candidate_associations.ai_fit_score` | Range; job-specific |

### Not Suitable for Filtering

| Field | Reason |
|---|---|
| `profile_summary` | Free text |
| `bio` | Free text |
| `rejection_notes` | Free text |
| `candidate_name` | Already handled by search |
| `coresignal_headline` | Free text |
| `social_profiles` | Unstructured JSON |

---

## Step 4: Missing but Common ATS Fields

These fields are **not currently stored** and would require schema additions:

- **Notice period** — not in schema
- **Remote/hybrid/onsite preference** — not in schema
- **Visa/work authorization status** — not in schema
- **Education level** — exists in `candidate_education` table but not denormalized for filtering
- **Language proficiency** — not in schema
- **Last activity date** — no dedicated field (would need to aggregate from comments/stage history)
- **Interview status/dates** — no `interviews` table found
- **Hiring manager / Coordinator / Sourcer** — only `created_by` exists; no dedicated ownership roles on candidates
- **Department** — exists on jobs, not on candidates directly
- **Employment type** — exists on jobs, not on candidates

---

## Step 5: Implementation Plan

### Phase 1 — Direct candidate table filters (no joins needed)

Modify `IndependentCandidateTable` to add a collapsible filter panel with these filters, all dynamically populated from actual data:

1. **Status** — multi-select (`available`, `inactive`, `new`)
2. **Source** — multi-select with search (15 values)
3. **Country** — multi-select with search
4. **City** — multi-select with search
5. **Seniority Level** — multi-select (7 values)
6. **Functional Area** — multi-select with search
7. **Skills** — multi-select with search (from `standardized_skills` falling back to `skills`)
8. **Years of Experience** — range slider
9. **Salary Range** — range slider (with period normalization)
10. **Created Date** — date range picker
11. **Enrichment Status** — multi-select
12. **Created By** — multi-select (resolve UUIDs to profile names)

### Phase 2 — Join-based filters (future enhancement)

These require modifying the query to join `job_candidate_associations`:

13. **Associated Job** — multi-select
14. **Pipeline Status** — multi-select (active/rejected/hired/offer)

### Technical approach

- Create a `useCandidateFilterOptions` hook (similar to existing `useTalentIntelligenceFilterOptions`) that derives filter options from loaded candidate data
- Create a `CandidateFilterContext` (similar to existing `TalentIntelligenceFilterContext`) to manage filter state
- Create a `CandidateFiltersPanel` component with the filter UI
- Apply filters client-side on the already-fetched candidates array (current limit is 1,000 rows)
- Disable filters that have zero distinct values in the current dataset

All filter options will be **dynamically derived from actual data** — no hardcoded values.

