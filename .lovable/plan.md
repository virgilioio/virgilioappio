## Goal
Give Ask Gio visibility into the **work history** (current + past employers) of every candidate attached to this job, so it can answer questions like "who's worked at Stripe?", "which candidates come from FAANG?", or "what companies has {name} been at?".

## What's missing today
`supabase/functions/job-ask-gio/index.ts` selects candidate identity/comp/skills/contact fields, but never touches `candidate_work_experience`. As a result Gio has no employer history beyond the single `company_current` string on the candidate row.

## Plan (job-ask-gio only, no schema changes)

1. **Fetch work experience for every candidate on the job**
   - After the candidates chunked fetch (~line 180), add a chunked query on `candidate_work_experience` filtered by `candidate_id IN (candIds)`.
   - Select: `candidate_id, company_name, job_title, standardized_title, company_industry, company_size_category, is_current, start_date, end_date, duration_months, location`.
   - Chunk in 200s like the candidates fetch. Order desc by `is_current`, then `end_date NULLS FIRST`, then `start_date` desc so the most recent stints come first.
   - Build `workByCandidate: Map<candidateId, WorkRow[]>`, cap at ~6 entries per candidate to protect the char budget.
   - Verify field names against `candidate_work_experience` schema before finalising the select; drop any that don't exist.

2. **Render a compact per-candidate work sub-line**
   - Under each candidate in `CANDIDATES · active`, `CANDIDATES · rejected`, and (if we render them) hired/offered rows, append at most one bullet:
     ```
       ↳ work: {Role @ Company} (current) · {Role @ Company} (2022–2024) · {Company} (2019–2022) · +N more
     ```
   - Use `Mon YYYY` short dates from `start_date`/`end_date`, mark current with `(current)`.
   - Cap the rendered stints per candidate to 4 with `+N more` overflow.
   - Skip the whole bullet if the candidate has no rows.

3. **Add an EMPLOYERS aggregate section**
   - Tally normalized company names (case-insensitive, trimmed) across **all candidates on the job** (applicants, active, rejected, hired).
   - Emit a section like:
     ```
     EMPLOYERS · candidates from (top 20)
       Google — 4 (2 current)
       Stripe — 3 (1 current)
       ...
     ```
   - Sort desc by total count; include a `(N current)` suffix when any are current employers.
   - This gives Gio a direct answer to "who's worked at X?" style questions without scanning every candidate line.

4. **Update the system prompt**
   - Extend the section list to include `EMPLOYERS` and describe the `↳ work:` sub-lines.
   - Add rule: employer history comes ONLY from these lines/sections; if a candidate has no `↳ work:` bullet, say "no work history on file".
   - Add example prompts Gio should now handle: "Which candidates have worked at Google?", "Who's currently at a FAANG?", "What are {candidate}'s past employers?".

5. **Budget safety**
   - Work sub-lines add ~120–200 chars per active candidate; with 60 active + 30 rejected cap that's ~18KB worst case. Keep `MAX_CONTEXT_CHARS = 16000` and rely on the existing truncate marker, BUT reduce per-candidate stint cap to 3 if we observe the section is being cut. Truncation logic is already in place — no new machinery needed.

## Non-goals
- No schema changes; only reads from existing `candidate_work_experience`.
- No UI changes.
- No changes to Gio's Read / job briefing pipeline — this plan is scoped to Ask Gio.
- No employer normalization beyond trim + case-fold for the aggregate tally (we're not touching the `useTalentOriginsData` suffix-stripping logic — keep this simple and additive).

## Technical notes
- `candidate_work_experience` is tenant-scoped through its `candidate_id` FK + RLS; the function already runs with the caller's JWT, so no new grants needed.
- Confirm column names (`duration_months`, `standardized_title`, `company_industry`, `company_size_category`, `location`) exist on the table before finalising the select in build mode.
