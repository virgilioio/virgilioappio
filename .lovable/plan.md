
# Feature: Open Candidate Profile Sheet After Creation

## Summary

When a user creates a new candidate from the Candidates page and saves it, the system should:
1. Close the creation form
2. Automatically open the candidate profile sheet with the newly created candidate
3. If the candidate was associated with a job during creation → open the job-context profile sheet
4. If no job association → open the independent candidate profile sheet

---

## Current Behavior

**Flow in `Candidates.tsx`:**
1. User clicks "Add Candidate" → `setIsFormOpen(true)`
2. `CandidateFormSheet` opens
3. User fills form and clicks Save
4. `handleSubmit` in `Candidates.tsx` calls `addCandidate()` 
5. Returns result with `id` property
6. Calls `handleFormClose()` → closes form
7. **Nothing happens after** - user stays on table

---

## Proposed Solution

Add state management to track the newly created candidate and open the appropriate profile sheet.

### Files to Modify

**`src/pages/Candidates.tsx`**

1. Add state for the newly created candidate profile sheet:
```typescript
const [newCandidateId, setNewCandidateId] = useState<string | null>(null)
const [newCandidateJobId, setNewCandidateJobId] = useState<string | null>(null)
const [showNewCandidateSheet, setShowNewCandidateSheet] = useState(false)
```

2. Update `handleSubmit` to capture the created candidate info:
```typescript
const handleSubmit = async (candidateData) => {
  try {
    if (selectedCandidate) {
      // Editing - no change
      const { assignedJobId, assignedStageId, ...updateData } = candidateData
      await updateCandidate(selectedCandidate.id, updateData)
      handleFormClose()
    } else {
      // Creating new candidate
      const { assignedJobId, assignedStageId, ...createData } = candidateData
      const result = await addCandidate(createData)
      
      // Handle duplicate detection
      if (result && 'isDuplicate' in result) {
        setDuplicateInfo({...})
        setShowMergeDialog(true)
        return null
      }
      
      // Success - capture candidate info and open profile sheet
      if (result?.id) {
        setNewCandidateId(result.id)
        setNewCandidateJobId(assignedJobId || null)
        setShowNewCandidateSheet(true)
      }
      
      handleFormClose()
    }
    return result
  } catch (error) {
    console.error('Error submitting candidate:', error)
    throw error
  }
}
```

3. Add `UniversalCandidateProfileSheet` component to JSX:
```tsx
<UniversalCandidateProfileSheet
  open={showNewCandidateSheet}
  onOpenChange={setShowNewCandidateSheet}
  candidateId={newCandidateId}
  jobId={newCandidateJobId}
  context={newCandidateJobId ? 'job' : 'independent'}
/>
```

4. Add import for `UniversalCandidateProfileSheet`:
```typescript
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
```

---

## Technical Details

### Why `UniversalCandidateProfileSheet`?

This component already handles the routing logic:
- If `jobId` is provided → renders `CandidateProfileSheet` (job context)
- If no `jobId` → renders `IndependentCandidateProfileSheet`

This matches the existing pattern used in `IndependentCandidateTable.tsx` (line 571).

### Data Flow

```
User saves candidate
        ↓
CandidateFormSheet.handleSubmit()
        ↓
Candidates.handleSubmit() called with result
        ↓
result.id captured + assignedJobId from form data
        ↓
Close form + Open UniversalCandidateProfileSheet
        ↓
User sees full candidate profile immediately
```

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Candidate created without job | Opens `IndependentCandidateProfileSheet` |
| Candidate created with job assignment | Opens `CandidateProfileSheet` with job context |
| Duplicate detected | Shows merge dialog first, then opens profile after merge |
| Creation fails | Error thrown, form stays open, no profile sheet |

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Candidates.tsx` | Add state, update handleSubmit, add UniversalCandidateProfileSheet |

---

## Testing Notes

1. Create candidate without job assignment → profile sheet should open in independent mode
2. Create candidate with job assignment → profile sheet should open with job context
3. Create duplicate candidate → merge dialog appears, after confirm profile opens
4. Cancel creation → no profile sheet opens
