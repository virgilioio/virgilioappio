
# Fix: Pass `jobId` to ScorecardSheet

## Problem

The `ScorecardValidationPoints` component IS in the `ScorecardSheet` template (line 930), but it's guarded by:

```tsx
{candidateId && jobId && stageName && (
  <ScorecardValidationPoints ... />
)}
```

The issue is that `CandidateProfileSheet` never passes `jobId` to `ScorecardSheet` (lines 1639-1675). Since `jobId` is `undefined`, the condition fails silently and the panel never renders.

## Fix

One line addition in `src/components/candidates/CandidateProfileSheet.tsx` -- add `jobId={jobId}` to the `ScorecardSheet` usage around line 1639:

```tsx
<ScorecardSheet
  open={scoreOpen}
  ...
  candidateId={candidateId || undefined}
  jobId={jobId}              // <-- ADD THIS LINE
  linkedinUrl={candidate?.linkedin_url}
  ...
/>
```

`jobId` is already available as a prop of `CandidateProfileSheet` (line 93), so no other changes needed.

## Files Modified

| File | Change |
|------|--------|
| `src/components/candidates/CandidateProfileSheet.tsx` | Add `jobId={jobId}` prop to `ScorecardSheet` |

One-line fix.
