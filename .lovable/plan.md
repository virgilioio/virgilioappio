# Job openings Part B: offers and hiring

## Goal
Connect every offer and hire to a real job opening, so Req IDs are reserved during the offer process, filled atomically when hired, and visible in offer details and the hired banner.

## What will change

### Create offer
- Add a required Req ID selector to the existing Create/Edit Offer experience.
- List every opening on the job with target hire/start dates and its live state: Open, This offer, another candidate's offer, or Filled.
- Default new offers to the earliest available opening; editing an offer keeps its current opening selected.
- Filled openings cannot be selected. If none are available, explain that another opening must be added in Job setup and block saving.
- Default the offer's start-date field from the selected opening when the user has not already edited that date.
- Save `opening_id` with the offer so draft/active offers reserve that opening immediately.
- Preserve the selected Req ID in the local offer draft and include it when an existing offer is edited.

### Offer details
- Show Req ID immediately after the job title, including its position among the job's openings.
- Refresh opening state after an offer is created or changed.

### Mark hired
- Replace both immediate Mark hired actions with one confirmation dialog.
- Show every unfilled opening as a radio choice, preselecting the offer's opening.
- Show the accepted-offer start date by default, with the selected opening's target start date as context and fallback.
- Explain which opening will be filled and which openings remain.
- When this is the last opening, offer to close the job and enable that choice by default.
- Confirm through one database operation that fills the opening, links the candidate and offer to it, records hire/start dates and actor, optionally closes the job, and records `Hired · filled {REQ}` activity.
- Reject stale selections cleanly if another user filled the opening first.

### Hired state
- Show the linked Req ID in the information line below “Candidate is hired — start date …”.
- Keep the existing job title, compensation, signed date, and onboarding information.
- Returning a hire to Offer will release the filled state safely while preserving the offer's reservation.

## Technical details
- Add a hire start-date field to `job_candidate_associations` and a security-definer `mark_hired` function with explicit authorization and race-condition checks.
- Keep opening status derived from `job_openings_with_status`; no status column will be added.
- Update offer types and queries to carry `opening_id`, and extend opening rows with the reserving candidate where needed.
- Use the existing Gio form, dropdown, badge, button, dialog, and date-picker patterns; no unrelated redesign.

## Verification
- Run focused tests for default opening selection, start-date behavior, offer reservation, last-opening close behavior, stale-opening rejection, and unhire release.
- Run the database linter and verify the current build log is clean.
- Inspect the public preview where possible; authenticated end-to-end interaction remains unavailable for this external Supabase project, so final internal screen confirmation will require your signed-in preview.
