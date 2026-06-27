## Goal

Stop labeling anything "Top match" unless there's real evidence behind it. If the data is thin (uncollected previews with no AI fit, no internal record), hide the badge and the banner line entirely.

## New rule (applies to both surfaces)

A candidate qualifies as "Top match" only if **all** of these are true:

1. They are an **internal/collected** candidate — i.e. there's a row in `candidates` (either `display_source === 'internal'`, or an Apollo/PDL row that has been resolved to an existing `candidate_id`).
2. They have a real **AI fit score** from `job_candidate_associations.ai_fit_score` (requires the project to be linked to a job).
3. That AI fit score is **strong** — `ai_fit_score >= 80` (the "excellent" tier already used elsewhere). Confidence must not be `low`.
4. They are unambiguously the top — strictly higher AI fit than the next candidate (no ties). On a tie, no badge.

If any condition fails → no "Top match" badge anywhere, no "Top match: …" line in the banner. The rest of the banner (counts, sources) keeps rendering.

Raw `match_score` from preview matching alone is **not** enough — that's the "lie" today.

## Surface 1 — Banner (`ResultsRunSummary` via `CandidatesTab.tsx`)

- Replace the current `max(match_score)` reducer in `CandidatesTab.tsx` with the rule above.
- Needs AI fit data for the visible candidates. Fetch `ai_fit_score`, `ai_fit_confidence` from `job_candidate_associations` for the project's `job_id` + the candidate ids that are internal/resolved. New small hook `useTopMatchForResults(jobId, candidates)` returning `{ name, score } | null`.
- Pass through to `ResultsRunSummary` only when non-null; the existing conditional already hides the line when `topMatchName` is falsy.

## Surface 2 — Row pill (`SourcingCandidateTable.tsx:926-976`)

- Drop the positional `sortedData[0] && sortMode === 'ai_fit'` check.
- Use the same resolved top-match candidate id from the hook above; show the pill only on that row, regardless of current sort.
- If no qualifying candidate exists, no row shows the pill.

## Edge cases

- Project not linked to a job → no AI fit possible → never show Top match.
- All results are preview-only (no internal candidate_id) → no Top match.
- Internal candidate exists but `ai_fit_score` is null / still generating → no Top match (don't fall back to `match_score`).
- Tie at the top → no Top match.

## Out of scope

- No changes to how `match_score` or `ai_fit_score` are computed.
- No changes to sort behavior or other badges (Already collected, source chips, fit tier coloring).
- No backfilling of AI fit for candidates that don't have it.
