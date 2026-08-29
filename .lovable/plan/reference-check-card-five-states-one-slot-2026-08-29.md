# Reference check card — five states, one slot

One component in the Job overview tab, directly below Scorecards, renders all five states. Existing request/mutation logic stays intact; this adds the live states (3, 4, 5), the shared collapsible shell, and the supporting actions.

## What changes

### 1. State derivation (single source)
Add `resolveCardState(request, stage, referees)` to `src/lib/references/status.ts` returning `empty | suggested | awaiting_candidate | awaiting_referees | answers`, in the exact order given: no request → suggested if the stage collects references else empty; `cancelled` → empty (with note); `expired` → awaiting_candidate (expired variant); `candidate` → awaiting_candidate; `referees` → awaiting_referees; any referee with answers → answers; else awaiting_referees. Every rendering decision reads from this one value.

`stageCollectsReferences` becomes configuration: a `collect_at_stages` list on the reference template (and its frozen snapshot), defaulting to `Final interview` and `Offer`. `stageSuggestsReferences` in `requestCopy.ts` is rewritten to consult that list instead of substring matching, keeping the default when the template has no list.

### 2. Data
New `useReferenceRequestDetail(requestId)` hook loading the request plus its referees, and a `useJobReferenceRequest(candidateId, jobId)` selector picking the newest request for this job from the existing candidate hook. Realtime/invalidations so transitions are immediate with no refresh:
- Sending from the sheet invalidates the candidate request query → card is state 3 straight away.
- Referee/candidate submissions arrive via a Supabase realtime subscription on `reference_requests` and `reference_referees` for the open request (subscribed in `useEffect`, cleaned up with `removeChannel`).

### 3. The card
`ReferenceCheckCard.tsx` becomes the single component for all five states and keeps its current position and props contract, extended with the request + referees.
- States 1 and 2 keep the `ProfileCard` wrapper, no chevron. Subtitle changed to "they're". State 1 appends `Last request cancelled {date} by {name}` after a cancellation.
- States 3–5 use one new shared shell (`RefCardShell`): white card, 1px `#E7E8EE`, radius 12, header row as toggle (32px black glyph tile, title + `RefStatus size="xs"`, track + summary line, `Open` button, rotating chevron), body with top hairline. Collapsible, default open.
- State 3: `EmptyRefereeTrack` (N grey segments = required count, 72px, same geometry as `RefereeTrack`), the four live "what was sent" rows (values recomputed on render — expiry countdown, reminder date), the `#FAFAF7` consent info block, footer `Resend to candidate · Copy link · Log a phone reference` with `Cancel request` pushed right. Expired variant: `Expired {date}` in `#B45309` and a primary `Send a fresh link`. Reminders off → `Reminders off`. No referee list, no skeleton.
- State 4: five-row summary (adding the amber `On hold` row when held referees exist), non-expandable referee rows with avatar, relationship badge, title · company and `RefereeStatus`; held rows amber-tinted with the hold note in quotes. Footer's first action becomes `Remind referees`; a bounced or declined referee promotes primary `Request a replacement` to first position.
- State 5: same shell with real status/track/counts, expandable referee rows revealing answers, per-row actions by status (`Release & send`, `Request a replacement`, `Resend email`, plus `Log by phone instead` and `Open referee link`).

### 4. Actions
- `Resend to candidate` / `Send a fresh link` → existing `send-reference-request` function (already rotates and re-emails).
- `Copy link` → copies the URL minted during this session only (returned by the send call and held in component state); when no session link exists the button is replaced by `Resend to candidate` rather than silently invalidating the emailed token. Copy confirms with a toast.
- `Cancel request` → sets `state = 'cancelled'` and `cancelled_at`; card returns to state 1 with the cancelled note.
- `Remind referees` / `Request a replacement` / `Release & send` → new authed edge function `reference-request-actions` reusing `referenceContext.ts` senders; on-hold referees are never emailed and never counted in the denominator.
- `Log a phone reference` (available in every state) → new `LogPhoneReferenceDialog`: referee name, relationship, title, company, period, then the template's questions rendered as the same instruments the referee sees. Saves a referee row with `source = 'recruiter_logged'`, `status = 'logged'`, answers filled — which moves the card to state 5.

## Technical notes
- Files touched: `src/lib/references/status.ts`, `src/lib/references/requestCopy.ts`, `src/lib/references/templateModel.ts` (add `collect_at_stages`), `src/components/references/ReferenceCheckCard.tsx`, `CandidateReferenceCheckSection.tsx`, `RefereeTrack.tsx` (export the empty variant), plus new `RefCardShell.tsx`, `RefereeRow.tsx`, `LogPhoneReferenceDialog.tsx`, `src/hooks/useReferenceRequests.ts` additions, `supabase/functions/reference-request-actions/index.ts`.
- No schema change needed: `hold_note`, `on_hold`, `answers`, `cancelled_at`, `candidate_link_expires_at`, `requested_by` all exist. Template `collect_at_stages` lives inside the existing template JSON, so no migration.
- Counts, tones and labels continue to come only from `status.ts`; no percentages or fill bars anywhere.
- No client name or requirement string is hardcoded; the state-2 prompt stays lilac with no warning icon and disables nothing.
