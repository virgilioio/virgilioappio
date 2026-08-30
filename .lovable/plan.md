# Answer rendering — every referee answer type

One renderer for a referee's submitted answers, used by the expanded `<RefereeRow>` (so it lands on both the request card and, later, the request detail page). Plus the three missing question types end to end, the two new author controls, and the 15-question default template.

## What changes

### 1. Three new question types
The reference question set today has no `number`, `date` or `date_range`. Adding them:
- Migration extending the `reference_answer_type` type with `number`, `date`, `date_range` (no column uses it today, so nothing else moves).
- `templateModel.ts`: entries in `QUESTION_TYPES` (Date & number family), defaults in `newQuestion` (`precision: 'month_year'` for the date types), and `canAskCandidate` stays `rating_1_5`-only.
- `QuestionInstrument.tsx` gains referee-facing instruments for all three, reusing the canonical pickers already wrapped for public pages (`PublicDateField`, `PublicMonthField`) and `PublicInput` for number — so the candidate self-assessment renders identically, as it does for every other type.

### 2. Two new author controls
- `RefQuestion` gains `invert?: boolean` (yes/no polarity), `unit?: string` (number), `precision?: 'month_year' | 'full_date'` (date types). All live inside the template JSON — no schema change beyond the type above.
- `QuestionsSection.tsx`: an "Answering yes is a concern" toggle on `yes_no` rows, a unit field on `number` rows, and a month-year / full-date choice on the date rows, matching the existing inline row-config pattern.

### 3. `<AnswerRow>` and `<Answer>`
New `src/components/references/AnswerRow.tsx` and `Answer.tsx`.
- `AnswerRow`: `10px 0`, `1px solid #EDE4FF` bottom border except the last. Inline (flex, `gap: 14`) for `rating_1_5`, `recommendation_score`, `would_rehire`, `yes_no`, `single_select`, `date`, `date_range`, `number`, `short_text`; stacked for `long_text`, `multi_select`, `employment_verification`. Label `11px Inter #8B8F9E` from the **snapshot** question, with an `Internal` badge (`eye-off`) when the question is internal.
- `Answer`: one branch per type, exactly as specified —
  - `employment_verification`: two `#F1F0EC` tiles, `TITLE GIVEN` / `DATES GIVEN`, and **nothing else** — no verdict, tick, warning or `match` field anywhere in the renderer or the normaliser.
  - `rating_1_5`: five 18×6 pips + numeral + `of 5` in `#8B8F9E`, tone green ≥4 / amber =3 / red ≤2, plus the self-assessment chip (lilac, amber at gap ≥2) only when the question is `ask_candidate_too` and a candidate score exists.
  - `recommendation_score`: 22px numeral, `/10`, 108×6 proportional bar; green ≥8 / amber ≥6 / red below. No self-assessment chip.
  - `would_rehire`: three tones — green / yellow ("with reservations") / red.
  - `yes_no`: tone from `q.invert`, not the answer.
  - `single_select` purple pill; `multi_select` wrapping neutral pills.
  - `date` / `date_range`: calendar glyph, en dash, optional `· 4 yr 10 mo` duration suffix.
  - `number`: 15px Poppins value + configured unit.
  - `long_text`: plain prose, undecorated, untruncated.
  - Missing answer → `Skipped` in `#8B8F9E`. Nothing lighter than `#8B8F9E` anywhere.
- `section_header` questions render as a divider label, not a row.

### 4. Answer normalisation
New `src/lib/references/answers.ts`. Stored answers are scalars keyed by question id (with `{title, start, end}` for employment verification), so a small resolver walks the **snapshot's question order** and pairs each question with that referee's own value, mapping `start`/`end` to `from`/`to` and carrying `unit` / `duration` from the question. It also accepts the richer object form for forward compatibility. No `match` field is read or produced.

### 5. Wiring
- `RefereeRow.tsx`: the ad-hoc prose list is replaced by the ordered `AnswerRow` list, new props `questions` (snapshot) and `candidateSelf` (the candidate's self-assessment map). `Would rehire` leaves the four-up key-value grid so it isn't rendered twice — the grid keeps Email · Worked together · Status.
- `ReferenceCheckCard.tsx` passes `snapshot.questions` and `request.self_assessment` down; answers stay keyed per referee, so a peer can never show the manager's words.

### 6. Default template
`defaultQuestions()` becomes the 15-question spec order — structured answers first, prose last, `invert: true` on "Any concerns we should know about?", `ask_candidate_too` on the two rating questions that carry it, `internal: true` on the last note. Only new templates are affected; existing ones hydrate unchanged.

## Technical notes
- Files edited: `src/lib/references/templateModel.ts`, `src/components/references/templates/sections/QuestionsSection.tsx`, `src/components/public/QuestionInstrument.tsx`, `src/components/references/RefereeRow.tsx`, `ReferenceCheckCard.tsx`. New: `AnswerRow.tsx`, `Answer.tsx`, `src/lib/references/answers.ts`. One migration (type values only).
- `reference-report`'s client-safe payload already strips internal questions; it keeps working since it filters on the snapshot, and internal answers stay out of the shared report.
- No fixture data ships in the repo, so the fixture-coherence rules apply as review checks on the demo data rather than as code.
