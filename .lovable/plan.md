# Restore the job tab rows and rebuild the Suggested tab

## What I found

The earlier work is genuinely gone, not just invisible. Verified in the project as it stands now:

- The latest saved version is "Fixed timezone on booking pages", and nothing is pending on top of it.
- The Suggested helper/toolbar/no-results files and the shared pastel token file do not exist.
- The section tab row is still the old card-style version (rounded white card, 20-24px padding, stacked label/count) rather than a segmented control.
- The Suggested tab still shows the old "AI-Matched Candidates" heading with the shared search/Add-candidate strip and an unfiltered table.

Both pieces get rebuilt from the specs below.

## 1 · Row 1 — page tabs

Inside the white header block, 4px under the page header. Header block: padding 20/28/0, 1px bottom hairline #E7E8EE, white.

- Container: flex, align center, gap 2, padding 0 2.
- Tabs: Overview · Pipeline · Job Dashboard · Postings · Setup. No counts, no icons.
- Each button: padding 8px 12px, transparent background, no border, 2px transparent bottom border, margin-bottom -1px so the active underline sits on the header hairline, 500 13px Poppins, letter-spacing -0.005em, colour #5A6072.
- Active: bottom border and text #0d0d09, weight 600. Hover inactive: colour only.
- Height lands ~33px; no min-height or fixed height anywhere.

Open question at the end about the extra Sourcing tab.

## 2 · Row 2 — pipeline segmented control

Only on Pipeline, over the cream canvas, wrapper padding 16px 28px 0 (exactly 16px below the header hairline).

- Container: grid, 6 equal columns, gap 6, padding 6, white, 1px #E7E8EE, radius 12, total 52px. No scroll, no wrap.
- Item: padding 10px 12px, radius 8, flex row align center gap 8, 1px transparent border kept on inactive so height never jitters, colour #5A6072, height 40px.
- Active: background tone bg, text tone fg, border tone bg. Hover inactive #FAFAF7. Transition background/colour 120ms only.
- Tones from a shared PASTELS module: suggested #E9DEFE/#5B21B6, application #EDE4FF/#5B21B6, recruiting #FEF3C7/#92400E, offers #DBEAFE/#1E40AF, hired #D1FAE5/#065F46, rejected #F1F0EC/#5A6072.
- One line per item: sparkle 13px only on Suggested (#6F3FF5 inactive, tone fg active), label 12.5px Poppins 500/600 in a column wrapper at line-height 1.2, count pill right — padding 1px 6px, radius 999, 600 10.5px Inter, inactive #F1F0EC/#5A6072, active tone-fg fill with white text.
- Counts always from the pipeline queries; zero-count sections stay visible with a `0` pill.
- Keyboard: tablist/tab roles, aria-selected, arrows to move, Home/End to jump. The loading skeleton is reshaped to the same control.

## 3 · Suggested tab

### Structure
Tab body owning state, filters and selection; toolbar; table header; row; skeleton; true-empty; filtered-empty; floating bulk bar. Sub-atoms for reason chip, match cell, location cell, status cell, actions, checkbox, shimmer. Reuse existing Button/Avatar/icons and the canonical empty-state illustration library.

### The table
One shared grid constant used by header, rows and skeleton: `28px minmax(0,1.65fr) minmax(0,2.1fr) 96px minmax(0,0.85fr) 96px 128px 116px`, align center, gap 12, padding 10/16, min-height 64. Card: white, 1px #E7E8EE, radius 12, overflow hidden.

Columns: select · Candidate (avatar, name Poppins 13.5/600 over role @ company) · Why Gio suggested them · Match · Location · Last active · Status · Actions.

- Header row: #FAFAF7, bottom hairline, top radius 12, labels Inter 10.5/600 uppercase 0.055em #8B8F9E; active sort column ink with arrow-down, other sortable columns chevrons-up-down at 11. Default sort Match desc; sortable Match and Last active. Select-all in column 1; column 8 empty.
- Rows: white, hover #FAFAF7, selected #FAF8FF, 1px #F1F0EC divider except last; whole row opens the profile; checkbox and action buttons stopPropagation.
- Reason chips: padding 2.5/7, radius 6, #FAF8FF on #EDE4FF border, 11px Inter #4B2BB0; up to three plus a muted `+N` (white, #E7E8EE, #8B8F9E). Wrapping is fine. Only named reasons from the matcher — never a generic chip; a row with no evidence is not rendered. Optional recruiter-note line below: sticky-note icon 10 + Inter 10.5 #8B8F9E, single line.
- Match cell: right-aligned, score Poppins 14.5/600 -0.02em over a 44×3 bar (track #F1F0EC, fill = score%), tiered colour ≥88 #12B886, ≥78 #6F3FF5, else #F59E0B. No percent sign; unscored rows show an em-dash in #C2C6D2.
- Location cell: location Inter 12 #1F2230 over a fit line — check + "Fits job" #12B886, or alert-triangle + "Check location" #F59E0B. Amber prompts, never blocks.
- Status cell: free (circle-dashed, #8B8F9E, "Not in pipeline"), pipeline (git-branch, #6F3FF5, job · stage), contacted (send, #0B7285, "Emailed N days ago"), rejected (circle-slash, #C2410C, job · month/year). Labels Inter 11.5 (500 except free), note Inter 10.5 #8B8F9E single line. Rejected is shown, not hidden.
- Actions: right-aligned gap 6, opacity 0.35 at rest → 1 on row hover or selection, 120ms. Add = ink pill 6/10, radius 8, #0d0d09 on #fffcf9, Poppins 11.5/600, plus icon 11 — adds to this job's first stage and removes the row. Not a fit = 26×26, radius 8, 1px #E7E8EE, thumbs-down 12, titled — removes the row, stored as a per-job dismissal only.
- Bulk bar on selection: fixed to the section, centred, bottom 22, radius 999, ink background, cream text, shadow 0 12px 30px rgba(13,13,9,.28), padding 9/10/9/16 — "N selected", divider, Add to pipeline (cream pill), Email (outlined), close.
- Footer line (results state only): centred Inter 11.5 #8B8F9E with info icon 11 — "Showing the top {shown} of {total} · suggestions never move a candidate on their own — adding is always your call." Both numbers derived.

### Toolbar — everything derived
Two-part row, align-items flex-end, wraps. Left: heading Poppins 16/600 -0.02em, a "Gio match" chip only in the results state, sub-line Inter 12 #5A6072.

| state | heading | sub-line |
|---|---|---|
| loading | Finding suggestions | This usually takes a few seconds. |
| results | {total} suggested from your database | Ranked against this job's requirements · {searched} profiles searched · updated {age} |
| empty | No suggestions yet | {searched} profiles searched · no overlap with this job's requirements · updated {age} |
| noresults | No suggestions match your filters | {total} suggestions found · {total − shown} hidden by {n} filter/filters |

Right: one chip per active filter, an "＋ Add filter" chip, a 1×20 #E7E8EE divider, and Refresh. Chip: padding 5/9, radius 999, 11.5 Inter; active #EDE4FF on #D7C5FB with #6F3FF5 label, #4B2BB0 600 value and a × at 10; inactive white on #E7E8EE, #5A6072.

Default filters: Match ≥ 70 and Hide in pipeline. The filter array is the single source of truth — toolbar chips, no-results remove-pills and the sub-line counts all read from it, and removing from either place removes the same object. Adding a filter of the same dimension replaces the previous one. Refresh re-runs the match, clears selection, enters loading, keeps filters.

### Loading state
Runs on first visit to the tab, on Refresh, and when the job's requirements change. Progress banner replaces the header row: padding 12/16, gradient #FAF8FF → #fff 70%, bottom hairline, top radius 12 — 26×26 purple tile with cream sparkles 13 pulsing 1 → .45 → 1 over 1.4s, title Poppins 13/600 "Matching your database against this job…", sub Inter 11.5 #5A6072 naming the actual criteria, and a right-aligned 120×4 #F1F0EC track with a 40%-wide #6F3FF5 bar sweeping -100% → 250% over 1.6s. Indeterminate on purpose.

Seven skeleton rows on the shared grid at min-height 64, opacity `1 − i × 0.085`, with the per-cell bar sizes from the spec and the shared shimmer primitive (two greys, 1.4s). Every animation wrapped in a prefers-reduced-motion escape. A row is fully skeleton or fully real, never mixed.

### Empty states
All three use the canonical soft-scene illustration family, not icon tiles. Shared body recipe: padding 40/28/44, centred column, illustration in a 150px well with 18px below, title Poppins 19/600 -0.02em, sub Inter 13 #5A6072 line-height 1.55 max-width 340 margin-top 8, md buttons gap 9 margin-top 18.

- True empty (paper-plane scene, no table header above): "No one in your database matches this job yet" + "Gio checked {searched} profiles against this brief and found no meaningful overlap…", buttons Search the database (primary) and Edit job requirements (secondary), plus a ghost "↻ Run the match again" link. Heading stays "No suggestions yet" and prints no count.
- Filtered empty (magnifier scene, table header stays visible): "No matches" + "{total} suggestions exist — {n} filters are hiding them. Loosen one to widen the match.", one white remove-pill per active filter generated from the array, then an ink "↺ Clear all".
- Cleared-the-top (tray + check): "You've cleared the top suggestions" + "{remaining} lower-ranked matches are still waiting behind them." with "Show the next {pageSize}".

### State machine
Enum is `loading | results | empty | noresults`. Cleared-the-top is results with zero rows and a non-zero remainder — a predicate, not a state. Refresh from anywhere goes to loading; every transition clears selection. `total` and `shown` are separate derived numbers.

### Accept criteria
One grid constant across header, rows and skeleton; no literal count, filter label or state label in the components; heading, sub-line and Gio-match chip all state-driven (empty must not claim a count); toolbar chips and no-results pills share one array; empty states use the canonical illustrations; filtered-empty keeps the header and true-empty does not; skeleton uses the shared shimmer and honours reduced motion; row click, checkbox, Add and Not-a-fit don't fight; nothing writes to the pipeline without an explicit click.

## Technical notes

- New: `src/lib/pastels.ts`; `src/components/jobs/suggested/` — `suggestedGrid.ts` (shared grid constant + tiers), `suggestedFilters.ts` (filter model, pure filtering, relative age), `SuggestedToolbar.tsx`, `SuggestedTable.tsx` + `SuggestedRow.tsx` + cell atoms, `SuggestedSkeleton.tsx`, `SuggestedEmpty.tsx`, `SuggestedNoResults.tsx`, `SuggestedBulkBar.tsx`, `JobSuggestedTab.tsx`.
- Edited: `src/components/jobs/PipelineSectionTabs.tsx`, `src/components/ui/hero-skeletons.tsx`, `src/pages/JobDetail.tsx` (row-1 triggers, header/canvas spacing, generic toolbar suppressed on Suggested, tab body swapped in), `src/hooks/useJobSuggestedCandidates.ts` (searched-pool size and last-run time), `supabase/functions/get-suggested-candidates/index.ts` (additive `searched_count`).
- Status/last-active/recruiter-note values come from existing candidate and association data; anything the data can't support renders nothing rather than a placeholder.
- No permission changes, no new pipeline mutations beyond the existing explicit add, no data-shape changes beyond `searched_count`.
- Validation: typecheck, build check, and a measured browser pass on both rows and the table alignment if the preview session allows it.

## One decision needed

Row 1 currently also has a **Sourcing** tab, which your five-tab list omits. Remove it, or keep it alongside the five?
