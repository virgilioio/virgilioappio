

# Offer Approval: Recall, Edit During Approval, and Field-Level Restart Trigger

## Three Features

### 1. Recall (Pull Back) an Approval Request

Allow the user who requested approval to recall/withdraw it while it's still pending.

**Database**: Add a `recalled` status to the approval request. No schema migration needed since `status` is stored as `text`, not an enum.

**Hook (`useOfferApprovalRequest.ts`)**: Add a `recallApprovalMutation` that:
- Sets the approval request status to `recalled`
- Resets all pending steps to `recalled`
- Reverts the offer letter status back to `draft`
- Expose `recallApproval(requestId)` and `isRecalling` from the hook
- Add `isCurrentUserRequester` flag (compare `approvalRequest.requested_by` with `user.id`)

**UI (`CandidateOfferDetails.tsx`)**: When status is `pending_approval` and the current user is the requester, show a "Recall" button (with an `Undo2` icon) next to the status badge.

**UI (`CandidateOfferApprovals.tsx`)**: Show a "Recalled" badge when the request status is `recalled`. Display recalled steps appropriately in the timeline.

### 2. Allow Editing Offer Details During Pending Approval

Currently the Edit button only shows when `status === 'draft'`. 

**Change (`CandidateOfferDetails.tsx`)**: Also show the Edit button when status is `pending_approval`. The edit action saves field values without changing the approval status (the existing save logic in the offer composer already works this way).

This connects to Feature 3 -- if any field marked as `triggers_approval_restart` is edited, the system will automatically recall the current approval and revert to draft.

### 3. "Triggers Approval Restart" Flag on Offer Form Fields

Add a per-field toggle that marks whether editing that field should restart the approval process.

**Database migration**: Add a `triggers_approval_restart` boolean column to `offer_form_fields`, defaulting to `false`.

**Hook (`useOfferFormFields.ts`)**: Include the new column in field data type / CRUD operations.

**UI (`OfferFieldEditor.tsx` / `FormFieldEditor.tsx`)**: Add a toggle/icon in the field editor card (offer context only). Show a `RefreshCcw` icon from lucide-react when the flag is on. In view mode, display the icon as a small indicator badge. In edit mode, show a checkbox/switch labeled "Restarts approval if edited".

**Offer save logic**: When saving an edited offer that has `pending_approval` status, check if any changed fields have `triggers_approval_restart = true`. If so, automatically recall the current approval request (delete steps + set request to `recalled`, revert offer to `draft`). The user can then re-request approval.

## Technical Details

### Migration SQL
```sql
ALTER TABLE offer_form_fields
ADD COLUMN triggers_approval_restart boolean NOT NULL DEFAULT false;
```

### Files to modify
- **`src/integrations/supabase/types.ts`** -- auto-regenerated after migration
- **`src/hooks/useOfferApprovalRequest.ts`** -- add `recallApproval` mutation, `isCurrentUserRequester` flag
- **`src/hooks/useOfferFormFields.ts`** -- include `triggers_approval_restart` in field type
- **`src/components/candidates/CandidateOfferDetails.tsx`** -- show Edit when `pending_approval`, show Recall button
- **`src/components/candidates/CandidateOfferApprovals.tsx`** -- handle `recalled` status display
- **`src/components/settings/OfferFieldEditor.tsx`** -- pass new prop to `FormFieldEditor`
- **`src/components/shared/FormFieldEditor.tsx`** -- add `triggers_approval_restart` toggle (offer context only) with `RefreshCcw` icon
- **Offer save handler** (in the minimizable offer composer) -- check for restart-triggering field changes and auto-recall if needed

