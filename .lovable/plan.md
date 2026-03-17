

# Open New Tab After Creating Candidate or Job

## Problems
1. **Candidate creation**: After saving, a profile sheet opens in-page (`showNewCandidateSheet`). User wants a **new browser tab** opening the candidate profile instead.
2. **Job wizard**: After completing all steps, the wizard just closes with a toast. User wants a **new browser tab** opening the newly created job.

## Changes

### 1. `src/pages/Candidates.tsx` (~lines 100-104)
After successful candidate creation, instead of opening the in-page `UniversalCandidateProfileSheet`, use `window.open()` to open the candidate in a new tab:

```ts
if (result?.id) {
  // Open candidate profile in new tab
  window.open(`/candidates?openCandidate=${result.id}`, '_blank')
}
```

Remove the `newCandidateId`, `newCandidateJobId`, `showNewCandidateSheet` state variables and the `<UniversalCandidateProfileSheet>` component at the bottom since they're no longer needed.

### 2. `src/components/jobs/JobWizard.tsx` (~lines 102-109)
In `handleComplete`, after the toast, open the new job in a new tab using the stored `createdJobId`:

```ts
const handleComplete = () => {
  setWizardState(prev => ({ ...prev, isComplete: true }))
  toast({
    title: 'Job Created Successfully!',
    description: 'Your job has been created and is ready for candidates.'
  })
  if (wizardState.createdJobId && wizardState.createdJobId !== 'created') {
    window.open(`/jobs/${wizardState.createdJobId}`, '_blank')
  }
  onClose()
}
```

| File | Change |
|------|--------|
| `src/pages/Candidates.tsx` | Replace in-page profile sheet with `window.open` to new tab; remove unused state/component |
| `src/components/jobs/JobWizard.tsx` | Add `window.open` in `handleComplete` to open new job in new tab |

