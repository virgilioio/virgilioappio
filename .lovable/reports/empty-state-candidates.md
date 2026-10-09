# Gio ATS · Job pipeline: loading vs empty, and the Candidates empty state

Built directly in the repo by Claude on 2026-10-09 from the Claude Design handoff: "Empty State — Candidates", "Job Pipeline — Loading vs Empty", `job-pipeline-empty.jsx` and `empty-state-motion.jsx`. Tested in headless Chromium against intercepted fake data only. An independent review found eight issues, and all were fixed before merging.

## The bug
A job with no candidates showed its loading skeleton forever. `usePipelineCandidateStatuses` reported "loading" while any of its queries had no data. With zero candidates those queries are disabled, so they never get data. Two related problems:
- A failed fetch was shown as an empty list: the association fetch swallowed errors and returned `[]`.
- A failed or slow load had no way out.

## What changed
- **`PaperPlaneScene` + `CandidatesEmpty`** (`src/components/empty/`). This is the canonical candidate-list empty state.
  - The plane follows the dotted trail's real geometry and settles on the exact static `SoftPlane`. The test showed a 1-pixel difference.
  - It plays once per surface per session; with reduced motion it's static.
  - IDs are unique per instance.
- **Job pipeline (board and list):**
  - The view comes from the request status.
  - First load only: a skeleton with the board's footprint, then a crossfade.
  - Error, or more than 15 seconds: an inline error with Retry.
  - Empty and filtered-empty states.
  - When the first candidate arrives, the empty state fades out and the card rises and flashes.
  - Empty stage columns use two tiers: the first gets the compact illustration, the rest a one-line row.
  - Refreshes show a toolbar spinner and never the skeleton.
- **Application review, Job offers, Hired, Rejected:** the same rules, with each section's own copy. Suggested keeps its copy; its empty and filtered states use the plane.
- **Robustness:**
  - A failed refresh keeps the board.
  - A failed hiring plan shows Retry instead of "No hiring plan".
  - Switching jobs in place starts a fresh first load.
  - Section lists wait for both of their queries.

## Design → ATS mappings (CLAUDE.md precedence: existing primitives win)
| Design value | Built as | Why |
|---|---|---|
| Shimmer `#EFEEE9 → #F7F6F2`, 1.2s | `Skeleton` (`gio-shimmer`, 1.2s linear) | Existing §6 primitive |
| Skeleton → empty crossfade, hand-rolled | `Loadable` (200ms, shared grid cell) | Existing §6 primitive |
| Title Poppins 17px `#2A2730`, body 13px `#8B8F9E` | Title 18px `#0d0d09`, body 13px `#5A6072` (compact 15 / 12.5) | The ATS empty-state typography (`ui/empty-state.tsx`) |
| Black pill buttons (Inter 600 13px, radius 999) | `EmptyAction` (Poppins 500 14px, radius 8), now with press feedback | The ATS empty-state button |
| "Share posting" opens the share menu | Copies the live posting's public link; "Create job post" when there's none; hidden on drafts | The share menu has no posting link |
| Plane CSS transform about the SVG origin | Plane rolls about its resting centroid (`transform-origin` 123.1/57) | The roll otherwise swung the plane about 40px off the trail |
| Not in the design | "No one in the recruiting process yet" when the job's candidates are all in other sections | "No candidates yet" would be untrue there |
| Not in the design | "No matches in {Stage}" for a stage column emptied by filters | "Nothing in {Stage}" would be untrue |

## Checks (Step 6)
1. **Zero candidates:** the skeleton shows, then the empty state as soon as the request answers. Pass.
2. **Request over 15s:** the error with Retry shows. A late answer still replaces it. Pass.
3. **Filters returning nothing:** the filtered copy with Clear filters shows. Clear filters brings the board back with no skeleton. Pass.
4. **Background refresh:** no skeleton. A failed refresh keeps the board. Pass.
5. **No layout shift:** the board area keeps one height (478px) from skeleton to empty to board. Pass.
6. **The plane:** it plays once and settles on the static graphic. Reduced motion shows it static. Coming back to the section shows it at rest. Pass.
7. **First candidate:** the empty state fades out over 150ms, and the card rises 6px and then flashes. Pass.
8. **List view and sections:** the List view, Application review, Job offers, Rejected and Suggested follow the same rules. Pass.
9. **Accessibility:**
   - The skeleton has `aria-busy` and the "Loading candidates" label.
   - The empty state has `role="status"` and the error has `role="alert"`.
   - Clear filters keeps focus in the list.

   Pass.

## Not done here (next step)
The Lovable prompt's table also covers other candidate lists outside the job: the global Candidates route, the talent database, Find results, saved lists, CRM contacts, archived candidates and reference checks. Each needs the same loading-vs-empty check before its illustration is swapped, so they're a separate pass.
