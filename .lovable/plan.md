
# Fix Stale Candidate Detection: Consider Recent Activity

## Problem

The stale candidate logic only looks at `entered_stage_at` (when the candidate entered their current stage). A candidate in a stage for 10+ days is flagged as stale even if there was a scorecard submitted yesterday, an email sent 2 days ago, or a booking completed last week. The current exclusions only check for **future** bookings and **pending** reminders — they ignore past activity entirely.

## Available Activity Signals

These tables have `candidate_id` + `job_id` (or `association_id`) and timestamps we can use:

| Signal | Table | Timestamp Column |
|--------|-------|-----------------|
| Booking link sent | `job_candidate_associations` | `booking_link_sent_at` |
| WhatsApp template sent | `job_candidate_associations` | `whatsapp_template_sent_at` |
| Scorecard submitted | `job_stage_scorecards` | `created_at` (has `association_id`, `candidate_id`, `job_id`) |
| Email sent/received | `email_logs` | `sent_at` / `received_at` (has `candidate_id`, `job_id`) |
| Booking (past, any status) | `scheduled_bookings` | `created_at` / `scheduled_start` (has `candidate_id`, `job_id`) |

## Approach: Compute "Last Activity Date" Per Association

Instead of comparing only `entered_stage_at` against the threshold, we compute a **last activity date** as the most recent of:

- `entered_stage_at`
- `booking_link_sent_at` (already on the association row)
- `whatsapp_template_sent_at` (already on the association row)
- Most recent scorecard `created_at` for that association
- Most recent email `sent_at` or `received_at` for that candidate+job
- Most recent booking `created_at` for that candidate+job

A candidate is only stale if **all** of these are older than the threshold.

## Changes

### 1. `useStaleCandidates.ts` — Add activity lookups

After fetching potential stale candidates (Step 1), add two more batch queries:

- **Scorecards**: Query `job_stage_scorecards` for associations in the potential stale set, get `MAX(created_at)` grouped by `association_id`
- **Emails**: Query `email_logs` for candidate+job pairs, get `MAX(GREATEST(sent_at, received_at))` grouped by `candidate_id, job_id`

Already on the association row (no extra query needed):
- `booking_link_sent_at`
- `whatsapp_template_sent_at`

In the Step 4 filter loop, compute `lastActivityDate = MAX(entered_stage_at, booking_link_sent_at, whatsapp_template_sent_at, latestScorecard, latestEmail)`. Skip the candidate if `lastActivityDate` is within the threshold.

Also update `daysInStage` display to show days since last activity instead of days since stage entry — or keep both and show "days since last activity" as the staleness metric.

### 2. `useStagePerformanceMetrics.ts` — Same logic for analytics stuck detection

Apply the same activity-aware logic so the analytics "stuck candidates" list is also accurate.

### 3. `PipelineOverview.tsx` — Update time badge

The time badge in the pipeline view currently shows time since `entered_stage_at`. This should continue showing time-in-stage (that's useful info), but the **color/urgency indicator** should be based on last activity date instead. A candidate 14 days in a stage but with activity 2 days ago should not show as critical.

### 4. Update `StaleCandidates.tsx` display (minor)

Show "X days since last activity" instead of "X days in stage" so the metric is meaningful and accurate.

## Technical Details

The additional queries are lightweight — they use indexed columns (`association_id`, `candidate_id`, `job_id`) and are batched with `IN` clauses against the already-filtered potential stale set (max 100 rows). This adds two small queries to the existing four.

### Select fields to add to Step 1 query
Already available on association rows: `booking_link_sent_at`, `whatsapp_template_sent_at` — just add these to the select.

### New Step 2b: Recent scorecards
```sql
SELECT association_id, MAX(created_at) as latest
FROM job_stage_scorecards
WHERE association_id IN (...)
GROUP BY association_id
```

### New Step 2c: Recent emails
```sql
SELECT candidate_id, job_id, MAX(GREATEST(sent_at, received_at)) as latest
FROM email_logs
WHERE candidate_id IN (...) AND job_id IN (...)
GROUP BY candidate_id, job_id
```
