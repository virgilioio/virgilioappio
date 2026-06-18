## Goal
Let the AI Question Generator produce **Score (1–5)** questions in addition to Text and Yes/No.

## Changes

### 1. Edge function — `supabase/functions/generate-scorecard-questions/index.ts`
- Extend the `answer_type` enum in the tool schema from `["text", "yes_no"]` to `["text", "yes_no", "score_1_5"]`.
- Update the `GeneratedQuestion` interface accordingly.
- Expand the system prompt's "Question Guidelines" so the model knows when to use each type:
  - `text` — open-ended behavioral/STAR questions.
  - `yes_no` — simple screening (e.g. work authorization).
  - `score_1_5` — rateable competency / trait questions where the interviewer scores the candidate on a 1–5 scale (e.g. "Rate the depth of the candidate's React expertise", "Rate communication clarity"). Encourage using this for skill / competency / cultural-fit dimensions where a calibrated rating is more useful than free text.
- Encourage a healthy mix (typically 2–4 of the 5–8 questions as `score_1_5` when the stage focuses on competencies/skills/culture).

### 2. Hook — `src/hooks/useScorecardQuestionsGeneration.ts`
- Widen `answer_type` on `GeneratedQuestion` to `'text' | 'yes_no' | 'score_1_5'`.

### 3. Panel — `src/components/jobs/stage-config/ScorecardQuestionsGenerationPanel.tsx`
- Replace the inline `yes_no ? 'Yes/No' : 'Text'` badge with the shared label from `getScorecardTypeDef(answer_type)` (or an inline switch) so `score_1_5` renders as **Score (1–5)** with its Star icon, matching the manual builder.

## Non-goals
- No DB schema changes (the `score_1_5` type already exists end-to-end from the prior change).
- No changes to the answering UI in `ScorecardSheet`.
