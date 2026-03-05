

# Fix Offer Status Lifecycle

## Correct Lifecycle

```text
draft → pending_approval → approved → sent → accepted/declined → finalized
                              ↓
                          (declined by approver → draft)
```

"Finalized" means the candidate has responded (accepted or declined). It is NOT set after approval or PDF generation.

## Changes

### 1. `src/hooks/useOfferApprovalRequest.ts` (line 208)
Change `status: 'finalized'` to `status: 'approved'` when the last approver approves.

### 2. `src/hooks/useOfferLetters.ts` (line 15)
Update status type to include `'approved'`:
```
'draft' | 'pending_approval' | 'approved' | 'finalized' | 'sent' | 'accepted' | 'declined'
```

### 3. `src/components/candidates/GenerateOfferDialog.tsx` (line 80)
After PDF generation, do NOT change status to `'finalized'`. Remove the status update entirely -- the offer stays `'approved'` until it is sent. (Or optionally set to a new interim like `'generated'`, but keeping `'approved'` is simpler since generating a PDF is just creating an attachment.)

### 4. `src/components/candidates/CandidateOfferDetails.tsx`
- Add `case 'approved': return 'purple'` to `getStatusVariant`
- Add `if (status === 'approved') return 'Approved'` to `getStatusLabel`
- Update the "Generate Offer" button guard: show when `approvalRequest?.status === 'approved'` (remove the `finalized`/`sent` exclusion since those won't happen at this stage anymore)

### Files
- `src/hooks/useOfferApprovalRequest.ts` -- line 208: `'finalized'` → `'approved'`
- `src/hooks/useOfferLetters.ts` -- add `'approved'` to status type
- `src/components/candidates/GenerateOfferDialog.tsx` -- remove status update to `'finalized'` after PDF gen
- `src/components/candidates/CandidateOfferDetails.tsx` -- handle `'approved'` in status badge helpers

