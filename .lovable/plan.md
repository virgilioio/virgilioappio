# Per-question score cards in Scorecards tab

Render a grid of small score cards (one per `score_1_5` question) inside each submitted scorecard row on the in-job candidate profile → Scorecards tab, faithfully matching the screenshot.

## Data — already available

`useAllStageScorecards` already attaches `criterion_scores: { questionId, questionText, rating }[]` (only `score_1_5` responses, where `rating` is a `ScoreRating` like `strong_yes`) to each scorecard. No backend/hook changes needed.

## Scope

1. **`src/components/candidates/CandidateProfileSheet.tsx`** — extend the `submittedScorecardRows` mapping (line ~279) to also pass `scores: s.criterion_scores ?? []`.
2. **`src/components/candidates/profile/tabs/ScorecardsTabContent.tsx`** — extend `SubmittedScorecardRow` with an optional `scores: { questionId: string; questionText: string; rating: ScoreRating }[]`, and render the grid inside `PanelistRow` between the header row and the Written feedback block.

No new files. Verdict colors come from the existing palette inline (matches Verdict-distribution sidebar).

## Visual spec (per the screenshot)

Grid placed under the header, above Written feedback:
- Container: `margin-top: 14px; display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;` so it lays out 3–4 across at typical widths and wraps gracefully.
- Each card:
  - `background:#FAFAF7; border:1px solid #F1F0EC; border-radius:10px; padding:12px 14px;`
  - Title: question text, **uppercased**, Inter 10.5px, weight 600, tracking 0.06em, color `#8B8F9E`, single-line truncate.
  - 5 horizontal dashes row (`margin-top:10px; display:flex; gap:6px;`): each dash is `flex:1; height:3px; border-radius:2px;`. The first N dashes (N = rating numeric 1..5) are filled with the rating's verdict color; the remaining dashes are `#E7E8EE`. All filled dashes share the same single color (the candidate's selected rating).
  - Score line: `margin-top:10px; font-family: Poppins; font-weight: 600; font-size: 16px; color:#1F2230;` showing `{n}` followed by a muted `/5` span (Inter 12px, color `#8B8F9E`, `margin-left:2px`).

Color map for filled dashes (verdict-distribution palette):
| Rating | Numeric | Color |
|---|---|---|
| `strong_no` | 1 | `#EF4444` |
| `lean_no`   | 2 | `#F97316` |
| `lean_yes`  | 3 | `#F59E0B` |
| `yes`       | 4 | `#12B886` |
| `strong_yes`| 5 | `#12B886` |

Use `RATING_META[rating].numeric` from `@/lib/scorecardRatings` for the numeric value; keep the color table local to the file (it diverges from `RATING_META.bg`, which is the strong purple/red theme used elsewhere).

If a scorecard has no `score_1_5` questions, the grid is simply omitted (no empty placeholder). Other answer types are ignored, as requested.

## Out of scope

- The Verdict badge, Written feedback, summary sidebar, and comparison card are unchanged.
- No tokens, no responsive breakpoints beyond the auto-fill grid, no animations.
