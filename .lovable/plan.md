## Goal

Make the **Question Type** dropdown in *Configure Stage → Scorecards → Add interview question* visually identical to the "+ Add question" menu in the Job Wizard → Job posting → Application form, with the same two sections — **Smart fields** and **Basic question types** — icons on the left, lilac "Smart" badge on the right for smart items. Drop the "From your library" section (these are interview questions, not application-form fields).

The new options aren't just visual — they become real, working interview answer types end-to-end (configure → scorecard fill → save).

## Scope

### 1. Shared answer-type catalog (`src/hooks/useScorecardsConfiguration.ts`)

Extend `AnswerType` to the full Gio set, reusing the same identifiers as `ApplicationFormBuilder` so the icon map and labels stay consistent:

- **Smart fields:** `salary_expectations` (existing), `location`, `phone`, `linkedin`, `employment_type`, `work_location`, `recruiter`
- **Basic types:** `text` (Short text), `longtext` (Long text), `number`, `email`, `url`, `date`, `single_select`, `yes_no`, `file`, plus existing `multi_select`

No DB migration — `scorecard_interview_questions.answer_type` is a free text column with no check/enum, confirmed via schema query.

Export a single source-of-truth list (`SCORECARD_SMART_FIELDS`, `SCORECARD_BASIC_TYPES`) with `{ type, label, icon, hint?, description? }`, mirroring the structure in `ApplicationFormBuilder.tsx` so both menus stay visually identical.

### 2. Rebuild the Question Type field (`InterviewQuestionForm.tsx`)

Replace the current `<Select>` with the exact dropdown chrome used in the application-form builder:

- `DropdownMenu` + `DropdownMenuTrigger` styled to look like a Select trigger (32h, hairline border, chevron right, shows selected icon + label).
- `DropdownMenuContent align="start" sideOffset={8} className="w-[320px]"` — same width and chrome.
- Section 1 — `DropdownMenuLabel` with `Sparkles` icon: **"Smart fields"**, then each smart item: icon (3.5 × 3.5, `text-text-tertiary`), label, `<Badge tone="lilac" size="xs">Smart</Badge>` on the right.
- `DropdownMenuSeparator`.
- Section 2 — `DropdownMenuLabel`: **"Basic question types"**, then each basic item: icon + label.
- No "From your library" section.

### 3. Salary-style sync hint for new smart fields

Today the form shows a "Syncs to Candidate Profile" lilac block only for `salary_expectations`. Generalize it: when the selected type is any smart field that maps to a candidate-profile field (location, phone, linkedin, employment_type, work_location), show the same lilac sync banner with the relevant label. `recruiter` shows a different hint ("Routes the candidate to a recruiter"). For non-smart types, no banner.

For these new smart types the question text is auto-set (like salary today) and the free-text question textarea is hidden — the type *is* the question.

### 4. Render the new answer types when interviewers fill the scorecard (`src/components/candidates/ScorecardSheet.tsx`)

Extend the `switch (question.answer_type)` block (~L836) and the validation block (~L680) with renderers/validators for the new types:

- `text` (existing) and `longtext` → Textarea
- `number` → numeric Input
- `email` / `url` → Input with the corresponding type + light client validation
- `date` → `DatePickerVirgilio`
- `phone` → phone Input
- `linkedin` → URL Input (LinkedIn icon affordance)
- `location` → free-text Input (location autocomplete is out of scope here)
- `employment_type`, `work_location` → Select using the same option lists as the application-form smart fields
- `recruiter` → Select of workspace members
- `file` → file upload using the existing candidate-attachment storage helper
- `single_select` / `multi_select` / `yes_no` / `salary_expectations` — unchanged

Also extend the post-submit "sync to candidate profile" logic next to the existing salary sync (~L760) so answers to the new smart types update the matching candidate column (phone, linkedin, location, employment_type, work_location, recruiter).

### 5. Question list display (`InterviewQuestionsList.tsx`)

Add icons + labels for the new types in `getAnswerTypeIcon` / `getAnswerTypeLabel` so the configured-questions list shows the correct chip per type, reusing the shared icon map from step 1.

## Out of scope

- "From your library" section in this dropdown — explicitly removed per request.
- Changing the application-form builder.
- AI question generation (`ScorecardQuestionsGenerationPanel`) — it already only emits `text` / `yes_no`; left as-is.
- Location autocomplete inside the scorecard fill view.

## Files touched

- `src/hooks/useScorecardsConfiguration.ts` — extend `AnswerType`, export shared catalogs.
- `src/components/jobs/stage-config/InterviewQuestionForm.tsx` — rebuild the Question Type field, generalize the sync banner.
- `src/components/jobs/stage-config/InterviewQuestionsList.tsx` — icon/label map for new types.
- `src/components/candidates/ScorecardSheet.tsx` — render + validate + sync new types.

No new files, no new migrations.
