# Ask Gio on the Job Dashboard — sticky composer + real job context

Two problems to solve, both in the existing Ask box on `src/components/jobs/JobBriefingTab.tsx` and its backend `supabase/functions/job-ask-gio/index.ts`. No agentic tools, no new features — just make the assistant actually know the job.

## 1. Why answers are thin today (verified)

`supabase/functions/job-ask-gio/index.ts` builds a context block from three reads, and two of them are silently returning nothing:

- It queries **`candidate_job_associations`** — that table does not exist in this schema; the real one is **`job_candidate_associations`**. Every application read is dropped with an RLS/404, so `Total applications`, `Status breakdown`, and per-stage counts are all `0` / `none`.
- It joins stages via **`job_stages(name, is_required)`** — the per-job stage list actually lives in **`job_hiring_stages`** (joined to `job_stages.stage_name` + `custom_stage_name`). So stage names come back empty too.
- Even if those worked, the context is only a static job row + counts. There are no candidate names, no timestamps, no activity, no rejection reasons, no email/interview signals — so a question like "what changed in the last 7 days" or "quick pipeline report including rejected candidates" has literally nothing to answer from.

So step one is a bug fix; step two is broadening what we send.

## 2. Backend — richer, correct job context

Rewrite the context builder in `supabase/functions/job-ask-gio/index.ts`. Keep the same request/response contract (`{ jobId, jobTitle?, question, history }` → `{ answer }`), same model, same gateway wiring, same 429/402 handling. Only the SQL and the assembled `contextBlock` change.

All reads stay on the caller's JWT-scoped client (RLS enforced).

Gather, in parallel:

1. **Job row** — same fields as today plus `description` (trimmed to ~800 chars), `hiring_manager_id`, `recruiter_id`, `created_at`, `target_fill_date`.
2. **Stages** — from `job_hiring_stages` joined to `job_stages`, ordered by `position`:
   `id, position, custom_stage_name, is_required, job_stages.stage_name, job_stages.stage_type`.
3. **Applications** — from `job_candidate_associations` for this `job_id`, up to 500 rows:
   `id, candidate_id, current_stage_id, status, created_at, entered_stage_at, rejected_at, offered_at, hired_at, rejection_reason_id, source`.
4. **Candidates** for those ids (chunked `.in()` if needed) — `id, first_name, last_name, current_job_title, current_company, location, source, created_at`.
5. **Rejection reasons** — `rejection_reasons` filtered to the ids referenced, for label lookup.
6. **Recent activity (last 14 days)** — `activities` filtered to `entity_type='job'` and `entity_id=jobId` **plus** `entity_type='candidate'` with `entity_id in (candidate_ids)` scoped to this job (fallback: filter by `created_at >= now()-14d` and cap at 100), select `activity_type, title, description, created_at`.
7. **Recent stage moves (last 14 days)** — `stage_events` for these associations if the row is present; skip silently if RLS blocks.
8. **Emails (last 14 days summary)** — `email_logs` count grouped by direction/status for these candidates, capped simply (aggregate in code).

From those, assemble a compact plaintext context block, in this order:

```
JOB
  Title · Department · Location (mode) · Status · Level · Employment · Salary · Experience · Skills · Target fill · Created · Days open

STAGES (name · required · in_stage)
  1. Applied — 42
  2. Screen — 8 (required)
  ...

PIPELINE
  Active: N · Rejected: M · Offered: X · Hired: Y
  Median days-to-reject: … · Median days-in-stage top-3: …

TOP REJECTION REASONS
  reason label — count
  ...

RECENT 7d
  <YYYY-MM-DD> stage move: <Candidate> Applied → Screen
  <YYYY-MM-DD> rejected: <Candidate> (reason)
  <YYYY-MM-DD> hired: <Candidate>
  <YYYY-MM-DD> note/activity: <title>
  ... (cap 40 lines, newest first)

CANDIDATES (active, up to 60, grouped by stage)
  Stage — Candidate Name · title @ company · loc · source · <days in stage>d
  ...

CANDIDATES (rejected, up to 30, most recent first)
  Candidate Name · stage at rejection · reason · <days ago>d

JOB DESCRIPTION (excerpt)
  <first ~800 chars>
```

Rules for the assembly:
- Names come only from `candidates` rows we actually loaded — never invented.
- Truncate long strings; hard cap the whole context around ~12k chars so the model stays fast and cheap.
- Bucket "Recent 7d" and "Recent 14d" separately so the model can answer "last 7 days" precisely.
- If a section has no rows, omit it entirely (don't emit "none").

System prompt stays terse; add: "You have structured JOB, STAGES, PIPELINE, RECENT, CANDIDATES sections. When the user asks about a time window, filter the RECENT entries by date. When asked for a report, group by stage and include rejected candidates from the CANDIDATES(rejected) block. Cite counts and names from the context only; never invent."

## 3. Frontend — sticky composer, scrollable transcript

In `src/components/jobs/JobBriefingTab.tsx`, restructure the Ask box so the composer stays pinned to the bottom of the tab and the conversation scrolls above it. No wiring or state changes — same `chat`, `ask`, `pending`, `submitAsk`, `insertPrompt`.

- Wrap the Ask box (currently `<div ref={askBoxRef} style={{ marginTop: 34 }}>` starting ~line 871) in a two-part flex container that lives inside the tab's existing scroll region.
- Layout, top → bottom:
  1. Conversation panel (the existing `{chat.length > 0 || pending}` block moved above the composer) with `flex: 1; overflow-y: auto; min-height: 0` and an internal ref used to `scrollTop = scrollHeight` after each new message.
  2. Sticky composer group = the form + suggestion chip row, wrapped in a container with `position: sticky; bottom: 0; background: linear-gradient(to top, #FFFCF9 70%, rgba(255,252,249,0)); padding-top: 10px`.
- Suggestion chips stay directly under the input (same row today). Keep the "Clear" affordance on the chip row.
- Empty state (no messages yet) keeps today's look: chips visible, composer at bottom, no transcript panel rendered.
- Auto-scroll to bottom on: new user message, new assistant reply, `pending` toggling on. Use a small `useEffect` on `[chat.length, pending]`.
- Keep every existing style token (radius, colors, Poppins/Inter sizes) — this is layout only.

## 4. Out of scope

- No streaming (v1 stays non-streaming; the "thinking" bubble already covers wait).
- No tool-calling / agent loop.
- No new tables, no schema change, no new secrets.
- No changes to `generate-job-briefing`, the feature cards above, or any other tab.

## Technical notes

- Table name fix (`candidate_job_associations` → `job_candidate_associations`) is the single highest-impact change; everything else builds on that.
- Cap each read (`.limit(500)` for applications, `.limit(100)` for activities) to keep the function well under Edge Function timeouts.
- Chunk the `candidates` `.in()` query at 200 ids like `useCandidateJobAssociationsMap` already does.
- Skip a section on RLS/error instead of failing the whole request; log to `console.warn` server-side.
- Sticky positioning works because `JobBriefingTab`'s wrapper already scrolls; if it doesn't in this branch, add `overflow-y:auto; min-height:0` to the tab root only (no other layout side effects).
