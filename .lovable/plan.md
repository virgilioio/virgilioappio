

# Offer Approval Workflow — Full Implementation

This is a large feature spanning database tables, hooks, UI components, notifications, and dashboard integration.

## 1. Fix Empty State in CandidateOfferApprovals

Replace the `ClipboardCheck` icon with `gio-face-empty.png` avatar to match the branded empty state pattern used everywhere else (Notes, Reminders, Attachments, Offer Details, etc.).

## 2. Database Migration — Two New Tables

**`offer_approval_requests`** — one per offer when approval is requested
- `id` uuid PK, `offer_letter_id` uuid FK → offer_letters (unique), `job_id` uuid, `organization_id` uuid, `candidate_id` uuid, `requested_by` uuid, `status` text default `'pending'` (pending/approved/declined), `current_step_order` integer default 1, `created_at`/`updated_at` timestamptz

**`offer_approval_request_steps`** — one per approver in a request
- `id` uuid PK, `request_id` uuid FK → offer_approval_requests (cascade), `approver_user_id` uuid, `step_order` integer, `status` text default `'pending'` (pending/approved/declined), `notes` text nullable, `decided_at` timestamptz nullable, `created_at` timestamptz

RLS: SELECT for recruiters+ via `check_org_hierarchy_role_access`. INSERT for recruiters+ (request creation). UPDATE on steps only by the `approver_user_id` for their own row.

Also add `'pending_approval'` to the offer_letters status flow by updating the status comment (the column is text, no enum constraint).

## 3. New Hook: `useOfferApprovalRequest`

- `requestApproval(offerLetterId, jobId, candidateId)` — creates request + copies chain steps, updates offer_letters.status to `'pending_approval'`, logs activity for first approver
- `fetchApprovalRequest(offerLetterId)` — gets request + steps with approver names/roles
- `approveStep(stepId, notes?)` — sets step to approved, advances `current_step_order`, if last step → sets request to `'approved'` and offer to `'finalized'`, notifies next approver
- `declineStep(stepId, notes)` — sets step and request to `'declined'`, reverts offer to `'draft'`

## 4. "Request Approval" Button in CandidateOfferDetails

When an offer exists in `draft` status and an approval chain is enabled for the job:
- Show a "Request Approval" button below the offer details
- On click: triggers the approval request workflow
- When status is `pending_approval`: show a badge and disable the button ("Pending Approval")
- Uses `useOfferApprovalChain(jobId)` to check if chain is enabled

## 5. CandidateOfferApprovals — Full Content

Replace the placeholder with real approval data:
- When no approval request exists: show branded empty state with Gio face
- When request exists: show a vertical timeline of each approval step with:
  - Step number, approver name, role badge
  - Status icon: pending (gray), approved (green check), declined (red X), active (purple pulse)
  - Notes displayed for declined steps
  - Decided-at timestamp
- If current user is the active approver: show Approve/Decline action buttons with a notes textarea

## 6. Notifications — Offer Approval in NotificationCenter

Add `'offer_approval'` to `ActivityType` in `usePendingActivities.ts`:
- New `fetchPendingApprovals()` function: queries `offer_approval_request_steps` where `approver_user_id = userId`, `status = 'pending'`, and all previous steps in the same request are `'approved'` (it's their turn)
- Joins to get candidate name, job title from the request
- Returns as `PendingActivity` with type `'offer_approval'`

Update `NotificationCenter.tsx`:
- Include `offer_approval` type alongside email notifications
- Icon: `ClipboardCheck`, text: "Offer approval needed for {candidateName}"
- Click navigates to job with candidate sheet open on Offer tab

## 7. Dashboard — Pending Tasks Integration

Update `PendingActivities.tsx`:
- Add badge/label for `'offer_approval'` type: "Offer Approval"
- Add content rendering: "Approve offer for {candidateName}" / "{jobTitle}"
- Click opens job with candidate profile and offer tab

## Files Summary

| Action | File |
|--------|------|
| Migration | `offer_approval_requests` + `offer_approval_request_steps` tables + RLS |
| New | `src/hooks/useOfferApprovalRequest.ts` |
| Modify | `src/components/candidates/CandidateOfferApprovals.tsx` — full approval timeline + actions |
| Modify | `src/components/candidates/CandidateOfferDetails.tsx` — "Request Approval" button |
| Modify | `src/hooks/usePendingActivities.ts` — add `offer_approval` activity type + fetch |
| Modify | `src/components/layout/NotificationCenter.tsx` — render approval notifications |
| Modify | `src/components/dashboard/PendingActivities.tsx` — render approval tasks |
| Modify | `src/hooks/useOfferLetters.ts` — add `pending_approval` to status type |

