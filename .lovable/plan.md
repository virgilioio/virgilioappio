

# Make Edit Button Always Visible (Except When Hired) + Activity Logging for Offer Edits

## Changes

### 1. `src/components/candidates/CandidateOfferDetails.tsx`
- **Add `associationStatus` prop** to the component interface (type: `string | null`)
- **Change Edit button condition** from `(offerLetter.status === 'draft' || offerLetter.status === 'pending_approval')` to `associationStatus !== 'hired'` — making it visible for all offer statuses except when the candidate is hired
- No other logic changes needed; the existing approval restart mechanism in `OfferComposerBody` already handles recalling approvals when restart-triggering fields are modified

### 2. `src/components/candidates/CandidateProfileSheet.tsx`
- **Pass `associationStatus`** to `CandidateOfferDetails`: add `associationStatus={associationStatus}` on line 1541

### 3. `src/components/candidates/OfferComposerBody.tsx`
- **Add activity logging** on offer save (both create and update):
  - Import `logActivity` from `@/lib/activityLogger`
  - After successful `updateOfferLetter`, call `logActivity` with type `'offer_updated'`, title like `"Offer updated for [candidateName]"`, and metadata including `candidateId`, `jobId`, and changed field names
  - After successful `createOfferLetter`, call `logActivity` with type `'offer_created'`, title like `"Offer created for [candidateName]"`, and metadata including `candidateId`, `jobId`
  - Both calls use `entityType: 'candidate'` and `entityId: candidateId` so they appear in the candidate activity feed

