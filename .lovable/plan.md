# Full Gio Fit dossiers for top suggestions

Today the Suggested list and the dossier are two different assessments:

- The list scores up to 40 people in one batched request and stores only a number, a confidence level and a one-line reason, cached for 24 hours.
- The dossier is a separate deep assessment per person (dimension breakdown, evidence, skill verdicts, validation points). It refuses to run unless the person is already on the job's pipeline, because the pipeline record is the only place it can save its result.

This plan gives Gio's strongest suggestions a real dossier before anyone is added, and keeps it when they are.

## What changes for you

1. **Top suggestions get assessed automatically.** After the Suggested list is scored, the highest scorers are sent for the full assessment in the background — people scoring **80 or above, up to 10 per job per scoring run**. By the time you open one of those profiles, the complete dossier is usually already there (and if it is still running, you see the existing "Gio is thinking" state, not an empty page).
2. **Everyone else gets it on request.** A suggestion below that bar shows the match score, the reasons and a **Generate full dossier** button. One click, same assessment.
3. **It lives on the job, temporarily.** The dossier is stored against this job's suggestion record — not on the person. While they sit in the Suggested list it stays there; it is never visible on the candidate elsewhere in the database.
4. **Adding makes it permanent.** When a suggested person is added to a pipeline, the dossier moves onto their new pipeline record and stays — nothing is re-run, and the score does not shift.
5. **Dismissing throws it away.** Thumbs-down (not a fit for this job) deletes the suggestion record and its dossier. Same when they drop off the list or the job is re-scored against changed requirements — those dossiers were written against the old requirements, so they go with them.

Cost note: each dossier is one deep assessment, the same spend as a dossier on a pipeline candidate. The automatic pass is capped at 10 per scoring run so a large database cannot quietly run up hundreds.

## Technical plan

### Storage (migration)

Extend `job_suggested_candidates_cache` — the job-scoped, disposable suggestion row is exactly the right host: it already keys on `(job_id, candidate_id)`, is cleared when requirements change, and holds nothing on the candidate record itself. No new table.

- `ai_fit_analysis jsonb`, `ai_fit_confidence` already present, `ai_fit_generated_at timestamptz`, `ai_fit_output_language text`
- `dossier_status text` (`pending` | `ready` | `failed`, null = never requested) and `dossier_error text`
- keep the existing grants/RLS shape on the table; no new policies beyond matching what the table already allows

`get-suggested-candidates` currently deletes every cache row for a job before upserting. Change it to upsert score fields only, preserving `ai_fit_analysis` when `job_skills_hash` is unchanged, and clearing the analysis columns when the hash changes.

### `analyze-candidate-fit`

- Accept a request with no association instead of returning 404: when `job_candidate_associations` has no row for the pair, resolve the output language from the job then the organization, run the identical prompt pipeline, and write the result to the matching `job_suggested_candidates_cache` row (`ai_fit_analysis`, `ai_fit_score`, `ai_fit_confidence`, `ai_fit_generated_at`, `ai_fit_output_language`, `dossier_status='ready'`). Set `dossier_status='pending'` on entry and `failed` + `dossier_error` on the failure paths.
- Association behaviour is untouched: with an association it still writes to that row exactly as now.

### Automatic pass

At the end of `get-suggested-candidates`, after the cache upsert, select candidates with `ai_fit_score >= 80` that have no `ai_fit_analysis`, order by score, take the first 10, mark them `pending`, and invoke `analyze-candidate-fit` for each with small concurrency (2) without blocking the list response. The threshold and cap live in named constants at the top of the function so they are easy to tune.

### Carry-over (migration)

`SECURITY DEFINER` trigger on `job_candidate_associations` BEFORE INSERT: when a cache row for `(job_id, candidate_id)` has `ai_fit_analysis`, copy `ai_fit_score`, `ai_fit_analysis`, `ai_fit_confidence`, `ai_fit_generated_at`, `ai_fit_output_language` onto the new row and set `ai_fit_version = 1`. Doing it in the trigger covers every add path — the suggested profile, the Suggested table's row and bulk actions, add/transfer — not just the new screen.

### Frontend

- `useCandidateFitInsights`: when no association exists, read the cache row and return the same `FitInsightsData` shape with `associationId: null`, plus `dossierStatus`. `associationId` becomes nullable and the two consumers that use it (share creation, association scorecards) already only run on the in-job profile — guard them on non-null.
- `CandidateInsightsTab`: no visual change. It renders from stored analysis as it does now; refresh calls the same edge function, which routes by association presence.
- `SuggestedCandidateProfile`: replace the current pre-pipeline placeholder card with three states — dossier ready → the real dossier (still `showScorecards={false}`, suggested masthead); `pending` → the existing Gio Fit thinking/skeleton state; nothing yet → the match summary with a **Generate full dossier** button. Add to pipeline stays enabled in all three.

### Verification

- Confirm a suggestion dossier row is written for a top scorer and that the screen renders dimensions, skills and validation points from it.
- Confirm adding that person copies the dossier onto the association and the Gio Fit tab on the in-job profile shows the same score with no regeneration.
- Confirm a requirements change clears suggestion dossiers, and that re-scoring does not wipe dossiers when requirements are unchanged.
