
# Fix: Resume Not Appearing After Candidate Creation

## Root Cause

**The resume file is never actually uploaded to storage/database** when creating a candidate via the Global Create button (the "+" button in the header).

### The Bug

In `GlobalCreateButton.tsx`, the `handleCandidateSubmit` function **never returns the candidate result** back to `CandidateFormSheet`:

```text
GlobalCreateButton.handleCandidateSubmit:
  1. Creates candidate via addCandidate() --> gets result with { id: "abc123" }
  2. Creates job association (if needed)
  3. Closes the form sheet
  4. *** NEVER RETURNS result ***   <-- THE BUG

CandidateFormSheet.handleSubmit:
  1. const result = await onSubmit(data)  --> result is UNDEFINED
  2. if (result) {                        --> false, skips entirely
  3.   await handlePostSubmitActions()     --> NEVER CALLED
  4. }                                    --> Resume files NEVER uploaded
```

The user sees the resume parsed during creation (AI extracts name, email, etc.), but the actual file is never persisted to storage. When they open the profile, there's nothing in `candidate_attachments`.

### Secondary Issue: Timing Race Condition

Even on pages where the result IS returned (Candidates.tsx, JobDetail.tsx), there's a race condition:

1. The parent's `onSubmit` handler opens the profile sheet **inside** the handler
2. Then returns the result to CandidateFormSheet
3. CandidateFormSheet THEN uploads the files
4. But the profile sheet already fetched attachments (empty) and won't re-fetch

```text
Timeline:
  [Parent handler]  Create candidate --> Open profile sheet --> Close form --> Return result
  [Profile sheet]   Mount --> Fetch attachments (empty!) --> Show "No resume"
  [Form sheet]      Receive result --> Upload files --> Done (but profile already showing empty)
```

## Fix Plan

### Fix 1: GlobalCreateButton.tsx - Return the result (PRIMARY FIX)

Add `return newCandidate` at the end of `handleCandidateSubmit` so `CandidateFormSheet` receives the candidate ID and can upload the pending resume files.

```typescript
// Current (broken):
} else {
  toast({ title: 'Success', description: 'Candidate created successfully!' })
  navigate('/candidates')
}
setCandidateSheetOpen(false)
// Function ends without returning -- result is lost

// Fixed:
} else {
  toast({ title: 'Success', description: 'Candidate created successfully!' })
  navigate('/candidates')
}
setCandidateSheetOpen(false)
return newCandidate  // <-- Return the result so files get uploaded
```

### Fix 2: CandidateFormSheet.tsx - Guard against race conditions

Capture `pendingFiles` in a local variable before calling `onSubmit`, so even if state changes during the async call, we still have the correct file references:

```typescript
// In handleSubmit, before calling onSubmit:
const filesToUpload = [...pendingFiles]  // Capture before parent might trigger state changes

const result = await onSubmit(submitData as any)

if (result) {
  await handlePostSubmitActions(result, filesToUpload)  // Pass captured files
}
```

Update `handlePostSubmitActions` to accept and use the captured files array instead of reading from state.

### Fix 3: CandidateFormSheet.tsx - Re-order close vs upload

Move the `onClose()` call to happen AFTER file upload completes, not before. Currently the parent closes the form inside `onSubmit`, which can interfere with the upload. Add a flag so that `CandidateFormSheet` controls when to close after new candidate creation with pending files.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/layout/GlobalCreateButton.tsx` | Add `return newCandidate` in `handleCandidateSubmit` |
| `src/components/candidates/CandidateFormSheet.tsx` | Capture `pendingFiles` locally before `onSubmit`, pass to `handlePostSubmitActions` |

## Expected Result

After the fix:
1. User creates candidate with resume via Global Create button
2. Resume file is uploaded to storage and `candidate_attachments` table
3. Opening the candidate profile shows the resume in the Resume tab
