## Goal

Rebuild the Scorecard sheet to match the spec — new chrome, public/private chip, Gio "Points to validate" suggestion inbox, redesigned overall-rating pills, interview questions card (salary smart-field + open + added-from-Gio), and a Key takeaways editor with Polish-notes AI — while keeping every existing supporting feature (AI Suggested Rating banner, Recommended Next Steps, status/offer/hired banners, Rejection Details, Onboarding tab, Hire Summary, draft persistence, delete dialog).

## Schema changes (one migration)

`validation_point_resolutions` is reused for the new inbox; decisions stay scoped to the individual candidate's scorecard (the table already has `scorecard_id` + `association_id`).

- Extend the allowed `status` set via the existing validation trigger (or a new one if none): `validated | flagged | added | dismissed`. Old rows keep their meaning; the new UI treats `validated`/`flagged` as **`added`** (so prior work isn't lost) and surfaces remaining suggestions as `pending`.
- Add `public.scorecards.gio_added_questions jsonb default '[]'::jsonb` — an array of `{ id: uuid, source_point_index: int, question: text, answer: text }`. This is the canonical store for ad-hoc "Added from Gio" questions and their answers on a single scorecard. Drafts use the same shape in localStorage, so submit is a 1-to-1 write.
  - Rationale (you let me pick): keeps stage config clean, avoids polluting `scorecard_interview_questions` (which is stage-level), drafts round-trip cleanly, and the JSON is trivially queryable for reporting.

No new tables. No new RLS policies needed; both targets already have RLS scoped to the actor.

## Hook layer

- Rework `useValidationPointResolutions` to expose a Map-shaped API (`resolutions: Map<index, row>`) plus typed helpers `addPoint(index, question)`, `dismissPoint(index, question)`, `undoDecision(index)`. The current code already calls `resolutions.has(i)` — that's the source of the live runtime error and gets fixed here.
- New `useScorecardGioSuggestions(candidateId, jobId, associationId, scorecardId)` — a thin selector that joins `useCandidateFitInsights` validation points with `validation_point_resolutions` rows for this association, returning `{ pending, added, dismissed }` partitions.
- New `useGioAddedQuestions(scorecardId)` — load + mutate `scorecards.gio_added_questions`. Also exposes a draft-merge helper used while the scorecard is unsaved.
- New edge function `polish-scorecard-notes` (Lovable AI Gateway, `google/gemini-3-flash-preview`) — input `{ html, candidate_name, stage_name }`, returns cleaned HTML preserving lists/links. Surface `402` / `429` per the gateway guidance.

## Sheet structure (single component refactor of `ScorecardSheet.tsx`)

Keep the file's outer state, persistence, draft logic, and all existing banners/tabs. Replace the body markup so the right pane renders four ordered cards. Left pane unchanged (Resume / Application / Interview details soon).

### Chrome

- Header: purple eyebrow `SCORECARD`, title with lilac period, draft-saved chip (existing), **new Public/Private toggle chip** writing to `scorecards.visibility` (column already supported via `scorecardVisibility` prop). Existing "Next Steps", "Edit scorecard", delete affordances stay on the right.
- Footer: existing left muted helper text + cancel/submit; primary becomes "Submit scorecard" with `check` icon, semantics unchanged.

### Right pane order (top to bottom)

1. **Points to validate** (replaces inline `ScorecardValidationPoints` only inside this sheet — the standalone component remains available elsewhere). Lilac sparkles tile + question + rationale + priority badge + target-stage chip; row actions `Dismiss` / `Add to scorecard`. Header action: lilac `{n} from Gio` → green `All reviewed` when `pending = 0`. Collapsible.
2. **Existing AI Suggested Rating banner** — unchanged, just visually slotted under Points-to-validate when present (keeps current behaviour).
3. **Overall rating** — new 4-pill outline grid with the spec's fills. Wired to the same `rating` state; clicking a selected pill clears.
4. **Interview questions** — salary smart-field first (existing salary writeback logic preserved), then configured questions, then the dynamic "Added from Gio" blocks (lilac `Added from Gio` badge, removable, `FTextarea` answer). Removing reverts the decision to `dismissed`.
5. **Key takeaways** — existing notes editor wrapped to match the spec's bordered toolbar look; header action: ghost purple **Polish notes** (calls the new edge function, replaces content on accept).

### Suggestion → question pipeline

- Click **Add to scorecard** on a pending point → optimistic: insert a `validation_point_resolutions` row with `status='added'` + append a `gio_added_questions` entry on the (draft) scorecard. The point row leaves the inbox and the new answerable block appears in Interview questions.
- Click `Dismiss` → `status='dismissed'`; brief 5s "Undo" toast.
- Remove an "Added from Gio" block in Interview questions → set `status='dismissed'` and drop the matching `gio_added_questions` entry.
- On submit: existing flow persists the scorecard; the JSON column already carries the Q/A. On reload, both the inbox state and the added blocks rehydrate.

### What stays untouched

- AI Suggested Rating banner + analysis disclosure.
- RecommendedNextStepsDialog, Edit/Delete affordances, status/offer/hired banners, Rejection Details + Onboarding tabs, Hire Summary + Time-to-Hire cards.
- Draft persistence keys, salary writeback on submit, scorecard visibility plumbing.
- Application tab + résumé viewer in the left pane (Interview details still shows the soft-stage card we shipped last turn).

## Files touched

- `supabase/migrations/<new>.sql` — extend resolution statuses + add `scorecards.gio_added_questions`.
- `src/hooks/useValidationPointResolutions.ts` — Map API + add/dismiss/undo helpers + fix runtime crash.
- `src/hooks/useScorecardGioSuggestions.ts` — new selector.
- `src/hooks/useGioAddedQuestions.ts` — new load/save hook.
- `supabase/functions/polish-scorecard-notes/index.ts` — new edge function (Lovable AI Gateway).
- `src/components/candidates/scorecard/GioPointsInbox.tsx` — new card component.
- `src/components/candidates/scorecard/OverallRatingPills.tsx` — new card component.
- `src/components/candidates/scorecard/AddedFromGioBlock.tsx` — new sub-component for an added Q.
- `src/components/candidates/scorecard/PolishNotesButton.tsx` — new ghost-purple action.
- `src/components/candidates/ScorecardSheet.tsx` — chrome (eyebrow, lilac period, public/private chip), right-pane composition, salary card restyle to green-tinted sub-card.
- `src/components/candidates/ScorecardValidationPoints.tsx` — keep as-is for other consumers (Candidate Insights tab) so we don't regress; only the in-sheet usage is replaced.

## Out of scope

- Multi-panelist visibility rules beyond the existing `scorecardVisibility` toggle.
- Editing/curating Gio's suggestions (we render what `useCandidateFitInsights` returns).
- Polishing notes for languages beyond what the model handles natively.
- The Interview details tab (handled in the previous turn).

## Risks / clarifications

1. **Inbox scope is per-scorecard, not per-stage** (as you confirmed). That means if two panelists open scorecards for the same candidate-stage, each has an independent inbox. Confirming this is desired (otherwise we'd key decisions by `association_id + stage` and share them across panelists).
2. **Polish notes** rewrites the editor content in place. Default behaviour: a single Undo via the editor's history. OK?
3. **Old data**: pre-existing `validated`/`flagged` rows are treated as `added` so reviewers see them as already-added blocks in Interview questions — with the original question text but no answer yet (they can fill or remove). If you'd rather hide legacy rows entirely, say so and I'll filter them out instead.