## Goal
Make the **Ask Gio** box on the Job Dashboard actually see the full candidate picture — salary expectations, locations, source detail, scorecard ratings/notes, and the rest of the fields we already store — so it can answer questions like "who wants > $180k?" or "what did interviewers say about X?".

## What Gio sees today (confirmed in `supabase/functions/job-ask-gio/index.ts`)
- Candidate `select` on line ~140 pulls only: `id, candidate_name, current_job_title, company_current, role_current, location_city, location_state, location_country, source, created_at`.
- No salary fields, no LinkedIn/phone/email, no years of experience, no skills, no work authorization, no notes.
- **No scorecard data at all** — `job_stage_scorecards` and `scorecard_question_responses` are never queried.
- Active/rejected candidate lines print stage · name · role@co · loc · src · days — nothing about comp, ratings, or notes.

## Plan

1. **Widen the candidate select** in `job-ask-gio` to include the fields we already store and that Gio should reason about:
   - Comp: `salary_amount`, `salary_currency`, `salary_period`.
   - Identity/contact: `email`, `phone`, `linkedin_url`.
   - Profile: `years_experience`, `standardized_skills` (fallback to `skills`), `work_authorization`, `open_to` / `location` preference field if present, `headline`, `summary` (short excerpt), `job_board_source`.
   - Keep existing location/role/company/source columns.
   - Verify column names against `candidates` (58 cols) before the query and drop any that don't exist so PostgREST doesn't 400.

2. **Add a compact per-candidate profile line** in the CANDIDATES · active and CANDIDATES · rejected sections. New format:
   ```
   {stage} · {name} · {role @ company} · {loc} · comp={$185k/yr} · exp={5y} · src={LinkedIn} · skills={a, b, c} · {Nd in stage}
   ```
   Use `formatSalaryExpectation`-style formatting inline (same k/yr suffix logic) so numeric comp stays readable. Skip empty parts.

3. **Fetch scorecards for this job** and attach them to candidates:
   - Query `job_stage_scorecards` filtered by `job_id = jobId`, limit ~200 most recent, selecting `id, candidate_id, stage_id, overall_rating, submitted_at, ai_draft, notes_summary` (whichever text/rating fields exist; check schema for `overall_rating`, `overview`, `strengths`, `concerns`).
   - Also pull `scorecard_question_responses` for those scorecard ids — question text + rating/answer, short-truncated.
   - Build a `scorecardsByCandidate: Map<candidateId, Scorecard[]>`.
   - Under each candidate in the active/rejected list, when they have scorecards, append a bullet:
     ```
       ↳ scorecard {stage} · rating={4/5} · {submitted 3d ago} · "{short overview or top note, ≤160c}"
     ```
   - Cap to the 2 most recent per candidate to protect the char budget.

4. **Add a dedicated PIPELINE section for compensation & location**
   - "COMPENSATION ASKS" block: list active candidates with a non-null `salary_amount`, sorted desc, formatted with currency/period. Include min/median/max summary line.
   - "LOCATIONS" block: aggregate active-candidate locations (city, country) with counts, so questions about geography have a direct answer.

5. **Bump context budget carefully**
   - Raise `MAX_CONTEXT_CHARS` from 12000 → 16000 to absorb scorecards and comp block. Keep the truncate-with-marker safety.
   - Keep `CONTEXT_ACTIVE_LIMIT` at 60 and `CONTEXT_REJECTED_LIMIT` at 30 — scorecard bullets are the main new cost.

6. **Update the system prompt** in the same file to:
   - Explicitly enumerate the new fields Gio can cite: salary expectations, locations, scorecards (rating + note), skills, experience, work auth, source.
   - Keep anti-hallucination rule: only cite values that appear in the context block; if a field is missing for a candidate, say "not on file" rather than inventing.
   - Add examples for salary/location/scorecard questions in the guidance ("Who's asking > $X?", "Who's in {city}?", "How did interviewers rate {name}?").

7. **Validate against the current job** (`c24a2a31-…-b2b5ff86596d`)
   - Run the function and confirm the returned context now contains COMPENSATION ASKS lines (candidates in that job do have salary data), scorecard bullets where scorecards exist, and expanded per-candidate lines.
   - Sanity-check total context length stays under the new cap.

## Non-goals
- No schema changes; only reading columns that already exist on `candidates`, `job_stage_scorecards`, and `scorecard_question_responses`.
- Not touching **Gio's read** briefing pipeline — that already got its own richer snapshot in the previous turn. This plan targets **Ask Gio** only.
- No UI changes to `JobBriefingTab.tsx`.

## Technical notes
- All fields queried are already tenant-scoped via RLS on `candidates` / `job_candidate_associations` / `job_stage_scorecards`; the function already runs with the caller's JWT, so no new grants are needed.
- Before adding a column to the `candidates` select, confirm it exists in `src/integrations/supabase/types.ts` (the schema source of truth) — column list will be verified in build mode before the query is finalized.
- Scorecard schema will be re-read in build mode to pick the exact text/rating column names (`overall_rating` vs `rating`, `overview` vs `summary`) before finalizing the select.
