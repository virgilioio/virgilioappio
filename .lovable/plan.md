

# Fix: Resume File Not Saved When Creating Candidate via "Upload Resume First"

## Investigation findings

I traced through the full code path for creating a new candidate after dropping a resume on the form. The flow is:

1. Resume is dropped → file parsed for data, file added to `pendingFiles` via `onFileCaptured`
2. User clicks Save → `filesToUpload` captured as local copy of `pendingFiles`
3. `onSubmit` calls parent → parent creates candidate, calls `handleFormClose()`, returns result
4. `handlePostSubmitActions` runs → should upload files via `uploadFileForCandidate`

## Problems found

### Problem 1: Silent failure in post-submit upload
In `handlePostSubmitActions` (line 431-435), if the upload fails for any reason (RLS, network, timing), the error is caught and only logged to console — no toast, no retry. The user never knows the upload failed.

### Problem 2: `candidates.resume_url` never updated
`uploadFileForCandidate` uploads to storage and creates a `candidate_attachments` record, but never updates the `candidates` table with `resume_url`. Some parts of the app may look at `candidates.resume_url` instead of `candidate_attachments` to determine if a resume exists.

### Problem 3: JobDetail's `handleAddCandidate` swallows errors
In `JobDetail.tsx` line 696, the catch block doesn't re-throw, so if `addCandidate` throws, `handleAddCandidate` returns `undefined`, and `handlePostSubmitActions` never runs (the files are lost).

### Problem 4: Race condition risk with form close
The parent calls `handleFormClose()` before returning `result`. While the async function should survive React re-renders, the form close triggers a `useEffect` that resets `pendingFiles`. If for any reason the local `filesToUpload` reference is lost or the function re-enters, files are gone.

## Fix

**File 1**: `src/components/candidates/CandidateFormSheet.tsx`

1. In `handlePostSubmitActions`, add a user-visible toast on upload failure (currently silent)
2. After successful upload, update `candidates.resume_url` with the storage path so the candidate record itself reflects that a resume exists
3. Add a safety check: if `filesToUpload` is empty but `pendingFiles` has items, use `pendingFiles` as fallback

**File 2**: `src/pages/JobDetail.tsx`

In `handleAddCandidate` catch block (line 696), re-throw the error so CandidateFormSheet knows creation failed and doesn't silently lose files:
```
} catch (error) {
  console.error('Error adding candidate:', error)
  throw error  // ← add this
}
```

**File 3**: `src/components/candidates/CandidateFormSheet.tsx` (uploadFileForCandidate)

After creating the `candidate_attachments` record, also update the `candidates` table:
```ts
if (markAsResume) {
  await supabase
    .from('candidates')
    .update({ resume_url: storagePath })
    .eq('id', jobCandidateId)
}
```

## Summary

| Change | File | Purpose |
|--------|------|---------|
| Show toast on upload failure | CandidateFormSheet.tsx | User knows upload failed |
| Update `candidates.resume_url` | CandidateFormSheet.tsx | Resume linked on candidate record |
| Re-throw in catch | JobDetail.tsx | Don't silently lose files on error |
| Fallback file reference | CandidateFormSheet.tsx | Safety net for race conditions |

