

# Add "Send Offer" Button After Offer PDF Is Generated

## Overview
Add a ghost "Send Offer" button in the offer details header (same row as status badge) that becomes visible only after an offer letter PDF has been generated and saved as an attachment. Clicking it opens the minimizable email composer pre-populated with the candidate's email and the offer PDF attached.

## How to Detect a Generated Offer
Query `candidate_attachments` for files matching the naming pattern `Offer Letter - *.pdf` for this candidate. If at least one such attachment exists, show the "Send Offer" button.

## Changes

### 1. `src/components/candidates/CandidateOfferDetails.tsx`
- Add state: `hasOfferDocument` (boolean), `showEmailComposer` (boolean)
- Add a `useEffect` that queries `candidate_attachments` for this candidate where `file_name ILIKE 'Offer Letter%'` and `file_type = 'application/pdf'`. Set `hasOfferDocument = true` if results exist. Also listen for the `refetch-attachments` custom event to re-check.
- Add a ghost "Send Offer" button (with `Send` icon) in the header actions row, visible when `offerLetter.status === 'approved' && hasOfferDocument`. Place it after the "Generate Offer Letter" button.
- Clicking it opens the `MinimizableEmailComposer` with `defaultTo` set to the candidate's email.
- Import `MinimizableEmailComposer` and render it at the bottom of the component.

### 2. No other files need changes
The `MinimizableEmailComposer` and `EmailComposer` already support `defaultTo`, `candidateId`, `jobId`, and attachments — the user can manually attach the offer PDF from within the composer, or we can pre-populate the subject with "Offer Letter" context.

## UI Placement
The button sits in the same `flex items-center gap-2` row as Edit, Generate Offer Letter, Request Approval, Recall, and the status Badge — matching the ghost variant and sm size pattern.

