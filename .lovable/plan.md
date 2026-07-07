# Enrich "Draft with Gio" context

## Current behavior

`supabase/functions/chat-ai-draft/index.ts` grounds drafts on a thin slice of context:

- Candidate first name
- Job title, department, location, work_mode, employment_type
- Thread `context_summary`
- Last 20 candidate-visible messages

It does **not** include the job description, requirements, hiring pipeline stages, or the candidate's current stage. So when a recruiter asks "propose next steps" or "explain the process", Gio has no grounding beyond the role's title and the recent chat, and the SYSTEM prompt forbids inventing details — meaning it often falls back to generic phrasing or "Not enough context".

## Goal

Give the draft LLM the same job/stage grounding a recruiter would have open in the sidebar, so drafts can accurately reference:

- What the role actually involves (description, key requirements)
- Where the candidate is in the process right now
- What the next stage typically is

Recruiter voice, tone rules, and the "never invent facts" guardrail stay unchanged.

## Changes (backend only, single file)

Edit `supabase/functions/chat-ai-draft/index.ts`:

1. **Widen the job fetch** to also select:
   - `description` (or the job's stored description/summary field — verify the exact column when implementing)
   - Any structured requirements/skills field already present on `jobs`
2. **Fetch pipeline stages** for the job from `job_hiring_stages` (name + position, ordered).
3. **Fetch the candidate's current stage** from `job_candidate_associations` for `(job_id, candidate_id)` — current stage id/name, plus derive "next stage" from the ordered stage list.
4. **Extend the `ctxLines` block** with a compact, bounded context section:
   - `Role summary:` — job description trimmed to a hard cap (~1500 chars) to protect tokens.
   - `Key requirements:` — short bullet list if a structured field exists; otherwise omitted.
   - `Hiring stages:` — `1. Applied → 2. Screen → 3. …` on one line.
   - `Candidate is currently at:` — stage name.
   - `Next stage:` — derived from stage order, if any.
5. **Do all new reads in parallel** with the existing `Promise.all`, using `sbAdmin` (RLS already enforced by the thread read up top).
6. **No changes** to: SYSTEM prompt, tone hints, token-cap logic, model selection, audit log shape, response shape, or the frontend `DraftWithGioPopover`.

## Technical notes

- Token budget: cap description at ~1500 chars and stages list at whatever fits on one line; the draft model is small and we already reserve `CHAT_TOKEN_CAPS.draft`.
- Missing data must degrade silently — if a job has no description or the candidate has no association row, just omit those lines (don't emit "unknown").
- Exact column names on `jobs`, `job_hiring_stages`, and `job_candidate_associations` will be confirmed against the schema at implementation time; the shape above is the intent.

## Out of scope

- Frontend UI (`DraftWithGioPopover.tsx`) — no changes.
- Other AI functions (`chat-with-gio`, `generate-next-steps`, etc.).
- Token cap or model changes.
- DB migrations.
