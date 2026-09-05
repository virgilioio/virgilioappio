# Restore the job tab rows and the Suggested tab work

## What I found

The work is genuinely gone, not just invisible. Verified in the project as it stands now:

- The latest saved version is "Fixed timezone on booking pages", and nothing is pending on top of it.
- The three new Suggested files (filters helper, toolbar, no-results block) and the pastel token file do not exist.
- The section tab row is still the old card-style version (rounded white card, padding 20-24, stacked labels, extra icons) instead of the 52px six-column segmented control.
- The Suggested tab still shows the old "AI-Matched Candidates" heading with the shared search/Add-candidate strip and an unfiltered table.

So the two pieces were rolled back together and need to be rebuilt from the same specs.

## What I'll rebuild

### 1. The two tab rows (job detail)
- Row 1 (Overview, Pipeline, Job Dashboard, Postings, Setup): compact underline navigation — 13px display type, 8/12 padding, 2px active underline, tight gaps, no rounded card chrome.
- Row 2: a 52px-tall six-column segmented control with equal-width columns, pastel active tones, inline counts, and the sparkle only on Suggested; arrow-key navigation across the row.
- Matching skeleton so the loading state has the same shape as the real row.
- Open question below: whether the first row keeps or drops the Sourcing tab.

### 2. The Suggested tab
- A state-driven strip in place of the generic search/Add-candidate toolbar: heading and sub-line change across loading / results / nothing-found / nothing-matches-your-filters, with counts coming from the data rather than being written in.
- Two visible, removable default filters: match at 70 or above, and hide people already in the pipeline.
- Removable filter chips plus an "Add filter" menu (match floor, seniority, location, skill, last activity, hide in pipeline, hide previously rejected). Adding a filter of the same kind replaces the previous one.
- A Refresh action that re-runs the match, clears any selection, and keeps the filters.
- A "nothing matches your filters" block whose remove-pills come from the same filter list as the chips above, so removing one there widens the list immediately.
- The matcher response and its hook gain the size of the searched pool and the time of the last run, so the sub-line can state both.
- No implicit writes: adding someone to the pipeline stays an explicit action, and "Not a fit" is remembered per job without touching the candidate record.

## Technical notes

- New: `src/components/jobs/suggested/suggestedFilters.ts` (filter model + pure filtering + relative age), `SuggestedToolbar.tsx`, `SuggestedNoResults.tsx`, `src/lib/pastels.ts`.
- Edited: `src/components/jobs/PipelineSectionTabs.tsx`, `src/components/ui/hero-skeletons.tsx`, `src/pages/JobDetail.tsx` (row-1 triggers, toolbar suppression on Suggested, filter state, wiring), `src/hooks/useJobSuggestedCandidates.ts` (`searchedCount`, `lastUpdatedAt`), `supabase/functions/get-suggested-candidates/index.ts` (`searched_count` on cached/empty/fresh paths).
- No changes to data shape beyond the additive `searched_count`, no permission changes, no pipeline mutations added.
- Validation: typecheck plus the build check after the edits.
