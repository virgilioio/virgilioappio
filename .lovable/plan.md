

# Approver Actions in Offer Details Tab

## Changes

### 1. Query update (`useOfferApprovalRequest.ts`)
Expand status filter to `.in('status', ['pending', 'approved', 'declined'])` so declined requests are also fetched for banner display. Add a derived `isActiveRequest` boolean (status is `pending` or `approved`) to control "Request Approval" button visibility separately.

### 2. Approve/Decline buttons in `CandidateOfferDetails.tsx`
When `isCurrentUserActiveApprover` is true and offer is `pending_approval`, show **Approve** and **Decline** buttons in the card header. Clicking either opens an inline section with an optional comments textarea and confirm button.

### 3. Make decline comments optional (`CandidateOfferApprovals.tsx`)
Remove the `!declineNotes.trim()` disabled guard from the Confirm Decline button so comments are optional for both actions.

### 4. Status banners in `CandidateProfileSheet.tsx`
Above the Offer subtabs, render a contextual banner:
- **Approved**: Virgilio purple theme (`bg-virgilio-purple/10 border-virgilio-purple/20 text-virgilio-purple`) -- "This offer has been approved"
- **Declined**: Red/destructive theme (`bg-destructive/10 border-destructive/20 text-destructive`) -- "This offer has been declined" with optional reason

### Files Modified
- `src/hooks/useOfferApprovalRequest.ts`
- `src/components/candidates/CandidateOfferDetails.tsx`
- `src/components/candidates/CandidateOfferApprovals.tsx`
- `src/components/candidates/CandidateProfileSheet.tsx`

No database changes needed -- `notes` column already exists on `offer_approval_request_steps`.

