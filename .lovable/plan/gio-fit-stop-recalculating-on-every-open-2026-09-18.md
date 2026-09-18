# Gio Fit — stop recalculating on every open

Today the Gio Fit tab regenerates the analysis whenever it decides the stored one looks incomplete, and the review panel regenerates whenever there is nothing stored. Opening a profile can therefore spend credits even though nothing about the candidate changed. This change makes generation event-driven: compute once, then only recompute when there is genuinely new information or the user asks.

## When the analysis runs

Runs:
- No analysis stored yet for this candidate and job (first open, or candidate newly added to the job).
- The candidate moved to a different stage since the analysis was generated.
- A scorecard was submitted for this candidate since the analysis was generated.
- A resume was uploaded or replaced since the analysis was generated.
- The candidate's own details were edited (already wired on save).
- The output language or proper-noun preference changed (already wired).
- The user hits Refresh.

Never runs:
- Simply opening or re-opening the Gio Fit tab.
- Route changes, tab switches, window refocus, background refetches.
- Because the stored analysis is an older format. Older analyses render as they are; the missing per-skill verdicts fall back to the existing behaviour and the section shows a quiet "Refresh to update" affordance instead of self-triggering.

## What the user sees

- Stored analysis appears immediately, with the existing "generated" provenance already in the header area.
- When one of the trigger events has happened but the analysis has not been recomputed yet, the tab shows a small "New information available — Refresh" line next to the Refresh button, and recomputes automatically once (this is a real change in inputs, not a page open).
- First-ever open on a candidate with no analysis keeps today's generating state.

## Technical notes

- `useCandidateFitInsights` gains staleness inputs read in the same query/round trip: `entered_stage_at` from the association (already on the table), the latest resume attachment date from `candidate_attachments` (`is_resume`), and the latest scorecard submission date from `job_stage_scorecards` for this candidate and job. It returns `isStale` plus the reason, computed by comparing each against `ai_fit_generated_at`.
- The hook stops being the place that decides to generate. `CandidateInsightsTab` replaces its current effect: trigger only when `!insights?.analysis` (and the job description is long enough) or when `isStale`. The `needsSkillVerdicts` auto-trigger is removed; `skill_evidence` absence no longer causes generation.
- `ApplicationReviewSheet`'s `FitInsightsPanel` effect gets the same guard — generate only when nothing is stored, plus a `hasTriggered` ref so an in-flight generation cannot fire twice.
- React Query options on the insights query get `staleTime` and `refetchOnWindowFocus: false` so remounts read cache rather than refetching and re-evaluating triggers.
- Existing explicit triggers stay as they are: resume replace and candidate edit in `CandidateProfileSheet`, scorecard submit in `ScorecardSheet`, association create in `useCandidateAssociations`, language change in the hook.
- No schema changes, no new columns, no edge function changes. Every staleness signal comes from timestamps already stored.
