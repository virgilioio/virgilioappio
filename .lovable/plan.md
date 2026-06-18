## Goal

Introduce a 5-level scoring system (**Strong no · Lean no · Lean yes · Yes · Strong yes**) that powers:

1. A new **basic question type** "Score (1–5)" for scorecards.
2. The **Overall Rating** pills inside the Scorecard sheet (replaces today's 4-level Definitely no / No / Yes / Strong yes).
3. Per-criterion **score cards** rendered in the in-job candidate profile › *Scorecards › Submitted scorecards* (the CRAFT 5/5, SYSTEMS THINKING 5/5… blocks from the reference screenshot).

---

## Rating model

Canonical values (in display order, weakest → strongest):

| value        | label       | color (hex)        |
|--------------|-------------|--------------------|
| `strong_no`  | Strong no   | `#C9554C` (red)    |
| `lean_no`    | Lean no     | `#E7ABA4` (peach)  |
| `lean_yes`   | Lean yes    | `#F5C16C` (amber)  |
| `yes`        | Yes         | `#C8B9F0` (lilac)  |
| `strong_yes` | Strong yes  | `#6F3FF5` (purple) |

Numeric mapping for 1–5 score: `strong_no=1, lean_no=2, lean_yes=3, yes=4, strong_yes=5`.

---

## 1 · Database migration

Extend the existing `score_rating` enum and migrate legacy rows so the UI never has to show the deprecated labels.

```sql
ALTER TYPE score_rating ADD VALUE IF NOT EXISTS 'strong_no';
ALTER TYPE score_rating ADD VALUE IF NOT EXISTS 'lean_no';
ALTER TYPE score_rating ADD VALUE IF NOT EXISTS 'lean_yes';

-- Migrate legacy values to the new 5-level model
UPDATE scorecards SET rating = 'strong_no' WHERE rating = 'definitely_no';
UPDATE scorecards SET rating = 'lean_no'  WHERE rating = 'no';
-- (yes / strong_yes are unchanged)
```

`definitely_no` and `no` remain in the enum (Postgres can't drop enum values cleanly) but are no longer surfaced in the UI.

Per-question scores reuse the existing `scorecard_question_responses.answer_text` column — we store the canonical string (e.g. `"strong_yes"`). No schema change needed for question responses.

---

## 2 · Shared rating catalogue

New file `src/lib/scorecardRatings.ts` exporting:

- `RATING_VALUES` ordered array of 5 values.
- `RATING_META: Record<ScoreRating, { label; numeric: 1-5; bg; text; icon }>` (single source of truth for label/color/icon used by pills, badges, and criterion cards).
- `ratingTone()` and `ratingLabel()` helpers.

Update `src/hooks/useScorecards.ts`:

```ts
export type ScoreRating =
  | 'strong_no' | 'lean_no' | 'lean_yes' | 'yes' | 'strong_yes'
```

---

## 3 · New basic question type: Score (1–5)

`src/hooks/useScorecardsConfiguration.ts`

- Extend `AnswerType` with `'score_1_5'`.
- Add to `SCORECARD_BASIC_TYPES`: `{ type: 'score_1_5', label: 'Score (1–5)', icon: Star, hint: 'Strong no → Strong yes' }`.
- No config UI needed beyond label + required toggle (mirrors `yes_no`).

`src/components/jobs/stage-config/InterviewQuestionsList.tsx` — already picks icon/label from the catalogue, so the new type renders automatically.

---

## 4 · Render the 1–5 score in the Scorecard sheet

`src/components/candidates/ScorecardSheet.tsx` question renderer:

- Add a `score_1_5` branch that renders a compact horizontal row of 5 pills (same component family as `OverallRatingPills` but smaller — `h-9`, label hidden on narrow widths, tooltip shows full label) bound to `responses[questionId].answerText`.
- Validation: when `is_required`, accept any of the 5 enum strings.

---

## 5 · Update Overall Rating pills to 5 levels

`src/components/candidates/scorecard/OverallRatingPills.tsx`

- Replace the 4-pill array with the 5-pill array from `RATING_META`.
- Switch grid to `grid-cols-5`.
- Icons: ThumbsDown (strong_no), Frown (lean_no), Meh (lean_yes), ThumbsUp (yes), Star (strong_yes).

`ScorecardSheet.tsx`:
- Update internal `ratingOptions` array and the `aiRatingToScoreRating` map to the new 5 values (`"Lean Yes" → 'lean_yes'`, `"Lean No" → 'lean_no'`, `"Strong No" → 'strong_no'`).
- Default rating for new scorecards stays `'yes'`.

---

## 6 · Submitted scorecards — criterion cards

`src/components/candidates/profile/StageScorecardsCard.tsx`

- Update `RATING_LABEL` and `ratingTone` to cover all 5 values (lean_yes → yellow, lean_no → orange).
- Verdict pill colours now read from `RATING_META`.
- For each submitted scorecard, fetch its `scorecard_question_responses` joined to `scorecard_interview_questions` (already wired via `useAllStageScorecards` — extend the hook if not).
- Below each panelist's verdict, render a responsive grid of **criterion cards** for every `score_1_5` question:

  ```
  ┌──────────────────────┐
  │ CRAFT                │   ← question_text, uppercase 10.5px label
  │ ━━━━━━━━━━━━━━━━     │   ← 5 dashes; the first N coloured with the
  │ 5/5                  │     rating colour, remainder neutral
  └──────────────────────┘
  ```

  Card spec: white bg, `#E7E8EE` border, radius 12, padding 16, Poppins 13/700 for "N/5", dashes built with 5 spans of 4px height.

- Verdict distribution sidebar (already designed for 5 levels in the screenshot) becomes accurate automatically once ratings are 5-level.

---

## 7 · Touch-ups

- `RecommendedNextStepsDialog`, `ExpandableScoreDisplay`, `useAssociationScorecardSummary`, `CandidateProfileSheet`: update any hard-coded `'definitely_no' | 'no'` references to the new vocabulary (search-and-replace using the shared `RATING_META`).
- Seed/demo data: replace any future seeds that still use `definitely_no` (no data fix required — migration handles existing rows).

---

## Out of scope

- Per-criterion weighting / aggregate score math beyond simple average.
- Configurable rating scales (always 5).
- Backfilling historical `scorecards.general_overview` text.

---

## Technical notes

- Enum extension via `ALTER TYPE ... ADD VALUE` must run outside a transaction; the migration tool handles this by splitting statements.
- Keeping `definitely_no` / `no` enum values avoids brittle enum-rewrite migrations; UI maps them through `RATING_META` (which marks them as legacy → coerced to `strong_no` / `lean_no` for display) as a safety net in case any row escapes the UPDATE.
- All colour/label literals live in `src/lib/scorecardRatings.ts` so future tweaks are one-file edits.
