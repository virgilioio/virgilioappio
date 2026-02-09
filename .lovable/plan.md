
# Add Rejection Notes/Comments to Rejection Flow

## Overview

When rejecting a candidate, users will be able to add free-text notes explaining their decision. These notes are stored on the association record, displayed in the rejection banner when revisiting the candidate, and supported in bulk rejection too.

## Database Change

Add a `rejection_notes` column to `job_candidate_associations`:

```sql
ALTER TABLE public.job_candidate_associations
ADD COLUMN IF NOT EXISTS rejection_notes TEXT;
```

This is a non-breaking, additive schema change -- no existing data is affected.

## Code Changes

### 1. RejectionDialog.tsx -- Add notes textarea

- Add a `rejectionNotes` state variable
- Insert a `Textarea` component directly below the `RejectionReasonSelector`, with the label "Notes (optional)" and placeholder "Add context about why this candidate is being rejected..."
- Pass `rejectionNotes` through to `rejectCandidate.mutateAsync()`
- Reset `rejectionNotes` on success

### 2. useRejectCandidate.ts -- Persist notes

- Add `rejectionNotes?: string` to the `RejectCandidateInput` interface
- Include `rejection_notes: rejectionNotes || null` in the `updateData` object written to `job_candidate_associations`

### 3. BulkRejectionDialog.tsx -- Add notes textarea

- Add the same `Textarea` below the rejection reason selector
- Pass `rejectionNotes` through to `bulkReject.mutateAsync()`

### 4. useBulkRejectCandidates.ts -- Persist notes

- Add `rejectionNotes?: string` to the `BulkRejectInput` interface
- Include `rejection_notes: rejectionNotes || null` in each association's update

### 5. RejectionStatusBanner.tsx -- Display notes

- Add `rejectionNotes?: string | null` to the props interface
- When `rejectionNotes` is present, render it below the existing reason/date line as a subtle italic text block (e.g., `"Lacks experience with our tech stack"`)

### 6. CandidateProfileSheet.tsx -- Fetch and pass notes

- Add `rejection_notes` to the select queries that fetch the association (two places: initial load and the refresh after stage change)
- Add `rejectionNotes` to the `rejectionDetails` state
- Pass `rejectionNotes` as a prop to `RejectionStatusBanner`

### 7. Supabase Types -- Regenerated automatically

The migration will add `rejection_notes` to the generated types, making it available on Row/Insert/Update types for `job_candidate_associations`.

## Files Modified

| File | Change |
|------|--------|
| New migration | Add `rejection_notes TEXT` column |
| `src/components/candidates/RejectionDialog.tsx` | Add Textarea for notes |
| `src/hooks/useRejectCandidate.ts` | Accept and persist `rejectionNotes` |
| `src/components/candidates/BulkRejectionDialog.tsx` | Add Textarea for notes |
| `src/hooks/useBulkRejectCandidates.ts` | Accept and persist `rejectionNotes` |
| `src/components/candidates/RejectionStatusBanner.tsx` | Display notes when present |
| `src/components/candidates/CandidateProfileSheet.tsx` | Fetch `rejection_notes` and pass to banner |

## Risk Assessment

- **Very low risk**: Additive column, no existing behavior changes, optional field throughout
