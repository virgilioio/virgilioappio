# Restore the job tab rows and the Suggested tab work

## What I found

The work is genuinely gone, not just invisible. Verified in the project as it stands now:

- The latest saved version is "Fixed timezone on booking pages", and nothing is pending on top of it.
- The three new Suggested files (filters helper, toolbar, no-results block) and the shared pastel token file do not exist.
- The section tab row is still the old card-style version (rounded white card, 20-24px padding, stacked label/count) instead of a segmented control.
- The Suggested tab still shows the old "AI-Matched Candidates" heading with the shared search/Add-candidate strip and an unfiltered table.

So both pieces were rolled back together and need rebuilding from the same specs.

## 1 · Row 1 — page tabs

Inside the white header block, directly under the page header, 4px below it. Header block: padding 20/28/0, 1px bottom hairline #E7E8EE, white.

- Container: flex, align center, gap 2, padding 0 2.
- Tabs in order: Overview · Pipeline · Job Dashboard · Postings · Setup. No counts, no icons.
- Each button: padding 8px 12px, transparent background, no border, 2px transparent bottom border, margin-bottom -1px so the active underline sits on the header hairline, 500 13px Poppins, letter-spacing -0.005em, colour #5A6072.
- Active: bottom border #0d0d09, colour #0d0d09, weight 600. Hover inactive: colour only.
- Row height lands ~33px; no min-height or fixed height.

Open question below about the current extra Sourcing tab.

## 2 · Row 2 — pipeline segmented control

Only on Pipeline, over the cream canvas, in a wrapper with padding 16px 28px 0 (so exactly 16px between the header hairline and the control).

- Container: grid, 6 equal columns, gap 6, padding 6, white, 1px #E7E8EE, radius 12. No scroll, no wrap. Total height 52px.
- Item: padding 10px 12px, radius 8, flex row align center gap 8, 1px transparent border (kept on inactive so height never jitters), transparent background, colour #5A6072. Height 40px.
- Active: background = tone bg, colour = tone fg, border-colour = tone bg. Hover inactive: #FAFAF7. Transition background/colour 120ms only.
- Tones from a shared PASTELS token module (no re-typed hexes in the component): suggested lilac #E9DEFE/#5B21B6, application #EDE4FF/#5B21B6, recruiting #FEF3C7/#92400E, offers #DBEAFE/#1E40AF, hired #D1FAE5/#065F46, rejected #F1F0EC/#5A6072.
- Contents on one line: sparkle 13px only on Suggested (#6F3FF5 inactive, tone fg active), label 12.5px Poppins 500/600 in a column wrapper at line-height 1.2, count pill pushed right — padding 1px 6px, radius 999, 600 10.5px Inter, inactive #F1F0EC/#5A6072, active tone-fg background with white text.
- Counts always come from the pipeline queries; zero-count sections stay visible with a `0` pill.
- Keyboard: tablist/tab roles, aria-selected, arrows to move, Home/End to jump.
- The loading skeleton is reshaped to the same 52px six-column control.

Accept criteria: row 2 = 52px, item = 40px, row 1 ~33px with flush underline, 16px gap, six equal columns, one line per item, only Suggested has an icon, only row 2 has counts, only row 1 has an underline, clicking never resizes the row.

## 3 · The Suggested tab

- A state-driven strip replaces the generic search/Add-candidate toolbar: heading and sub-line change across loading / results / nothing found / nothing matches your filters, with every number coming from the data.
- Two visible, removable defaults: match 70 or above, and hide people already in the pipeline.
- Removable filter chips plus an Add filter menu (match floor, seniority, location, skill, last activity, hide in pipeline, hide previously rejected). Adding a filter of the same kind replaces the previous one.
- Refresh re-runs the match, clears selection, keeps filters.
- The "nothing matches your filters" block draws its remove-pills from the same filter list, so removing one widens the list at once.
- The matcher response and its hook gain the searched-pool size and last-run time so the sub-line can state both.
- No implicit writes: adding to the pipeline stays explicit; "Not a fit" is remembered per job without touching the candidate record.

## Technical notes

- New: `src/lib/pastels.ts`, `src/components/jobs/suggested/suggestedFilters.ts`, `SuggestedToolbar.tsx`, `SuggestedNoResults.tsx`.
- Edited: `src/components/jobs/PipelineSectionTabs.tsx`, `src/components/ui/hero-skeletons.tsx`, `src/pages/JobDetail.tsx` (row-1 triggers, header/canvas spacing, toolbar suppression on Suggested, filter state and wiring), `src/hooks/useJobSuggestedCandidates.ts` (`searchedCount`, `lastUpdatedAt`), `supabase/functions/get-suggested-candidates/index.ts` (additive `searched_count`).
- No permission changes, no new pipeline mutations, no data-shape changes beyond `searched_count`.
- Validation: typecheck, build check, and a measured browser pass on the two rows if the preview session allows it.

## One decision needed

Row 1 currently also has a **Sourcing** tab, which your five-tab list omits. Should I remove it, or keep it alongside the five?
