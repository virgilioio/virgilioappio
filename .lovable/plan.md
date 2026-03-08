

# Fix Candidate Deletion: Warning Dialog + Handle Scheduled Bookings

## Problem
1. `scheduled_bookings.candidate_id` FK has no `ON DELETE CASCADE`, so deleting a candidate with interviews fails with a 23503 FK violation error.
2. All delete buttons use browser `confirm()` -- ugly, no context about what will be affected.

## Solution

### 1. Database Migration
Update the `admin_delete_candidate` function to delete from `scheduled_bookings` before deleting the candidate. Also alter the FK constraint to add `ON DELETE CASCADE` so non-admin (RLS) deletions also work.

```sql
-- Fix the FK constraint
ALTER TABLE public.scheduled_bookings 
  DROP CONSTRAINT scheduled_bookings_candidate_id_fkey,
  ADD CONSTRAINT scheduled_bookings_candidate_id_fkey 
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;

-- Update the admin function to be explicit anyway
CREATE OR REPLACE FUNCTION public.admin_delete_candidate(p_candidate_id UUID)
RETURNS jsonb ...
  -- Add: DELETE FROM public.scheduled_bookings WHERE candidate_id = p_candidate_id;
  -- before DELETE FROM public.candidates
```

### 2. New Component: `DeleteCandidateDialog`
**File**: `src/components/candidates/DeleteCandidateDialog.tsx`

A reusable AlertDialog component that:
- Accepts `candidateId`, `candidateName`, `open`, `onOpenChange`, `onConfirm`
- On open, queries `scheduled_bookings` for active interviews (`status = 'confirmed'`) for that candidate
- Shows count of scheduled interviews in the warning message:
  - No interviews: "Are you sure you want to delete {name}? This action cannot be undone."
  - With interviews: "Deleting {name} will also cancel {N} scheduled interview(s). This action cannot be undone."
- "Delete" button (destructive) and "Cancel" button

### 3. Update All Delete Entry Points

Replace `confirm()` + direct `onDelete()` calls with the new `DeleteCandidateDialog`:

- **`IndependentCandidateTable.tsx`** (line 78-81): Replace `confirm()` with dialog state, render `DeleteCandidateDialog`
- **`CandidateTable.tsx`** (line 110-113): Same replacement
- **`Candidates.tsx`** (handleDelete): Already delegates to table, no change needed
- **`JobDetail.tsx`** (handleDeleteCandidate, line 791): Wrap with dialog state if needed -- but since CandidateTable handles the confirm, this is already covered

Both table components follow the same pattern: add `deleteTarget` state, open dialog on trash click, call `onDelete` on confirm.

### Files Changed
1. **Database migration** -- ALTER FK + update `admin_delete_candidate` function
2. **New**: `src/components/candidates/DeleteCandidateDialog.tsx`
3. **Edit**: `src/components/candidates/IndependentCandidateTable.tsx`
4. **Edit**: `src/components/candidates/CandidateTable.tsx`

