## Goal

When a candidate's booking link has expired, the "Copy [name]'s Link" button should clearly indicate that and act as a one-click renew (generate a fresh token + copy), instead of silently looking the same as a valid link.

## Where this lives

`src/components/candidates/GenerateBookingLinkButton.tsx` + the two hooks that back it (`useStageBookingInterviewers.ts`, `useContextualBookingLink.ts`).

Today, clicking Copy already calls `create-booking-token`, which filters `expires_at > now()` — so an expired token is automatically replaced by a new one server-side. The gap is purely UX: the recruiter has no signal that the link they previously sent is dead and the candidate is stuck on the "This link has expired" page.

## Changes

### 1. Detect latest token status (new tiny hook)

Add `src/hooks/useLatestBookingTokenStatus.ts`:

- Inputs: `jobId`, `candidateId`, `associationId`, optional `shortCode` (per interviewer) or `bookingConfigIds` for group.
- Query `booking_link_tokens` for the most recent row matching that context, ordered by `created_at desc limit 1`, selecting `expires_at`, `token`, `short_code`.
- Returns `{ status: 'none' | 'active' | 'expired', expiresAt, lastToken }`.
- Cached via React Query, invalidated after a successful copy (so a fresh renew flips status back to `active`).

### 2. Surface status in `useStageBookingInterviewers`

For each interviewer entry, attach `tokenStatus: 'none' | 'active' | 'expired'` using the hook above (single batched query per stage rather than N hooks: select all latest tokens for (job, candidate, association) in one call and bucket by `short_code`).

For the user fallback path, do the same inside `useContextualBookingLink` so the fallback button can also morph.

### 3. Morph the button in `GenerateBookingLinkButton.tsx`

Visual rules (presentation only, no new functionality):

- **Active or none** (current behavior): `Link2` icon, label "Copy [name]'s Link" / "Copy Your Link" / "Copy Group Booking Link". Unchanged.
- **Expired**: swap icon to `RefreshCw`, label to "Renew [name]'s Link" (or "Renew Your Link" / "Renew Group Link"), and add a subtle warning dot (existing `Badge` dot pattern) + tooltip: "The previous link expired on {date}. Click to generate a fresh link and copy it."
- Click handler is unchanged — it still calls the existing copy path, which generates a new token. After success, invalidate the latest-token query so the button flips back to "Copy".
- Dropdown variant (multi-interviewer): each item shows "Renew {name}'s Link" with the refresh icon when that interviewer's latest token is expired; others stay as "Copy {name}'s Link".
- Loading state and disabled states unchanged.

### 4. No backend changes

`create-booking-token` and `create-group-booking-token` already skip expired tokens via `gt('expires_at', now())` and insert a fresh row, so renew is the same code path as initial create. No edge-function or schema work.

## Technical notes

- The new query reads `booking_link_tokens` with `job_id`, `candidate_id`, `association_id` scoping — confirm RLS already allows tenant members to select their own org's tokens (it does today for the booking flows that read tokens client-side; otherwise, fall back to a tiny SECURITY DEFINER RPC `latest_booking_token_status(job_id, candidate_id, association_id)`).
- Time check is client-side comparison against `expires_at`.
- Strings, icons, and tooltip copy go through existing patterns (no new design tokens).
- No changes to the public booking expired view in this pass — out of scope unless you want it.

## Out of scope

- Auto-emailing the candidate the renewed link.
- Changing token TTL.
- Updating the public "This link has expired" page (can be a follow-up if you want a self-serve "Request a new link" CTA).
