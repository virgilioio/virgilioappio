# Score (1–5) question UI in the scorecard sheet

Replace the visual rendering of `score_1_5` questions inside `ScorecardSheet.tsx`'s `renderQuestion` so they match the new pill spec. State plumbing (`responses[questionId].answerText` holds the canonical rating string `strong_no | lean_no | lean_yes | yes | strong_yes`) stays as-is.

## Scope (frontend only, one file + one new component)

1. New presentational component: `src/components/candidates/scorecard/ScoreFivePills.tsx`
2. Edit `src/components/candidates/ScorecardSheet.tsx` — `score_1_5` branch only.

No changes to hooks, DB, persistence, validation, or the existing `OverallRatingPills` (still used for the overall verdict elsewhere).

## New component: `ScoreFivePills.tsx`

Props: `{ value: ScoreRating | ''; onChange: (v: ScoreRating | '') => void; disabled?: boolean }`.

Renders the question's pill row only (header + helper text are owned by the parent so they stay consistent with the other question types).

- Wrapper: `role="radiogroup"`, inline style `display:flex; flex-wrap:nowrap; gap:6px`.
- 5 pills, low → high, with these dot colors from the Verdict-distribution palette:

| Value | Label | Dot |
|---|---|---|
| `strong_no` | Strong No | `#EF4444` |
| `lean_no`   | Lean No   | `#F97316` |
| `lean_yes`  | Lean Yes  | `#F59E0B` |
| `yes`       | Yes       | `#12B886` |
| `strong_yes`| Strong Yes| `#12B886` |

- Each pill is a `<button type="button" role="radio" aria-checked={selected} aria-label={label}>` containing a 9×9 dot span (always full color) followed by the label span. No number, no icon.
- Pill base style (inline): `display:inline-flex; align-items:center; justify-content:center; gap:7px; height:34px; padding:0 13px; border-radius:999px; white-space:nowrap; cursor:pointer; flex:0 1 auto; min-width:0; background:#fff; transition: border-color 140ms ease, box-shadow 140ms ease;` Label uses Inter 12.5px.
- Unselected: `border:1px solid #E0DDD3;` no shadow; label color `#5A6072`, weight 500.
- Selected: `border:1px solid #0d0d09;` `box-shadow:0 1px 2px rgba(13,13,9,0.08);` label color `#1F2230`, weight 600.
- Click handler toggles: if the clicked value equals current `value`, call `onChange('')`; otherwise `onChange(clickedValue)`. Disabled disables clicks and applies `cursor-not-allowed`.
- Keep the project's focus ring (`focus-visible:ring-2 ring-virgilio-purple/30`) per the global UI rule, since the spec doesn't override focus.

## `ScorecardSheet.tsx` `score_1_5` branch

Replace the current block (lines ~889–906) with the new layout:

- Outer container: `<div key={question.id} style={{ marginTop:18, paddingTop:16, borderTop:'1px solid #F1F0EC' }}>`.
- Header row: flex row, `justify-content:space-between; align-items:baseline; gap:12px; margin-bottom:10px`.
  - Left: question text — Inter 13px, weight 500, color `#1F2230`, line-height 1.45. Append the required asterisk (`<span className="text-destructive ml-1">*</span>`) when `is_required`.
  - Right: muted type marker `Score · 1–5` — Inter 11px, color `#8B8F9E`, `white-space:nowrap`.
- `<ScoreFivePills value={(response?.answerText as any) || ''} onChange={(v) => handleResponseChange(question.id, { answerText: v })} disabled={isReadOnly} />`
- Helper text (only when `question.notes_for_interviewer` is set): `<p>` with Inter 11px, italic, color `#8B8F9E`, line-height 1.5, `margin-top:12px`.

The empty-string toggle path is already supported by `handleResponseChange` (it shallow-merges; `answerText:''` clears the answer) and by the existing validation (`t === 'score_1_5'` treats falsy as missing, same as today).

## Out of scope

- `OverallRatingPills`, the verdict summary sidebar, persistence, AI generation, and any other question type are untouched.
- No new tokens/CSS variables — values are inlined per spec since they are not yet in the design-token layer.
