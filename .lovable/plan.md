# Add Copy Booking Link to Current Stage Card

## Goal
Place the existing contextual `GenerateBookingLinkButton` to the **left of the Schedule/Reschedule button** in the "Current stage · [Stage]" card on the candidate profile (Job tab). Reuse the existing job+stage+candidate+interviewer booking-link logic — no new logic.

## Analysis (is anything else needed?)

The booking-link infrastructure already exists and works end-to-end:
- `GenerateBookingLinkButton` (src/components/candidates/GenerateBookingLinkButton.tsx) handles all cases: no config → setup CTA, single interviewer, multiple interviewers (dropdown), AND/group mode, and fallback to user's own link.
- It uses `useStageBookingInterviewers` + `useContextualBookingLink` + short-token generation via `bookingLinkUtils`.
- It only needs these props: `jobId`, `candidateId`, `jhsId`, `associationId`, plus optional `candidateName`, `candidateEmail`, `jobTitle`, `stageName` for prefill.

`CurrentStageCard` currently only receives `jhsId`, `candidateId`, `stageName`. The parent `CandidateProfileSheet` already has `jobId`, `associationId`, `candidate` (name/email), and the job title in scope at the render site — so we just need to thread them through as props.

**Nothing else is required.** No new hooks, no backend changes, no edge functions.

## Changes

### 1. `src/components/candidates/profile/CurrentStageCard.tsx`
- Extend `CurrentStageCardProps` with: `jobId: string`, `associationId: string`, `candidateName?: string`, `candidateEmail?: string`, `jobTitle?: string`.
- Render `<GenerateBookingLinkButton>` immediately before (left of) the Schedule/Reschedule `<Button>` in the header's right cluster.
  - Wrap both in a `flex items-center gap-2 shrink-0` container.
  - Show the booking-link button **only when** `isInterviewStage` is true (same condition as Schedule).
  - Props: `variant="secondary"`, `size="sm"` (to visually pair with the Schedule button while staying secondary), `showLabel={true}`, plus the IDs/context passed from the parent.

### 2. `src/components/candidates/CandidateProfileSheet.tsx`
- At the `<CurrentStageCard ... />` call site (~line 1225), pass the new props from existing in-scope values:
  - `jobId={jobId}`
  - `associationId={associationId}`
  - `candidateName={candidate?.first_name + ' ' + candidate?.last_name}` (whatever helper the file already uses)
  - `candidateEmail={candidate?.email}`
  - `jobTitle={...}` if a job title variable is already available; otherwise omit (it's optional).

## Out of scope
- No changes to `GenerateBookingLinkButton` itself.
- No changes to booking link logic, edge functions, or hooks.
- No visual redesign of the Schedule button — only adds a sibling button to its left.
