

# Fix: Job Duplication on Creation

## Root Cause

The "Create & Continue" button in `JobWizard.tsx` (line 267-275) disables itself using `isLoading` from `useJobs()`. But that `isLoading` is the **react-query fetch loading state** (whether jobs are being *fetched*), NOT a mutation/submission state. It's `false` during the `createJob` async call.

This means: the button stays clickable while the job is being created. A double-click, or even a slightly slow network response + impatient click, fires `createJob` multiple times — producing duplicates/triplicates.

## Fix

Add a local `isSubmitting` state to `JobWizard` that guards the button during creation. Set it `true` before calling `createJob`, `false` after (success or failure). Use this instead of `isLoading` to disable the button.

### `src/components/jobs/JobWizard.tsx`

1. Add `isSubmitting` state alongside the wizard state
2. In `handleNextStep`, set `isSubmitting = true` before `createJob`, `false` in finally block
3. Disable button with `isSubmitting` instead of `isLoading`
4. Also add an early return guard: if `isSubmitting` is already true, bail out immediately (belt + suspenders)

```typescript
const [isSubmitting, setIsSubmitting] = useState(false)

const handleNextStep = async () => {
  if (wizardState.currentStep === 1) {
    if (isSubmitting) return  // guard against double-fire
    setIsSubmitting(true)
    try {
      const jobResult = await createJob(...)
      // ... advance step
    } catch (error) {
      // ... don't advance
      return
    } finally {
      setIsSubmitting(false)
    }
  } else { ... }
}

// Button:
disabled={!canProceedToNextStep() || isSubmitting}
{isSubmitting ? 'Creating...' : 'Create & Continue'}
```

## Files changed

| File | Change |
|------|--------|
| `src/components/jobs/JobWizard.tsx` | Add `isSubmitting` guard to prevent double-click job creation |

