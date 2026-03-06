

# Record All Offer Movements in the Activity Feed

## Current State

Only **2 out of 7+** offer lifecycle events are logged:
- `offer_created` — logged in `OfferComposerBody.tsx`
- `offer_updated` — logged in `OfferComposerBody.tsx`

**Missing events:**
1. Approval requested
2. Approval approved (per step + final)
3. Approval declined
4. Approval recalled
5. Offer document generated
6. Offer sent

## Changes

### 1. Database migration — Add missing enum values to `activity_type`

Add: `approval_requested`, `approval_approved`, `approval_declined`, `approval_recalled`, `offer_document_generated`, `offer_sent`

### 2. `src/hooks/useOfferApprovalRequest.ts` — Log approval lifecycle events

Add `logActivity` calls in each mutation's `onSuccess`:

| Mutation | Activity Type | Title Example |
|----------|--------------|---------------|
| `requestApprovalMutation` | `approval_requested` | "Approval requested" |
| `approveStepMutation` | `approval_approved` | "Approval step approved" (include step order, approver name, notes in metadata) |
| `declineStepMutation` | `approval_declined` | "Approval declined" (include decline notes in metadata) |
| `recallApprovalMutation` | `approval_recalled` | "Approval recalled" |

Each call will include `entityType: 'candidate'`, `entityId: candidateId`, and relevant metadata (job title, step info, notes).

The hook already has access to `candidateId` and `jobId` via the approval request data. For the request mutation, these are passed as parameters.

### 3. `src/components/candidates/CandidateOfferDetails.tsx` — Log offer sent & document generated

- **Offer document generated**: Add `logActivity` in the generate offer letter success handler
- **Offer sent**: Add `logActivity` in the send offer success handler

### 4. `src/utils/activityHelpers.tsx` — Add icons and colors for new activity types

Add icon/color mappings for the 6 new activity types (e.g., `Send` for approval_requested, `CheckCircle` for approval_approved, `X` for approval_declined, `Undo2` for approval_recalled, `FileText` for offer_document_generated, `Mail` for offer_sent).

### Summary

| File | Change |
|------|--------|
| DB migration | Add 6 new `activity_type` enum values |
| `useOfferApprovalRequest.ts` | Log 4 approval events in mutation `onSuccess` callbacks |
| `CandidateOfferDetails.tsx` | Log offer sent + document generated |
| `activityHelpers.tsx` | Add icons/colors for 6 new types |

